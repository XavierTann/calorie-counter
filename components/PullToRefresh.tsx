"use client";

import { useEffect, useRef, useState } from "react";

const TRIGGER = 70; // px of (damped) pull needed to refresh
const MAX = 110;

// Pull down at the top of the page to reload, like a native app. The home-screen app has no browser
// pull-to-refresh of its own, so this is how you pick up calories that Apple Health synced since you opened it.
export function PullToRefresh({ onRefresh, disabled }: { onRefresh: () => Promise<unknown>; disabled?: boolean }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);
  const busyRef = useRef(false);
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;

  useEffect(() => {
    if (disabled) return;
    const set = (n: number) => {
      pullRef.current = n;
      setPull(n);
    };
    const down = (e: TouchEvent) => {
      start.current = window.scrollY <= 0 && !busyRef.current && e.touches.length === 1 ? e.touches[0].clientY : null;
    };
    const move = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) return set(0);
      e.preventDefault(); // stop the page bouncing while we pull
      set(Math.min(MAX, dy * 0.5));
    };
    const up = async () => {
      if (start.current === null) return;
      start.current = null;
      if (pullRef.current < TRIGGER) return set(0);
      busyRef.current = true;
      setBusy(true);
      set(TRIGGER * 0.7);
      try {
        await Promise.all([refresh.current(), new Promise((r) => setTimeout(r, 500))]);
      } finally {
        busyRef.current = false;
        setBusy(false);
        set(0);
      }
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
    return () => {
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchcancel", up);
    };
  }, [disabled]);

  if (!pull && !busy) return null;
  const ready = pull >= TRIGGER;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-20 flex justify-center"
      style={{ top: `calc(env(safe-area-inset-top) + ${pull - 36}px)`, transition: start.current === null ? "top 200ms ease" : "none" }}
      role="status"
      aria-live="polite"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-lg text-brand shadow-md ring-1 ring-line">
        {busy ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-label="Refreshing" />
        ) : (
          <span style={{ transform: `rotate(${ready ? 180 : 0}deg)`, transition: "transform 150ms" }} aria-label={ready ? "Release to refresh" : "Pull to refresh"}>
            ↓
          </span>
        )}
      </div>
    </div>
  );
}
