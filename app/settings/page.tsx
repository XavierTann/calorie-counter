"use client";

import { AppHeader } from "@/components/AppHeader";
import { DataNotice } from "@/components/DataNotice";
import { useEffect, useState } from "react";
import type { HomeUnit, Settings } from "@/lib/types";

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/settings").then(async (r) => {
      if (r.status === 401) return (window.location.href = "/login");
      setS(await r.json());
    });
  }, []);

  if (!s) return <p className="p-6 text-ink-3">Loading…</p>;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setSaved(false);
    setS({ ...s, [k]: v });
  };
  const setUnit = (i: number, patch: Partial<HomeUnit>) =>
    set("homeUnits", s.homeUnits.map((u, j) => (j === i ? { ...u, ...patch } : u)));

  async function save() {
    const r = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(s) });
    setS(await r.json());
    setSaved(true);
  }

  return (
    <main className="mx-auto max-w-xl pb-32" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <AppHeader center={<h1 className="text-lg font-semibold">Settings</h1>} />
      <div className="px-4">

      <Card title="Daily targets">
        <div className="grid grid-cols-2 gap-3">
          <Num label="Calories (kcal)" value={s.targetKcal} onChange={(v) => set("targetKcal", v)} />
          <Num label="Protein (g)" value={s.proteinG} onChange={(v) => set("proteinG", v)} />
          <Num label="Carbs (g)" value={s.carbsG} onChange={(v) => set("carbsG", v)} />
          <Num label="Fat (g)" value={s.fatG} onChange={(v) => set("fatG", v)} />
        </div>
      </Card>

      <Card title="How your budget is calculated">
        <div className="space-y-2">
          <Radio
            checked={s.budgetMode === "target_plus_active"}
            onChange={() => set("budgetMode", "target_plus_active")}
            title="Target + Garmin active calories (recommended)"
            desc="Your calorie target already covers a normal day. Workouts and steps tracked by Garmin add to it as the day goes on. Works all day, including mornings."
          />
          <Radio
            checked={s.budgetMode === "total_minus_deficit"}
            onChange={() => set("budgetMode", "total_minus_deficit")}
            title="Garmin total burned − deficit"
            desc="Budget = Garmin's total calories minus your deficit. Most accurate at the end of the day; looks low in the morning because resting calories build up through the day."
          />
          <Radio checked={s.budgetMode === "fixed"} onChange={() => set("budgetMode", "fixed")} title="Fixed target" desc="Ignore Garmin." />
          {s.budgetMode === "total_minus_deficit" && <Num label="Deficit (kcal)" value={s.deficit} onChange={(v) => set("deficit", v)} />}
        </div>
      </Card>

      <Card title="Home cooking: tablespoon sizes">
        <p className="mb-3 text-sm text-ink-2">
          Measure mum&apos;s cooking in heaped tablespoons (rice by the bowl). To calibrate: put a bowl on a kitchen scale, press tare,
          add one tablespoon of the dish, then look up the kcal for that many grams (HPB / Google &quot;kcal per 100g&quot;) and update the
          numbers here. Do it once per dish type. The AI uses these when you type things like &quot;1 bowl rice, 3 tbsp kailan&quot;.
        </p>
        <ul className="space-y-3">
          {s.homeUnits.map((u, i) => (
            <li key={i} className="rounded-xl bg-track p-3">
              <div className="flex gap-2">
                <input
                  value={u.label}
                  onChange={(e) => setUnit(i, { label: e.target.value })}
                  className="flex-1 rounded-lg bg-card px-2 py-1.5"
                  aria-label="Unit name"
                />
                <button onClick={() => set("homeUnits", s.homeUnits.filter((_, j) => j !== i))} className="px-2 text-ink-3" aria-label="Remove unit">×</button>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                <Num small label="kcal" value={u.kcal} onChange={(v) => setUnit(i, { kcal: v })} />
                <Num small label="P g" value={u.protein} onChange={(v) => setUnit(i, { protein: v })} />
                <Num small label="C g" value={u.carbs} onChange={(v) => setUnit(i, { carbs: v })} />
                <Num small label="F g" value={u.fat} onChange={(v) => setUnit(i, { fat: v })} />
              </div>
            </li>
          ))}
        </ul>
        <button
          onClick={() => set("homeUnits", [...s.homeUnits, { id: `unit-${Date.now()}`, label: "Tbsp of new dish", kcal: 100, protein: 5, carbs: 5, fat: 5 }])}
          className="mt-3 rounded-full bg-track px-3 py-1.5 text-sm"
        >
          + Add dish type
        </button>
      </Card>

      <AppleHealthSync origin={origin} />

      <Card title="Where the calories come from">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
          <li>Your Foods (your own numbers and corrections)</li>
          <li>Your home tablespoon sizes</li>
          <li>
            Official databases for the cuisine: HPB SG FoodID (Singapore), Korea MFDS dish database, Indian Nutrient Databank, then
            USDA FoodData Central
          </li>
          <li>An AI estimate, only if none of the above has it</li>
        </ol>
        <div className="mt-3">
          <DataNotice />
        </div>
      </Card>

      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-card/95 backdrop-blur" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}>
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 pt-3">
          <button onClick={save} className="h-12 flex-1 rounded-xl bg-brand font-semibold text-brand-ink">Save settings</button>
          {saved && <span className="text-sm text-good">Saved ✓</span>}
        </div>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-line">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Num({ label, value, onChange, small }: { label: string; value: number; onChange: (v: number) => void; small?: boolean }) {
  return (
    <label className={`block text-ink-2 ${small ? "text-xs" : "text-sm"}`}>
      {label}
      <input
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="tabular mt-1 w-full rounded-lg bg-card px-2 py-1.5 text-ink ring-1 ring-line"
      />
    </label>
  );
}

function Radio({ checked, onChange, title, desc }: { checked: boolean; onChange: () => void; title: string; desc: string }) {
  return (
    <label className={`flex gap-3 rounded-xl p-3 ring-1 ${checked ? "ring-brand" : "ring-line"}`}>
      <input type="radio" checked={checked} onChange={onChange} className="mt-1 accent-[var(--brand)]" />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-ink-2">{desc}</span>
      </span>
    </label>
  );
}

function AppleHealthSync({ origin }: { origin: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me").then(async (r) => r.ok && setToken((await r.json()).syncToken));
  }, []);

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setShown(true);
    }
  }

  async function rotate() {
    if (!confirm("Make a new token? Your current iPhone Shortcut will stop working until you paste the new one in.")) return;
    const r = await fetch("/api/me", { method: "POST" });
    if (r.ok) {
      setToken((await r.json()).syncToken);
      setShown(true);
    }
  }

  const url = `${origin}/api/energy/sync`;
  return (
    <Card title="Apple Health sync (Garmin calories)">
      <p className="text-sm text-ink-2">
        Garmin Connect writes your calories into Apple Health. An iPhone Shortcut then reads them and sends them here. The token below is
        yours alone, so keep it private.
      </p>
      <div className="mt-3 space-y-2 text-sm">
        <CopyRow label="URL" value={url} onCopy={() => copy("url", url)} copied={copied === "url"} />
        <CopyRow
          label="Token"
          value={token ? (shown ? token : "•".repeat(16)) : "…"}
          onCopy={() => token && copy("token", token)}
          copied={copied === "token"}
          extra={
            <button onClick={() => setShown((v) => !v)} className="rounded-lg px-2 py-1 text-xs text-ink-2 active:bg-card">
              {shown ? "Hide" : "Show"}
            </button>
          }
        />
      </div>
      <details className="mt-3 text-sm text-ink-2">
        <summary className="cursor-pointer font-medium text-ink">How to set up the Shortcut</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          <li>Garmin Connect app → Settings → Connected Apps → Apple Health → turn on Active Energy and Resting Energy.</li>
          <li>
            Shortcuts app → new shortcut:
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>Find Health Samples: Active Energy, start date Today → Calculate Statistics: Sum</li>
              <li>Find Health Samples: Resting Energy, start date Today → Calculate Statistics: Sum</li>
              <li>
                Get Contents of URL: the URL above, Method POST, Header <code>Authorization</code> = <code>Bearer</code> + a space + your token,
                Request Body JSON: <code>active</code> = first sum, <code>resting</code> = second sum
              </li>
            </ul>
          </li>
          <li>Automation tab → Time of Day (e.g. every hour) → run the shortcut, with &quot;Ask before running&quot; off.</li>
        </ol>
        <p className="mt-2">Or tap &quot;Burned&quot; on the Today screen and type the numbers in yourself.</p>
      </details>
      <button onClick={rotate} className="mt-3 text-sm text-ink-3 underline">Make a new token</button>
    </Card>
  );
}

function CopyRow({ label, value, onCopy, copied, extra }: { label: string; value: string; onCopy: () => void; copied: boolean; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-track p-2 pl-3">
      <span className="w-11 shrink-0 text-xs text-ink-3">{label}</span>
      <code className="min-w-0 flex-1 truncate text-xs">{value}</code>
      {extra}
      <button onClick={onCopy} className="rounded-lg bg-card px-2.5 py-1 text-xs font-semibold ring-1 ring-line active:opacity-70">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
