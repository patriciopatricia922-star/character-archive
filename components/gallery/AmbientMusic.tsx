"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { buildTrackList } from "../../data/musicTracks";

type AmbientMusicControls = {
  setBookMuffled: (muffled: boolean) => void;
  setGalleryActive: (active: boolean) => void;
  requestStart: () => void;
  isPlaying: boolean;
  togglePlayback: () => void;
};

type MusicPreference = {
  enabled: boolean;
  currentTime: number;
  track?: string;
};

type Track = {
  src: string;
  title: string;
  composer?: string;
};

type LoopMode = "queue" | "track";

type AudioGraph = {
  context: AudioContext;
  filter: BiquadFilterNode;
  gain: GainNode;
};

const MUSIC_PREFERENCE_KEY = "character-archive-ambient-music";
const MUSIC_MANIFEST_URL = "/music/manifest.json";
const MUSIC_INDEX_URL = "/api/music";
// Used only if the track list cannot be loaded, so the archive never goes silent.
const FALLBACK_TRACK: Track = {
  src: "/music/Skye%20Cuillin.mp3",
  title: "Skye Cuillin",
  composer: "Kevin MacLeod",
};
const BASE_VOLUME = 0.16;
const FADE_OUT_SECONDS = 2;
const FADE_IN_SECONDS = 1.6;
const RESUME_FADE_SECONDS = 0.4;
const SKIP_FADE_SECONDS = 0.35;
const CLEAR_FILTER_FREQUENCY = 20000;
const MUFFLED_FILTER_FREQUENCY = 2200;
const FILTER_TRANSITION_SECONDS = 0.9;
// Per-bar resting height plus the range and tempo of the subtle idle motion.
const WAVE_BARS = [
  { rest: 0.3, lo: 0.22, hi: 0.62, dur: 1.5, delay: -0.3 },
  { rest: 0.55, lo: 0.35, hi: 0.9, dur: 1.2, delay: -0.8 },
  { rest: 0.85, lo: 0.5, hi: 1, dur: 1.7, delay: -0.1 },
  { rest: 0.45, lo: 0.28, hi: 0.78, dur: 1.35, delay: -1.0 },
  { rest: 0.7, lo: 0.4, hi: 0.95, dur: 1.6, delay: -0.5 },
  { rest: 0.35, lo: 0.2, hi: 0.66, dur: 1.25, delay: -0.9 },
] as const;
const ambientMusicContext = createContext<AmbientMusicControls | null>(null);

function isMusicPreference(value: unknown): value is MusicPreference {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "enabled" in value &&
    typeof value.enabled === "boolean" &&
    "currentTime" in value &&
    typeof value.currentTime === "number" &&
    Number.isFinite(value.currentTime) &&
    value.currentTime >= 0 &&
    (!("track" in value) || typeof value.track === "string")
  );
}

function isTrack(value: unknown): value is Track {
  return (
    typeof value === "object" &&
    value !== null &&
    "src" in value &&
    typeof value.src === "string" &&
    "title" in value &&
    typeof value.title === "string" &&
    (!("composer" in value) || value.composer == null || typeof value.composer === "string")
  );
}

// Reads the track list: first the static manifest written at build time (no server code involved),
// then the /api/music route as a backup.
async function loadTrackList(): Promise<Track[]> {
  try {
    const response = await fetch(MUSIC_MANIFEST_URL, { cache: "no-cache" });
    if (response.ok) {
      const data: unknown = await response.json();
      const files =
        typeof data === "object" && data !== null && "files" in data && Array.isArray(data.files)
          ? data.files.filter((file): file is string => typeof file === "string")
          : [];
      const list = buildTrackList(files);
      if (list.length > 0) return list;
    }
  } catch (error) {
    console.warn(`Could not read ${MUSIC_MANIFEST_URL}; trying ${MUSIC_INDEX_URL}.`, error);
  }

  const response = await fetch(MUSIC_INDEX_URL);
  if (!response.ok) throw new Error(`${MUSIC_INDEX_URL} responded with ${response.status}.`);
  const data: unknown = await response.json();
  const list = Array.isArray(data) ? data.filter(isTrack) : [];
  if (list.length === 0) throw new Error(`${MUSIC_INDEX_URL} returned no playable tracks.`);
  return list;
}

function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function sameSrc(a: string, b: string) {
  try {
    return decodeURI(a) === decodeURI(b);
  } catch {
    return a === b;
  }
}

export function useAmbientMusic() {
  const controls = useContext(ambientMusicContext);
  if (!controls) {
    throw new Error("useAmbientMusic must be used within AmbientMusicProvider.");
  }
  return controls;
}

export default function AmbientMusicProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioGraphRef = useRef<AudioGraph | null>(null);
  const bookMuffledRef = useRef(false);
  const playbackIntent = useRef<boolean | null>(null);
  const resumeTime = useRef(0);
  const lastSavedTime = useRef(0);
  const savedTrackSrc = useRef<string | null>(null);
  const currentSrcRef = useRef<string | null>(null);
  const queueInitialized = useRef(false);
  const pendingAdvance = useRef(false);
  const fadingOut = useRef(false);
  const failedSkips = useRef(0);
  const skipTimer = useRef<number | null>(null);
  const fadeFrame = useRef(0);
  const [prefsRead, setPrefsRead] = useState(false);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [listFailed, setListFailed] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const [queueReady, setQueueReady] = useState(false);
  const [progress, setProgress] = useState({ time: 0, duration: 0 });
  const [loopMode, setLoopMode] = useState<LoopMode>("queue");
  const preferenceLoaded = prefsRead && queueReady;
  const [isPlaying, setIsPlaying] = useState(false);
  const [bookMuffled, setBookMuffled] = useState(false);
  const [galleryActive, setGalleryActive] = useState(false);
  const active = galleryActive && pathname === "/";
  const [startRequested, setStartRequested] = useState(false);
  const currentTrack = tracks?.[trackIndex] ?? null;
  const currentSrc = currentTrack?.src ?? null;

  const savePreference = useCallback(() => {
    if (playbackIntent.current === null) return;

    const audio = audioRef.current;
    const currentTime =
      audio && audio.readyState >= HTMLMediaElement.HAVE_METADATA
        ? audio.currentTime
        : resumeTime.current;

    try {
      window.sessionStorage.setItem(
        MUSIC_PREFERENCE_KEY,
        JSON.stringify({ enabled: playbackIntent.current, currentTime, track: currentSrcRef.current ?? undefined }),
      );
      resumeTime.current = currentTime;
      lastSavedTime.current = currentTime;
    } catch (error) {
      console.warn("Could not save the background music preference.", error);
    }
  }, []);

  const restorePosition = useCallback(() => {
    const audio = audioRef.current;
    if (
      !audio ||
      audio.readyState < HTMLMediaElement.HAVE_METADATA ||
      !Number.isFinite(audio.duration) ||
      audio.duration <= 0
    ) {
      return;
    }

    audio.currentTime = Math.min(resumeTime.current, Math.max(0, audio.duration - 0.1));
  }, []);

  // Ramps the output level without touching playback. Uses a GainNode when the audio graph exists,
  // otherwise falls back to easing the element's own volume.
  const fadeGain = useCallback((target: number, seconds: number) => {
    const graph = audioGraphRef.current;
    if (graph) {
      const param = graph.gain.gain;
      const now = graph.context.currentTime;
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      if (seconds <= 0) param.setValueAtTime(target, now);
      else param.linearRampToValueAtTime(target, now + seconds);
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;
    window.cancelAnimationFrame(fadeFrame.current);
    const from = audio.volume;
    const to = target * BASE_VOLUME;
    if (seconds <= 0) {
      audio.volume = to;
      return;
    }
    const startedAt = performance.now();
    const tick = (time: number) => {
      const progress = Math.min(1, (time - startedAt) / (seconds * 1000));
      audio.volume = from + (to - from) * progress;
      if (progress < 1) fadeFrame.current = window.requestAnimationFrame(tick);
    };
    fadeFrame.current = window.requestAnimationFrame(tick);
  }, []);

  const ensureAudioGraph = useCallback(() => {
    if (audioGraphRef.current) return audioGraphRef.current;

    const audio = audioRef.current;
    if (!audio || typeof window.AudioContext !== "function") return null;

    try {
      const context = new window.AudioContext();
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.setValueAtTime(0.707, context.currentTime);
      filter.frequency.setValueAtTime(
        bookMuffledRef.current
          ? MUFFLED_FILTER_FREQUENCY
          : Math.min(CLEAR_FILTER_FREQUENCY, context.sampleRate / 2),
        context.currentTime,
      );
      const source = context.createMediaElementSource(audio);
      const gain = context.createGain();
      gain.gain.setValueAtTime(1, context.currentTime);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);

      const graph = { context, filter, gain };
      audioGraphRef.current = graph;
      return graph;
    } catch (error) {
      console.warn("Could not initialize the background music filter.", error);
      return null;
    }
  }, []);

  const startPlayback = useCallback(async (fadeSeconds = RESUME_FADE_SECONDS) => {
    const audio = audioRef.current;
    if (!audio) return;

    const graph = ensureAudioGraph();
    if (audio.paused) {
      restorePosition();
      fadingOut.current = false;
      fadeGain(1, fadeSeconds);
    }

    try {
      const resumeContext =
        graph && graph.context.state !== "running"
          ? graph.context.resume()
          : Promise.resolve();
      const startAudio = audio.paused ? audio.play() : Promise.resolve();
      await Promise.all([resumeContext, startAudio]);
    } catch (error) {
      setIsPlaying(false);
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        return;
      }
      console.warn("Could not start the background music.", error);
    }
  }, [ensureAudioGraph, fadeGain, restorePosition]);

  const requestStart = useCallback(() => {
    setGalleryActive(true);
    setStartRequested(true);
    if (preferenceLoaded) {
      playbackIntent.current = true;
      savePreference();
      void startPlayback();
    }
  }, [preferenceLoaded, savePreference, startPlayback]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (audioRef.current) audioRef.current.volume = BASE_VOLUME;

      try {
        const saved = window.sessionStorage.getItem(MUSIC_PREFERENCE_KEY);
        if (saved && playbackIntent.current === null) {
          const parsed: unknown = JSON.parse(saved);
          if (!isMusicPreference(parsed)) {
            throw new Error("Expected a valid background music preference.");
          }
          playbackIntent.current = parsed.enabled;
          savedTrackSrc.current = parsed.track ?? null;
          resumeTime.current = parsed.currentTime;
          lastSavedTime.current = parsed.currentTime;
        }
      } catch (error) {
        console.warn("Could not read the background music preference.", error);
      }
      setPrefsRead(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadTrackList()
      .then((list) => {
        console.info(`Music queue: ${list.length} track(s) - ${list.map((track) => track.title).join(", ")}`);
        if (!cancelled) setTracks(list);
      })
      .catch((error) => {
        console.error(
          "The soundtrack list could not be loaded, so only the default track will play and the queue cannot advance. " +
            "Check that /music/manifest.json (or /api/music) is reachable.",
          error,
        );
        if (!cancelled) {
          setListFailed(true);
          setTracks([FALLBACK_TRACK]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Once both the saved preference and the track list are known, pick the starting track
  // (the saved one when it still exists, otherwise the first) before anything may play.
  useEffect(() => {
    if (!prefsRead || !tracks || queueInitialized.current) return;
    queueInitialized.current = true;

    const wanted = savedTrackSrc.current ?? FALLBACK_TRACK.src;
    const found = tracks.findIndex((track) => sameSrc(track.src, wanted));
    if (found >= 0) {
      setTrackIndex(found);
    } else {
      setTrackIndex(0);
      resumeTime.current = 0;
      lastSavedTime.current = 0;
    }
    setQueueReady(true);
  }, [prefsRead, tracks]);

  useEffect(() => {
    currentSrcRef.current = currentSrc;
  }, [currentSrc]);

  // When the queue advances, the new source has just been rendered: start it silent and fade it in.
  useEffect(() => {
    if (!pendingAdvance.current) return;
    pendingAdvance.current = false;
    resumeTime.current = 0;
    lastSavedTime.current = 0;
    fadingOut.current = false;
    fadeGain(0, 0);
    savePreference();
    if (playbackIntent.current) void startPlayback(FADE_IN_SECONDS);
  }, [currentSrc, fadeGain, savePreference, startPlayback]);

  useEffect(() => {
    if (!preferenceLoaded || !active) return;

    if (startRequested && playbackIntent.current === null) {
      playbackIntent.current = true;
      savePreference();
    }

    if (playbackIntent.current) void startPlayback();
  }, [active, preferenceLoaded, savePreference, startPlayback, startRequested]);

  useEffect(() => {
    bookMuffledRef.current = bookMuffled;
    const graph = audioGraphRef.current;
    if (!graph) return;

    const frequency = graph.filter.frequency;
    const now = graph.context.currentTime;
    const target = bookMuffled
      ? MUFFLED_FILTER_FREQUENCY
      : Math.min(CLEAR_FILTER_FREQUENCY, graph.context.sampleRate / 2);

    frequency.cancelScheduledValues(now);
    frequency.setValueAtTime(frequency.value, now);
    frequency.linearRampToValueAtTime(target, now + FILTER_TRANSITION_SECONDS);
  }, [bookMuffled]);

  useEffect(() => {
    const audio = audioRef.current;
    const onPageHide = () => savePreference();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      savePreference();
      window.cancelAnimationFrame(fadeFrame.current);
      if (skipTimer.current !== null) window.clearTimeout(skipTimer.current);
      audio?.pause();
      if (audioGraphRef.current?.context.state !== "closed") {
        void audioGraphRef.current?.context.close();
      }
    };
  }, [savePreference]);

  const syncProgress = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setProgress({
      time: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
    });
  };
  const handleLoadedMetadata = () => {
    restorePosition();
    syncProgress();
  };
  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    syncProgress();

    // Ease the level down over the last couple of seconds so the track ends softly.
    if (
      tracks &&
      tracks.length > 1 &&
      loopMode === "queue" &&
      !audio.paused &&
      !fadingOut.current &&
      Number.isFinite(audio.duration)
    ) {
      const remaining = audio.duration - audio.currentTime;
      if (remaining > 0.25 && remaining <= FADE_OUT_SECONDS) {
        fadingOut.current = true;
        fadeGain(0, remaining - 0.05);
      }
    }

    if (playbackIntent.current === null) return;
    if (Math.abs(audio.currentTime - lastSavedTime.current) < 3) return;
    savePreference();
  };

  const advanceQueue = () => {
    if (!tracks || tracks.length < 2 || pendingAdvance.current || skipTimer.current !== null) return;
    pendingAdvance.current = true;
    setTrackIndex((index) => (index + 1) % tracks.length);
  };

  // Jumps to a position in the current track. Any fade-out already under way is cancelled so the
  // track does not stay quiet after seeking back from the end.
  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.min(Math.max(0, seconds), Math.max(0, audio.duration - 0.5));
    fadingOut.current = false;
    if (!audio.paused) fadeGain(1, 0.25);
    syncProgress();
  };

  // Moves to the next track through the normal queue path. While playing, the current track is
  // faded out first; while muted the next track is simply queued up and stays paused.
  const skipToNext = () => {
    if (!tracks || tracks.length < 2 || pendingAdvance.current || skipTimer.current !== null) return;
    const advance = () => {
      skipTimer.current = null;
      if (pendingAdvance.current) return;
      pendingAdvance.current = true;
      setTrackIndex((index) => (index + 1) % tracks.length);
    };
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      fadeGain(0, SKIP_FADE_SECONDS);
      skipTimer.current = window.setTimeout(advance, SKIP_FADE_SECONDS * 1000);
    } else {
      advance();
    }
  };

  const toggleLoopMode = () => {
    setLoopMode((mode) => (mode === "queue" ? "track" : "queue"));
    // The end-of-track fade is only used when the queue moves on, so undo one that has begun.
    fadingOut.current = false;
    if (audioRef.current && !audioRef.current.paused) fadeGain(1, 0.3);
  };

  // `ended` must be true: a stale event from a track that has already been replaced is ignored.
  const handleEnded = () => {
    if (audioRef.current?.ended) advanceQueue();
  };

  // A file that cannot be loaded or decoded is skipped so it cannot stall the queue. If every
  // track in a row fails, stop skipping instead of cycling forever.
  const handleError = () => {
    if (!tracks || tracks.length < 2) return;
    failedSkips.current += 1;
    if (failedSkips.current >= tracks.length) {
      console.warn("None of the soundtrack files could be played.");
      return;
    }
    console.warn("Skipping a soundtrack that could not be played:", audioRef.current?.currentSrc);
    advanceQueue();
  };

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused) {
      playbackIntent.current = false;
      savePreference();
      audio.pause();
      setIsPlaying(false);
      return;
    }

    playbackIntent.current = true;
    savePreference();
    void startPlayback();
  }, [savePreference, startPlayback]);

  const controls = useMemo(
    () => ({ setBookMuffled, setGalleryActive, requestStart, isPlaying, togglePlayback }),
    [isPlaying, requestStart, togglePlayback],
  );

  const player = (
    <>
      <audio
        ref={audioRef}
        src={queueReady ? currentTrack?.src : undefined}
        loop={loopMode === "track" || !tracks || tracks.length < 2}
        onLoadStart={syncProgress}
        onDurationChange={syncProgress}
        onSeeked={syncProgress}
        preload="metadata"
        aria-hidden="true"
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => {
          // A natural end fires "pause" just before "ended"; the queue is about to continue.
          if (audioRef.current?.ended) handleEnded();
          else setIsPlaying(false);
        }}
        onEnded={handleEnded}
        onError={handleError}
        onPlaying={() => {
          failedSkips.current = 0;
        }}
        onTimeUpdate={handleTimeUpdate}
      />
      {active && currentTrack && (
        <div
          className="pf-now-playing"
          role="group"
          aria-label="Music player"
          data-playing={isPlaying}
          data-loop={loopMode}
          onKeyDown={(event) => {
            // Keep the seek slider's arrow keys from also stepping the portrait gallery.
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") event.stopPropagation();
          }}
        >
          <div className="pf-np-main">
            <span className="pf-np-wave" aria-hidden="true">
              {WAVE_BARS.map((bar, i) => (
                <span
                  key={i}
                  style={
                    {
                      "--rest": bar.rest,
                      "--lo": bar.lo,
                      "--hi": bar.hi,
                      "--dur": `${bar.dur}s`,
                      "--delay": `${bar.delay}s`,
                    } as CSSProperties
                  }
                />
              ))}
            </span>
            <span className="pf-np-text" key={currentTrack.src}>
              <span className="pf-np-title">{currentTrack.title}</span>
              {(currentTrack.composer || (tracks && tracks.length > 1)) && (
                <span className="pf-np-composer">
                  {[currentTrack.composer, tracks && tracks.length > 1 ? `${trackIndex + 1}/${tracks.length}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </span>
            <span className="pf-np-controls">
              <button
                type="button"
                className="pf-np-button"
                aria-label="Skip to next track"
                title={
                  listFailed
                    ? "The track list could not be loaded, so there is no next track"
                    : !tracks || tracks.length < 2
                      ? "Only one track is available"
                      : "Next track"
                }
                disabled={!tracks || tracks.length < 2}
                onClick={skipToNext}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <polygon points="6 4 16 12 6 20 6 4" fill="currentColor" />
                  <line x1="19" y1="5" x2="19" y2="19" />
                </svg>
              </button>
              <button
                type="button"
                className="pf-np-button pf-np-loop"
                aria-label={
                  loopMode === "queue"
                    ? "Loop all tracks. Switch to repeating this track"
                    : "Repeating this track. Switch to looping all tracks"
                }
                aria-pressed={loopMode === "track"}
                title={loopMode === "queue" ? "Loop all tracks" : "Repeat this track"}
                onClick={toggleLoopMode}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m17 2 4 4-4 4" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <path d="m7 22-4-4 4-4" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  {loopMode === "track" && <path d="M11 10h1v4" />}
                </svg>
              </button>
            </span>
          </div>
          <div className="pf-np-progress">
            <span className="pf-np-time" aria-hidden="true">
              {formatClock(progress.time)}
            </span>
            <input
              className="pf-np-seek"
              type="range"
              aria-label="Seek within track"
              aria-valuetext={
                progress.duration > 0
                  ? `${formatClock(progress.time)} of ${formatClock(progress.duration)}`
                  : "Loading"
              }
              min={0}
              max={Math.max(0, Math.floor(progress.duration))}
              step={1}
              value={Math.min(Math.floor(progress.time), Math.max(0, Math.floor(progress.duration)))}
              disabled={progress.duration <= 0}
              style={
                { "--p": `${progress.duration > 0 ? Math.min(100, (progress.time / progress.duration) * 100) : 0}%` } as CSSProperties
              }
              onChange={(event) => seekTo(Number(event.target.value))}
            />
            <span className="pf-np-time" aria-hidden="true">
              {progress.duration > 0
                ? `-${formatClock(Math.max(0, Math.round(progress.duration) - Math.floor(progress.time)))}`
                : "-:--"}
            </span>
          </div>
          <span className="sr-only">{isPlaying ? "Playing" : "Paused"}</span>
        </div>
      )}
    </>
  );

  return (
    <ambientMusicContext.Provider value={controls}>
      {children}
      {player}
    </ambientMusicContext.Provider>
  );
}