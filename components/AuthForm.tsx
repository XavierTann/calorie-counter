"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Buddy } from "./Buddy";
import { DataNotice } from "./DataNotice";

// Shared log-in / sign-up form.
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [inviteRequired, setInviteRequired] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signup) return;
    fetch("/api/signup")
      .then((r) => r.json())
      .then((j) => setInviteRequired(!!j.inviteRequired))
      .catch(() => {});
  }, [signup]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch(signup ? "/api/signup" : "/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password, invite }),
    }).catch(() => null);
    if (r?.ok) {
      window.location.href = "/";
      return;
    }
    setBusy(false);
    setError(r ? ((await r.json().catch(() => ({}))).error ?? "Something went wrong") : "Can't reach the server");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="flex flex-col items-center text-center">
        <Buddy mood="happy" size={88} />
        <h1 className="mt-2 text-2xl font-bold">Makan Log</h1>
        <p className="mt-1 text-sm text-ink-2">{signup ? "Create your account" : "Log in to your food diary"}</p>
      </div>
      <form className="mt-6 space-y-3" onSubmit={submit}>
        <label className="block text-sm text-ink-2">
          Username
          <input
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block text-sm text-ink-2">
          Password
          <input
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
          {signup && <span className="mt-1 block text-xs text-ink-3">At least 8 characters</span>}
        </label>
        {signup && inviteRequired && (
          <label className="block text-sm text-ink-2">
            Invite code
            <input autoCapitalize="none" autoCorrect="off" value={invite} onChange={(e) => setInvite(e.target.value)} className={inputCls} />
          </label>
        )}
        {error && <p className="text-sm text-over">{error}</p>}
        <button disabled={busy || !username || !password} className="h-12 w-full rounded-xl bg-brand font-semibold text-white disabled:opacity-40">
          {busy ? "…" : signup ? "Sign up" : "Log in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">
        {signup ? "Already have an account? " : "New here? "}
        <Link href={signup ? "/login" : "/signup"} className="font-semibold text-brand-strong">
          {signup ? "Log in" : "Create an account"}
        </Link>
      </p>
      <div className="mt-10">
        <DataNotice compact />
      </div>
    </main>
  );
}

const inputCls = "mt-1 w-full rounded-xl bg-card px-3 py-3 text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand";
