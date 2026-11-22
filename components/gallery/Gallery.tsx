"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CSSProperties, PointerEvent, TouchEvent, WheelEvent } from "react";
import Image from "next/image";
import cogwheel from "../../assets/cogwheel.svg";
import photoFrame from "../../assets/photo-frame.png";
import scrollPaper from "../../assets/scroll-paper.png";
import {
  placePortraitsCenterOutward,
  portraits as defaultPortraits,
  type PortraitData,
} from "../../data/portraits";
import { GUILD_RECORDS_TRANSITION_EVENT } from "../SceneTransitionOverlay";
import ClosedLedgerBook from "../guild-records/ClosedLedgerBook";
import { useAmbientMusic } from "./AmbientMusic";
import PortraitArt from "./PortraitArt";
import Dossier from "./Dossier";
import "./gallery.css";

type Props = {
  portraits?: PortraitData[];
  /** Fires when a visitor confirms a portrait (zoom). Later stages hook in here. */
  onSelect?: (id: string) => void;
};

const WALL_CELLS = 30;
const EFFECTS_PREFERENCE_KEY = "character-archive-visual-effects";
const SETTINGS_PREFERENCE_KEY = "character-archive-exhibition-settings";
const FLICKER_INTERVAL = 15 * 60 * 1000;
const FLICKER_DURATION = 10 * 1000;
const BOOK_TRANSITION_HANDOFF_DELAY = 720;

type ExhibitionSettings = {
  spotlightFlickering: boolean;
  floatingDustParticles: boolean;
  reducedMotion: boolean;
};

const DEFAULT_SETTINGS: ExhibitionSettings = {
  spotlightFlickering: false,
  floatingDustParticles: true,
  reducedMotion: false,
};

const SETTINGS_OPTIONS = [
  {
    key: "spotlightFlickering",
    label: "Spotlight flickering",
    description: "Allow an occasional, brief flutter in the gallery spotlight.",
  },
  {
    key: "floatingDustParticles",
    label: "Floating dust particles",
    description: "Show the slow-moving particles in the exhibition light.",
  },
  {
    key: "reducedMotion",
    label: "Reduced motion",
    description: "Limit movement and animated transitions. Your system preference is always respected.",
  },
] as const;

const DUST_PARTICLES = [
  { x: 7, y: 13, size: 1.1, duration: 32, delay: -18, drift: 11, alpha: 0.13 },
  { x: 15, y: 70, size: 1.4, duration: 46, delay: -27, drift: -9, alpha: 0.12 },
  { x: 22, y: 30, size: 0.9, duration: 38, delay: -11, drift: 14, alpha: 0.1 },
  { x: 31, y: 86, size: 1.2, duration: 51, delay: -33, drift: -12, alpha: 0.14 },
  { x: 36, y: 55, size: 1.5, duration: 35, delay: -8, drift: 10, alpha: 0.2 },
  { x: 40, y: 18, size: 1, duration: 43, delay: -21, drift: -8, alpha: 0.17 },
  { x: 46, y: 72, size: 1.7, duration: 56, delay: -39, drift: 13, alpha: 0.23 },
  { x: 53, y: 31, size: 1.2, duration: 34, delay: -14, drift: -11, alpha: 0.19 },
  { x: 59, y: 88, size: 1, duration: 48, delay: -24, drift: 9, alpha: 0.16 },
  { x: 64, y: 10, size: 1.5, duration: 39, delay: -31, drift: -13, alpha: 0.21 },
  { x: 70, y: 54, size: 1.1, duration: 53, delay: -17, drift: 12, alpha: 0.14 },
  { x: 77, y: 24, size: 1.6, duration: 37, delay: -29, drift: -10, alpha: 0.12 },
  { x: 85, y: 75, size: 1, duration: 44, delay: -12, drift: 15, alpha: 0.1 },
  { x: 94, y: 40, size: 1.3, duration: 58, delay: -42, drift: -14, alpha: 0.13 },
  { x: 3, y: 48, size: 1.4, duration: 41, delay: -22, drift: 10, alpha: 0.09 },
  { x: 11, y: 91, size: 1, duration: 55, delay: -35, drift: -12, alpha: 0.11 },
  { x: 18, y: 5, size: 1.7, duration: 36, delay: -16, drift: 13, alpha: 0.12 },
  { x: 27, y: 62, size: 1.1, duration: 49, delay: -40, drift: -9, alpha: 0.15 },
  { x: 34, y: 38, size: 1.3, duration: 33, delay: -7, drift: 11, alpha: 0.2 },
  { x: 43, y: 96, size: 0.9, duration: 45, delay: -28, drift: -13, alpha: 0.18 },
  { x: 49, y: 4, size: 1.5, duration: 57, delay: -44, drift: 8, alpha: 0.21 },
  { x: 56, y: 63, size: 1.1, duration: 40, delay: -19, drift: -14, alpha: 0.18 },
  { x: 62, y: 43, size: 1.8, duration: 52, delay: -32, drift: 12, alpha: 0.19 },
  { x: 73, y: 93, size: 1.2, duration: 31, delay: -13, drift: -10, alpha: 0.13 },
  { x: 81, y: 58, size: 1, duration: 47, delay: -37, drift: 14, alpha: 0.1 },
  { x: 89, y: 17, size: 1.5, duration: 54, delay: -25, drift: -11, alpha: 0.12 },
  { x: 24, y: 79, size: 1.3, duration: 42, delay: -30, drift: 9, alpha: 0.1 },
  { x: 38, y: 2, size: 0.9, duration: 50, delay: -41, drift: -15, alpha: 0.16 },
  { x: 67, y: 82, size: 1.4, duration: 35, delay: -10, drift: 11, alpha: 0.17 },
  { x: 97, y: 64, size: 1.1, duration: 59, delay: -46, drift: -8, alpha: 0.08 },
] as const;

export default function Gallery({ portraits = defaultPortraits, onSelect }: Props) {
  const arrangedPortraits = useMemo(
    () => placePortraitsCenterOutward(portraits),
    [portraits],
  );
  const n = arrangedPortraits.length;
  const [index, setIndex] = useState(() => Math.floor(n / 2));
  useEffect(() => {
    setIndex(Math.floor(n / 2));
  }, [n]);
  const [hover, setHover] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [settings, setSettings] = useState<ExhibitionSettings>(DEFAULT_SETTINGS);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [flickering, setFlickering] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [enteringBook, setEnteringBook] = useState(false);
  const drag = useRef({ x: 0, active: false, moved: false });
  const entryTouchStart = useRef<{ x: number; y: number } | null>(null);
  const bookEntryTimeout = useRef<number | null>(null);
  const bookEntryStarted = useRef(false);
  const bookEntrySequence = useRef(0);
  const lastWheel = useRef(0);
  const stageRef = useRef<HTMLElement>(null);
  const zoomedRef = useRef(false);
  const settleCamera = useRef<() => void>(() => {});
  const dialogRef = useRef<HTMLDivElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const enableEffectsRef = useRef<HTMLButtonElement>(null);
  const disableFlickerRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const effectiveReducedMotion = systemReducedMotion || settings.reducedMotion;
  const showVisitorNotice = preferenceLoaded && !hasEntered;
  const entered = preferenceLoaded && hasEntered;
  const experienceBlocked = !preferenceLoaded || !hasEntered;
  const { requestStart, setGalleryActive, isPlaying, togglePlayback } = useAmbientMusic();

  const step = useCallback(
    (d: number) => setIndex((i) => Math.max(0, Math.min(n - 1, i + d))),
    [n]
  );
  const open = () => {
    setFlickering(false);
    setZoomed(true);
    onSelect?.(arrangedPortraits[index].id);
  };

  const saveSettings = (nextSettings: ExhibitionSettings) => {
    setSettings(nextSettings);
    try {
      window.localStorage.setItem(SETTINGS_PREFERENCE_KEY, JSON.stringify(nextSettings));
    } catch (error) {
      console.warn("Could not save the exhibition settings.", error);
    }
  };

  const updateSetting = (key: keyof ExhibitionSettings, value: boolean) => {
    saveSettings({ ...settings, [key]: value });
    if ((key === "spotlightFlickering" && !value) || (key === "reducedMotion" && value)) {
      setFlickering(false);
    }
  };

  const chooseEffects = (enabled: boolean) => {
    try {
      window.sessionStorage.setItem(EFFECTS_PREFERENCE_KEY, enabled ? "enabled" : "disabled");
    } catch (error) {
      console.warn("Could not save the visitor notice choice for this session.", error);
    }
    saveSettings({ ...settings, spotlightFlickering: enabled });
    setHasEntered(true);
    requestStart();
    setFlickering(false);
    window.requestAnimationFrame(() => settingsButtonRef.current?.focus());
  };

  const enterBook = useCallback(() => {
    if (bookEntryStarted.current) return;
    bookEntryStarted.current = true;
    setEnteringBook(true);

    const reducedMotion =
      effectiveReducedMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const navigate = () =>
      router.push(
        `/guild-records?entry=${Date.now().toString(36)}-${++bookEntrySequence.current}`,
        { scroll: false },
      );

    if (reducedMotion) {
      navigate();
      return;
    }

    window.dispatchEvent(new Event(GUILD_RECORDS_TRANSITION_EVENT));
    bookEntryTimeout.current = window.setTimeout(() => {
      bookEntryTimeout.current = null;
      navigate();
    }, BOOK_TRANSITION_HANDOFF_DELAY);
  }, [effectiveReducedMotion, router]);

  const onEntryTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches.item(0);
    const target = event.target;
    const startedOnControl =
      target instanceof Element &&
      target.closest(
        ".pf-portrait, .pf-dot, .pf-back, .pf-settings-button, .pf-music-toggle, .pf-settings-panel, .pf-effects-dialog",
      );

    entryTouchStart.current =
      !experienceBlocked &&
      !zoomed &&
      !enteringBook &&
      event.touches.length === 1 &&
      touch &&
      touch.clientY >= window.innerHeight * 0.52 &&
      !startedOnControl
        ? { x: touch.clientX, y: touch.clientY }
        : null;
  };

  const onEntryTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = entryTouchStart.current;
    const touch = event.changedTouches.item(0);
    entryTouchStart.current = null;
    if (!start || !touch) return;

    const deltaY = start.y - touch.clientY;
    const deltaX = touch.clientX - start.x;
    if (deltaY >= 72 && deltaY > Math.abs(deltaX) * 1.3) enterBook();
  };

  useEffect(() => {
    setGalleryActive(entered);
  }, [entered, setGalleryActive]);

  useEffect(
    () => () => {
      if (bookEntryTimeout.current !== null) {
        window.clearTimeout(bookEntryTimeout.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (pathname !== "/") return;
    bookEntryStarted.current = false;
    const frame = window.requestAnimationFrame(() => setEnteringBook(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateSystemMotion = () => {
      setSystemReducedMotion(motionPreference.matches);
      if (motionPreference.matches) setFlickering(false);
    };
    updateSystemMotion();
    motionPreference.addEventListener("change", updateSystemMotion);

    const frame = window.requestAnimationFrame(() => {
      let sessionPreference: string | null = null;
      let storedSettings: string | null = null;
      try {
        sessionPreference = window.sessionStorage.getItem(EFFECTS_PREFERENCE_KEY);
      } catch (error) {
        console.warn("Could not read the visitor notice choice for this session.", error);
      }
      try {
        storedSettings = window.localStorage.getItem(SETTINGS_PREFERENCE_KEY);
      } catch (error) {
        console.warn("Could not read the exhibition settings.", error);
      }

      let initialSettings = DEFAULT_SETTINGS;
      if (storedSettings) {
        try {
          const parsed: unknown = JSON.parse(storedSettings);
          if (!parsed || typeof parsed !== "object") throw new Error("Expected an object.");
          const saved = parsed as Record<string, unknown>;
          initialSettings = {
            spotlightFlickering:
              typeof saved.spotlightFlickering === "boolean"
                ? saved.spotlightFlickering
                : DEFAULT_SETTINGS.spotlightFlickering,
            floatingDustParticles:
              typeof saved.floatingDustParticles === "boolean"
                ? saved.floatingDustParticles
                : DEFAULT_SETTINGS.floatingDustParticles,
            reducedMotion:
              typeof saved.reducedMotion === "boolean" ? saved.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
          };
        } catch (error) {
          console.warn("Could not parse the saved exhibition settings.", error);
        }
      } else if (sessionPreference === "enabled" || sessionPreference === "disabled") {
        initialSettings = {
          ...initialSettings,
          spotlightFlickering: sessionPreference === "enabled",
        };
      }

      setSettings(initialSettings);
      setHasEntered(sessionPreference === "enabled" || sessionPreference === "disabled");
      setPreferenceLoaded(true);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      motionPreference.removeEventListener("change", updateSystemMotion);
    };
  }, []);

  useEffect(() => {
    const updatePageVisibility = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", updatePageVisibility);
    return () => document.removeEventListener("visibilitychange", updatePageVisibility);
  }, []);

  useEffect(() => {
    if (!preferenceLoaded || !hasEntered || !settings.spotlightFlickering || effectiveReducedMotion || zoomed) return;

    let phase: "steady" | "flicker" = "steady";
    let remaining = FLICKER_INTERVAL;
    let startedAt = 0;
    let timer: number | undefined;

    const schedule = () => {
      if (document.visibilityState !== "visible") return;
      startedAt = performance.now();
      timer = window.setTimeout(() => {
        timer = undefined;
        if (phase === "steady") {
          phase = "flicker";
          remaining = FLICKER_DURATION;
          setFlickering(true);
        } else {
          phase = "steady";
          remaining = FLICKER_INTERVAL;
          setFlickering(false);
        }
        schedule();
      }, remaining);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (timer !== undefined) {
          window.clearTimeout(timer);
          timer = undefined;
          remaining = Math.max(0, remaining - (performance.now() - startedAt));
        }
      } else if (timer === undefined) {
        schedule();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    schedule();
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [effectiveReducedMotion, hasEntered, preferenceLoaded, settings.spotlightFlickering, zoomed]);

  useEffect(() => {
    if (!showVisitorNotice) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    (settings.spotlightFlickering ? enableEffectsRef.current : disableFlickerRef.current)?.focus();

    const trapFocus = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        return;
      }
      if (event.key !== "Tab") return;

      const first = enableEffectsRef.current;
      const last = disableFlickerRef.current;
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", trapFocus);
    return () => dialog.removeEventListener("keydown", trapFocus);
  }, [settings.spotlightFlickering, showVisitorNotice]);

  useEffect(() => {
    if (settingsOpen) settingsPanelRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [settingsOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(false);
      else if (zoomed) return;
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed, step]);

  // Desktop-only camera drift. Three layers (background, paper stack, portrait) ease toward the
  // pointer at different strengths. The rAF loop only runs while values are still settling.
  useEffect(() => {
    zoomedRef.current = zoomed;
    if (!zoomed) settleCamera.current();
  }, [zoomed]);

  useEffect(() => {
    if (effectiveReducedMotion) settleCamera.current();
  }, [effectiveReducedMotion]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fine = window.matchMedia("(min-width: 900px) and (hover: hover) and (pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const layers = ([[".pf-par-bg", 2], [".pf-dossier-stack", 4], [".pf-track", 6]] as const).map(
      ([sel, k]) => ({ el: stage.querySelector<HTMLElement>(sel), k })
    );
    const c = { tx: 0, ty: 0, x: 0, y: 0, raf: 0 };
    const paint = (clear: boolean) => {
      for (const { el, k } of layers) {
        if (el) el.style.transform = clear ? "" : `translate3d(${(-c.x * k).toFixed(2)}px,${(-c.y * k * 0.6).toFixed(2)}px,0)`;
      }
    };
    const tick = () => {
      c.x += (c.tx - c.x) * 0.075;
      c.y += (c.ty - c.y) * 0.075;
      const rest = Math.abs(c.tx - c.x) + Math.abs(c.ty - c.y) < 0.003;
      if (rest) {
        c.x = c.tx;
        c.y = c.ty;
      }
      paint(rest && c.tx === 0 && c.ty === 0);
      c.raf = rest ? 0 : requestAnimationFrame(tick);
    };
    const run = () => {
      if (!c.raf) c.raf = requestAnimationFrame(tick);
    };
    const onMove = (e: WindowEventMap["pointermove"]) => {
      if (e.pointerType !== "mouse" || !zoomedRef.current || !fine.matches || calm.matches || stage.dataset.reducedMotion === "true") return;
      c.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      c.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      run();
    };
    settleCamera.current = () => {
      c.tx = 0;
      c.ty = 0;
      if (stage.dataset.reducedMotion === "true") {
        cancelAnimationFrame(c.raf);
        c.raf = 0;
        c.x = 0;
        c.y = 0;
        paint(true);
        return;
      }
      run();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(c.raf);
      paint(true);
    };
  }, []);

  const onPointerDown = (e: PointerEvent) => {
    if (!zoomed) drag.current = { x: e.clientX, active: true, moved: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (d.active && Math.abs(e.clientX - d.x) > 8) d.moved = true;
  };
  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  };
  const onWheel = (e: WheelEvent) => {
    if (zoomed) return;
    const now = performance.now();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (now - lastWheel.current < 450 || Math.abs(d) < 10) return;
    lastWheel.current = now;
    step(d > 0 ? 1 : -1);
  };

  const pick = (i: number) => {
    if (drag.current.moved) return;
    if (zoomed) setZoomed(false);
    else if (i === index) open();
    else setIndex(i);
  };

  const lit = zoomed ? index : hover ?? index;
  const litId = arrangedPortraits[lit].id;

  return (
    <>
      <span className="sr-only" role="status" aria-live="polite">
        {enteringBook ? "Opening Guild Records." : ""}
      </span>
      <section
        ref={stageRef}
        className="pf-stage"
        data-zoomed={zoomed}
        data-entered={entered}
        data-flickering={flickering && !effectiveReducedMotion}
        data-reduced-motion={effectiveReducedMotion}
        data-dust={settings.floatingDustParticles}
        data-page-hidden={!pageVisible}
        data-effects-dialog={showVisitorNotice}
        data-entering-book={enteringBook}
        aria-hidden={experienceBlocked || enteringBook}
        inert={experienceBlocked || enteringBook}
        aria-busy={enteringBook}
        aria-roledescription="carousel"
        aria-label="Portrait gallery"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current.active = false)}
        onTouchStart={onEntryTouchStart}
        onTouchEnd={onEntryTouchEnd}
        onTouchCancel={() => (entryTouchStart.current = null)}
        onWheel={onWheel}
        onClick={() => zoomed && setZoomed(false)}
      >
        <div className="pf-par-bg">
          <div className="pf-wall" style={{ transform: `translate3d(${-index * 14}px,0,0)` }} aria-hidden="true">
            {Array.from({ length: WALL_CELLS }, (_, c) => {
              const p = arrangedPortraits[c % n];
              return (
                <div
                  key={c}
                  className="pf-wall-cell"
                  data-lit={p.id === litId}
                  data-extra={c >= 16}
                  style={{ "--ww": `${44 + ((c * 7) % 4) * 12}px` } as CSSProperties}
                >
                  <PortraitArt data={p} seed={c % n} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="pf-vignette" aria-hidden="true" />
        <div className="pf-light" style={{ "--d": lit - index } as CSSProperties} aria-hidden="true">
          <div className="pf-cone" />
          <div className="pf-pool" />
        </div>

        <div className="pf-dust-layer" aria-hidden="true">
          {DUST_PARTICLES.map((particle, i) => (
            <span
              key={i}
              className="pf-dust"
              style={{
                "--x": `${particle.x}%`,
                "--y": `${particle.y}%`,
                "--size": `${particle.size}px`,
                "--duration": `${particle.duration}s`,
                "--delay": `${particle.delay}s`,
                "--drift": `${particle.drift}px`,
                "--alpha": particle.alpha,
              } as CSSProperties}
            />
          ))}
        </div>

        <div className="pf-track">
          {arrangedPortraits.map((p, i) => {
            const d = i - index;
            const a = Math.abs(d);
            const dim = Math.abs(i - lit);
            return (
              <button
                key={p.id}
                type="button"
                className="pf-portrait"
                aria-label={`Portrait ${i + 1} of ${n}`}
                tabIndex={a > 3 ? -1 : 0}
                data-lit={i === lit}
                data-zoom={zoomed && i === index}
                data-hidden={a > 3}
                data-mobile-hidden={a > 1}
                style={{ "--d": d, "--a": a, "--dim": dim === 0 ? 0 : Math.min(0.88, 0.5 + dim * 0.12) } as CSSProperties}
                onPointerEnter={(e) => e.pointerType === "mouse" && !zoomed && setHover(i)}
                onPointerLeave={() => setHover(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  pick(i);
                }}
              >
                <PortraitArt data={p} seed={i} />
                <span className="pf-shade" />
                <Image
                  className="pf-photo-frame"
                  src={photoFrame}
                  alt=""
                  aria-hidden="true"
                  width={1351}
                  height={1600}
                  unoptimized
                  draggable={false}
                />
              </button>
            );
          })}
        </div>

        <Dossier key={arrangedPortraits[index].id} open={zoomed} portraitId={arrangedPortraits[index].id} />

        {!zoomed && (
          <div
            className="pf-guild-ledger"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <ClosedLedgerBook
              href="/guild-records?entry=landing"
              onEnter={enterBook}
              isEntering={enteringBook}
            />
            <span className="pf-book-swipe-cue" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 20V4m-6 6 6-6 6 6" />
              </svg>
              <span>Swipe up to enter</span>
            </span>
          </div>
        )}

        <div className="pf-dots">
          {arrangedPortraits.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="pf-dot"
              aria-label={`Show portrait ${i + 1}`}
              aria-current={i === index}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
            />
          ))}
        </div>

        <button
          type="button"
          className="pf-back"
          onClick={(e) => {
            e.stopPropagation();
            setZoomed(false);
          }}
        >
          Return
        </button>

      </section>

      {entered && !zoomed && (
        <>
          <button
            ref={settingsButtonRef}
            type="button"
            className="pf-settings-button"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            aria-controls="pf-settings-panel"
            aria-label="Exhibition Settings"
            title="Exhibition Settings"
            data-reduced-motion={effectiveReducedMotion}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <Image
              className="pf-settings-icon"
              src={cogwheel}
              alt=""
              aria-hidden="true"
              width={22}
              height={22}
              unoptimized
            />
          </button>
          {settingsOpen && (
            <div
              ref={settingsPanelRef}
              id="pf-settings-panel"
              className="pf-settings-panel"
              role="dialog"
              aria-modal="false"
              aria-labelledby="pf-settings-title"
              data-reduced-motion={effectiveReducedMotion}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  setSettingsOpen(false);
                  settingsButtonRef.current?.focus();
                }
              }}
            >
              <p className="pf-settings-kicker">ARCHIVE / VISITOR SETTINGS</p>
              <h2 id="pf-settings-title">Exhibition settings</h2>
              <div className="pf-settings-options">
                {SETTINGS_OPTIONS.map((option) => (
                  <label className="pf-setting" key={option.key}>
                    <span className="pf-setting-copy">
                      <span className="pf-setting-label">{option.label}</span>
                      <span id={`pf-setting-${option.key}-description`} className="pf-setting-description">
                        {option.description}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label={option.label}
                      aria-describedby={`pf-setting-${option.key}-description`}
                      checked={settings[option.key]}
                      onChange={(event) => updateSetting(option.key, event.currentTarget.checked)}
                    />
                    <span className="pf-setting-switch" aria-hidden="true" />
                  </label>
                ))}
                <label className="pf-setting">
                  <span className="pf-setting-copy">
                    <span className="pf-setting-label">Background music</span>
                    <span id="pf-setting-music-description" className="pf-setting-description">
                      Play the archive’s background soundtrack.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label="Background music"
                    aria-describedby="pf-setting-music-description"
                    checked={isPlaying}
                    onChange={() => togglePlayback()}
                  />
                  <span className="pf-setting-switch" aria-hidden="true" />
                </label>
              </div>
            </div>
          )}
        </>
      )}

      {showVisitorNotice && (
        <div className="pf-effects-scrim">
          <div
            ref={dialogRef}
            className="pf-effects-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pf-effects-title"
            aria-describedby="pf-effects-intro pf-effects-description"
            tabIndex={-1}
            style={{ "--scroll-ratio": scrollPaper.width / scrollPaper.height } as CSSProperties}
          >
            <div className="pf-effects-scroll">
              <h2 id="pf-effects-title">A message from Calisa</h2>
              <div className="pf-effects-letter">
                <p className="pf-effects-salutation">Salutations!</p>
                <p id="pf-effects-intro">I hope you find this well, though I must offer you a warning.</p>
                <p id="pf-effects-description">
                  This place is a bit old, so be cautious of <strong>flashing or flickering lights</strong> and{" "}
                  <strong>subtle movements</strong>, particularly if you are sensitive to motion. I care for your
                  well-being and have taken precautionary measures to inform you before entering this place.
                </p>
                <p>
                  If you have acknowledged my warnings and still wish to proceed, you have the free will to choose what
                  is most comfortable for you.
                </p>
              </div>
              <div className="pf-effects-actions">
                <button ref={enableEffectsRef} type="button" onClick={() => chooseEffects(true)}>
                  Enter with visual effects
                </button>
                <button ref={disableFlickerRef} type="button" onClick={() => chooseEffects(false)}>
                  Enter without flickering
                </button>
              </div>
              <p className="pf-effects-signoff">
                <span>Sincerely,</span>
                <span className="pf-effects-signature">Calisa Aphelion</span>
              </p>
              <p className="pf-effects-ps">
                <em>P.S. Both choices enter the archive. Preferences can be changed at any time. :)</em>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}