"use client";

import { useEffect, useState } from "react";

type State = "loading" | "unsupported" | "install-first" | "not-configured" | "blocked" | "off" | "on";

function keyToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

// Turns the 9am weigh-in reminder on or off for this device.
export function ReminderCard() {
  const [state, setState] = useState<State>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState(ios && !standalone ? "install-first" : "unsupported");
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      const r = await fetch(`/api/push/subscribe${sub ? `?endpoint=${encodeURIComponent(sub.endpoint)}` : ""}`);
      if (!r.ok) return setState("unsupported");
      const j = await r.json();
      setPublicKey(j.publicKey);
      if (!j.configured) return setState("not-configured");
      if (Notification.permission === "denied") return setState("blocked");
      setState(sub && j.subscribed ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("blocked");
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey!) }));
      const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!r.ok) throw new Error("Couldn't save");
      setState("on");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't turn on reminders");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState("off");
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    const r = await fetch("/api/push/test", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setMessage(j.sent ? "Sent! It should pop up in a few seconds." : "Couldn't send. Try turning reminders off and on again.");
    setBusy(false);
  }

  const text: Record<State, string> = {
    loading: "Checking…",
    unsupported: "This browser can't show reminders.",
    "install-first": "On iPhone, reminders only work from the home-screen app: tap Share → Add to Home Screen, open Makan Log from there, then come back here.",
    "not-configured": "Reminders aren't set up on the server yet (VAPID keys missing).",
    blocked: "Notifications are blocked. Turn them on in iPhone Settings → Notifications → Makan Log.",
    off: "Get a nudge at about 9am on days you haven't weighed in yet.",
    on: "On for this device. You'll get a nudge at about 9am on days you haven't weighed in yet.",
  };

  return (
    <section className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-line">
      <div className="flex items-center gap-3">
        <span className="meal-breakfast flex h-9 w-9 items-center justify-center rounded-xl text-lg" aria-hidden>
          🔔
        </span>
        <div className="flex-1">
          <h2 className="font-semibold">Morning reminder</h2>
          <p className="text-sm text-ink-2">{text[state]}</p>
        </div>
      </div>
      {(state === "off" || state === "on") && (
        <div className="mt-3 flex gap-2">
          {state === "off" ? (
            <button disabled={busy} onClick={turnOn} className="h-10 flex-1 rounded-xl bg-brand text-sm font-semibold text-white disabled:opacity-40">
              Turn on 9am reminder
            </button>
          ) : (
            <>
              <button disabled={busy} onClick={test} className="h-10 flex-1 rounded-xl bg-track text-sm font-semibold active:opacity-70 disabled:opacity-40">
                Send a test
              </button>
              <button disabled={busy} onClick={turnOff} className="h-10 rounded-xl px-4 text-sm text-ink-2 ring-1 ring-line active:bg-track disabled:opacity-40">
                Turn off
              </button>
            </>
          )}
        </div>
      )}
      {message && <p className="mt-2 text-sm text-ink-2">{message}</p>}
    </section>
  );
}
