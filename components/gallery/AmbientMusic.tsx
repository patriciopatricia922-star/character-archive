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
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

type AmbientMusicControls = {
  setBookMuffled: (muffled: boolean) => void;
  setGalleryActive: (active: boolean) => void;
  requestStart: () => void;
};

type MusicPreference = {
  enabled: boolean;
  currentTime: number;
};

type AudioGraph = {
  context: AudioContext;
  filter: BiquadFilterNode;
};

const MUSIC_PREFERENCE_KEY = "character-archive-ambient-music";
const MUSIC_SOURCE = "/music/Skye%20Cuillin.mp3";
const CLEAR_FILTER_FREQUENCY = 20000;
const MUFFLED_FILTER_FREQUENCY = 2200;
const FILTER_TRANSITION_SECONDS = 0.9;
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
    value.currentTime >= 0
  );
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
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bookMuffled, setBookMuffled] = useState(false);
  const [galleryActive, setGalleryActive] = useState(false);
  const active = galleryActive && pathname === "/";
  const [startRequested, setStartRequested] = useState(false);

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
        JSON.stringify({ enabled: playbackIntent.current, currentTime }),
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
      source.connect(filter);
      filter.connect(context.destination);

      const graph = { context, filter };
      audioGraphRef.current = graph;
      return graph;
    } catch (error) {
      console.warn("Could not initialize the background music filter.", error);
      return null;
    }
  }, []);

  const startPlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    const graph = ensureAudioGraph();
    if (audio.paused) restorePosition();

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
  }, [ensureAudioGraph, restorePosition]);

  const requestStart = useCallback(() => {
    setGalleryActive(true);
    setStartRequested(true);
    if (preferenceLoaded) {
      playbackIntent.current = true;
      savePreference();
      void startPlayback();
    }
  }, [preferenceLoaded, savePreference, startPlayback]);

  const controls = useMemo(
    () => ({ setBookMuffled, setGalleryActive, requestStart }),
    [requestStart],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (audioRef.current) audioRef.current.volume = 0.16;

      try {
        const saved = window.sessionStorage.getItem(MUSIC_PREFERENCE_KEY);
        if (saved && playbackIntent.current === null) {
          const parsed: unknown = JSON.parse(saved);
          if (!isMusicPreference(parsed)) {
            throw new Error("Expected a valid background music preference.");
          }
          playbackIntent.current = parsed.enabled;
          resumeTime.current = parsed.currentTime;
          lastSavedTime.current = parsed.currentTime;
        }
      } catch (error) {
        console.warn("Could not read the background music preference.", error);
      }
      setPreferenceLoaded(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

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
      audio?.pause();
      if (audioGraphRef.current?.context.state !== "closed") {
        void audioGraphRef.current?.context.close();
      }
    };
  }, [savePreference]);

  const handleLoadedMetadata = () => restorePosition();
  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || playbackIntent.current === null) return;
    if (Math.abs(audio.currentTime - lastSavedTime.current) < 3) return;
    savePreference();
  };

  const togglePlayback = () => {
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
  };

  const player = (
    <>
      <audio
        ref={audioRef}
        src={MUSIC_SOURCE}
        loop
        preload="metadata"
        aria-hidden="true"
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
      />
      {active && (
        <button
          className="pf-music-toggle"
          type="button"
          aria-label={isPlaying ? "Pause background music" : "Play background music"}
          aria-pressed={isPlaying}
          title={isPlaying ? "Pause background music" : "Play background music"}
          onClick={togglePlayback}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
            {isPlaying ? (
              <path d="M3 5c1.4 1.1 1.4 2.9 0 4" />
            ) : (
              <path d="m3 3 18 18" />
            )}
          </svg>
        </button>
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
