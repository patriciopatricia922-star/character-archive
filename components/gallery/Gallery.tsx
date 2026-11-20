"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent, WheelEvent } from "react";
import { portraits as defaultPortraits, type PortraitData } from "../../data/portraits";
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
const FLICKER_INTERVAL = 15 * 60 * 1000;
const FLICKER_DURATION = 10 * 1000;

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
  const n = portraits.length;
  const [index, setIndex] = useState(Math.floor(n / 2));
  const [hover, setHover] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [effectPreference, setEffectPreference] = useState<boolean | null>(null);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [flickering, setFlickering] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const drag = useRef({ x: 0, active: false, moved: false });
  const lastWheel = useRef(0);
  const stageRef = useRef<HTMLElement>(null);
  const zoomedRef = useRef(false);
  const settleCamera = useRef<() => void>(() => {});
  const dialogRef = useRef<HTMLDivElement>(null);
  const enableEffectsRef = useRef<HTMLButtonElement>(null);
  const disableFlickerRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const showEffectsDialog = preferenceLoaded && (effectPreference === null || settingsOpen);
  const entered = preferenceLoaded && effectPreference !== null;
  const experienceBlocked = !preferenceLoaded || showEffectsDialog;

  const step = useCallback(
    (d: number) => setIndex((i) => Math.max(0, Math.min(n - 1, i + d))),
    [n]
  );
  const open = () => {
    setFlickering(false);
    setZoomed(true);
    onSelect?.(portraits[index].id);
  };

  const chooseEffects = (enabled: boolean) => {
    try {
      window.sessionStorage.setItem(EFFECTS_PREFERENCE_KEY, enabled ? "enabled" : "disabled");
    } catch (error) {
      console.warn("Could not save the visual-effects preference for this session.", error);
    }
    setEffectPreference(enabled);
    setFlickering(false);
    setSettingsOpen(false);
    window.requestAnimationFrame(() => settingsButtonRef.current?.focus());
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      let preference: string | null;
      try {
        preference = window.sessionStorage.getItem(EFFECTS_PREFERENCE_KEY);
      } catch (error) {
        console.warn("Could not read the visual-effects preference for this session.", error);
        setPreferenceLoaded(true);
        return;
      }
      if (preference === "enabled") setEffectPreference(true);
      else if (preference === "disabled") setEffectPreference(false);
      setPreferenceLoaded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const updatePageVisibility = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", updatePageVisibility);
    return () => document.removeEventListener("visibilitychange", updatePageVisibility);
  }, []);

  useEffect(() => {
    if (!preferenceLoaded || effectPreference !== true || showEffectsDialog || zoomed) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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
  }, [effectPreference, preferenceLoaded, showEffectsDialog, zoomed]);

  useEffect(() => {
    if (!showEffectsDialog) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    (effectPreference ? enableEffectsRef.current : disableFlickerRef.current)?.focus();

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
  }, [effectPreference, showEffectsDialog]);

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
      if (e.pointerType !== "mouse" || !zoomedRef.current || !fine.matches || calm.matches) return;
      c.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      c.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      run();
    };
    settleCamera.current = () => {
      c.tx = 0;
      c.ty = 0;
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
  const litId = portraits[lit].id;

  return (
    <>
      <section
        ref={stageRef}
        className="pf-stage"
        data-zoomed={zoomed}
        data-entered={entered}
        data-flickering={flickering}
        data-page-hidden={!pageVisible}
        data-effects-dialog={showEffectsDialog}
        aria-hidden={experienceBlocked}
        inert={experienceBlocked}
        aria-roledescription="carousel"
        aria-label="Portrait gallery"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current.active = false)}
        onWheel={onWheel}
        onClick={() => zoomed && setZoomed(false)}
      >
        <div className="pf-par-bg">
          <div className="pf-wall" style={{ transform: `translate3d(${-index * 14}px,0,0)` }} aria-hidden="true">
            {Array.from({ length: WALL_CELLS }, (_, c) => {
              const p = portraits[c % n];
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
          {portraits.map((p, i) => {
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
              </button>
            );
          })}
        </div>

        <Dossier key={portraits[index].id} open={zoomed} portraitId={portraits[index].id} />

        <div className="pf-dots">
          {portraits.map((p, i) => (
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

        {entered && !zoomed && (
          <button
            ref={settingsButtonRef}
            type="button"
            className="pf-effects-settings"
            aria-haspopup="dialog"
            aria-label={`Change visual-effects preference (currently ${effectPreference ? "enabled" : "disabled"})`}
            onClick={(event) => {
              event.stopPropagation();
              setFlickering(false);
              setSettingsOpen(true);
            }}
          >
            Effects · {effectPreference ? "On" : "Off"}
          </button>
        )}
      </section>

      {showEffectsDialog && (
        <div className="pf-effects-scrim">
          <div
            ref={dialogRef}
            className="pf-effects-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pf-effects-title"
            aria-describedby="pf-effects-description"
            tabIndex={-1}
          >
            <p className="pf-effects-eyebrow">Before entering the archive</p>
            <h2 id="pf-effects-title">VISUAL EFFECTS WARNING</h2>
            <p id="pf-effects-description">
              This experience contains occasional spotlight flickering and animated visual effects. These effects may cause
              discomfort or trigger symptoms in individuals with photosensitivity or photosensitive epilepsy.
            </p>
            <p className="pf-effects-question">Would you like to continue with these visual effects enabled?</p>
            <div className="pf-effects-actions">
              <button ref={enableEffectsRef} type="button" className="pf-effects-yes" onClick={() => chooseEffects(true)}>
                YES — Continue with effects
              </button>
              <button ref={disableFlickerRef} type="button" className="pf-effects-no" onClick={() => chooseEffects(false)}>
                NO — Continue without flickering
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}