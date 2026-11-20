"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import "./SceneTransitionOverlay.css";

export const GUILD_RECORDS_TRANSITION_EVENT = "guild-records:scene-transition";

type TransitionPhase = "idle" | "covering" | "revealing";

export default function SceneTransitionOverlay() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<TransitionPhase>("idle");
  const pendingNavigation = useRef(false);

  useEffect(() => {
    const beginTransition = () => {
      pendingNavigation.current = true;
      setPhase("covering");
    };

    window.addEventListener(GUILD_RECORDS_TRANSITION_EVENT, beginTransition);
    return () =>
      window.removeEventListener(GUILD_RECORDS_TRANSITION_EVENT, beginTransition);
  }, []);

  useEffect(() => {
    if (!pendingNavigation.current || pathname !== "/guild-records") return;
    pendingNavigation.current = false;
    setPhase("revealing");
  }, [pathname]);

  return (
    <div
      className="scene-transition-overlay"
      data-phase={phase}
      aria-hidden="true"
      onTransitionEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.propertyName === "opacity" &&
          phase === "revealing"
        ) {
          setPhase("idle");
        }
      }}
    />
  );
}
