"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  active: boolean;
  startRequested: boolean;
};

type MusicPreference = {
  enabled: boolean;
  currentTime: number;
};

const MUSIC_PREFERENCE_KEY = "character-archive-ambient-music";
const MUSIC_SOURCE = "/music/Skye%20Cuillin.mp3";

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

export default function AmbientMusic({ active, startRequested }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playbackIntent = useRef<boolean | null>(null);
  const resumeTime = useRef(0);
  const lastSavedTime = useRef(0);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

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

  const startPlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    restorePosition();

    try {
      await audio.play();
    } catch (error) {
      setIsPlaying(false);
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        return;
      }
      console.warn("Could not start the background music.", error);
    }
  }, [restorePosition]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (audioRef.current) audioRef.current.volume = 0.16;

      try {
        const saved = window.sessionStorage.getItem(MUSIC_PREFERENCE_KEY);
        if (saved) {
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
    const audio = audioRef.current;
    const onPageHide = () => savePreference();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      savePreference();
      audio?.pause();
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

  return (
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
}
