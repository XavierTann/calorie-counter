"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/", label: "Today", icon: "🍽️" },
  { href: "/weight", label: "Weight", icon: "⚖️" },
  { href: "/foods", label: "Foods", icon: "📖" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

// Top bar with a menu button on the left, `center` in the middle and `right` on the right.
export function AppHeader({ center, right }: { center: React.ReactNode; right?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open || username) return;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setUsername(j.username))
      .catch(() => {});
  }, [open, username]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="grid grid-cols-[1fr_auto_1fr] items-center px-3 pt-4 pb-2">
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-2 active:bg-track">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h10" />
          </svg>
        </button>
        <div className="flex items-center justify-center">{center}</div>
        <div className="flex justify-end">{right}</div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)}>
          <nav
            aria-label="Main"
            className="drawer-in flex h-full w-64 flex-col bg-card p-4 shadow-xl"
            style={{ paddingTop: "max(env(safe-area-inset-top), 20px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center gap-2 px-2">
              <span className="text-2xl">🥟</span>
              <span className="text-lg font-bold">Makan Log</span>
            </div>
            <ul className="space-y-1">
              {LINKS.map((l) => {
                const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${active ? "bg-brand-soft font-semibold text-brand-strong" : "text-ink-2 active:bg-track"}`}
                    >
                      <span className="text-lg">{l.icon}</span>
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-auto border-t border-line pt-3" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
              {username && <p className="px-3 pb-2 text-sm text-ink-3">Logged in as <span className="font-semibold text-ink-2">{username}</span></p>}
              <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-ink-2 active:bg-track">
                <span className="text-lg">👋</span>
                Log out
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
