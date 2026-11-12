"use client";

import { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold">Makan Log</h1>
      <form
        className="mt-6 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
          if (r.ok) window.location.href = "/";
          else setError("Wrong password");
        }}
      >
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-xl bg-card px-3 py-3 ring-1 ring-line outline-none focus:ring-2 focus:ring-brand"
        />
        {error && <p className="text-sm text-over">{error}</p>}
        <button className="h-12 w-full rounded-xl bg-brand font-semibold text-brand-ink">Log in</button>
      </form>
    </main>
  );
}
