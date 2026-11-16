"use client";

import { useEffect, useState } from "react";

// iOS Safari doesn't shrink the page when the keyboard opens, so a sheet pinned to the bottom ends up behind it.
// Size the overlay to the *visual* viewport (the part above the keyboard) instead.
function useVisibleArea() {
  const [area, setArea] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setArea({ top: vv.offsetTop, height: vv.height });
      // Keep whatever you're typing in on screen.
      const el = document.activeElement;
      if (el instanceof HTMLElement && el.matches("input, textarea")) requestAnimationFrame(() => el.scrollIntoView({ block: "nearest" }));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return area;
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const area = useVisibleArea();
  const keyboardOpen = area !== null && typeof window !== "undefined" && window.innerHeight - area.height > 100;
  return (
    <div
      className="fixed inset-x-0 z-30 flex items-end justify-center bg-black/40"
      style={area ? { top: area.top, height: area.height } : { top: 0, bottom: 0 }}
      onClick={onClose}
    >
      <div
        className="sheet-in w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl bg-card p-4"
        style={{ paddingBottom: keyboardOpen ? 12 : "max(env(safe-area-inset-bottom), 16px)", maxHeight: area ? "calc(100% - max(env(safe-area-inset-top), 12px))" : "88dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-ink-2 active:bg-track">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
