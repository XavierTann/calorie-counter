"use client";

import Link from "next/link";
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
    <main className="mx-auto max-w-xl px-4 pb-32" style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}>
      <div className="flex items-center justify-between py-2">
        <Link href="/" className="rounded-full px-2 py-1 text-ink-2 active:bg-track">‹ Diary</Link>
        <h1 className="text-lg font-semibold">Settings</h1>
        <span className="w-14" />
      </div>

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

      <Card title="Home cooking: scoop sizes">
        <p className="mb-3 text-sm text-ink-2">
          One &quot;scoop&quot; = one scoop with the family serving spoon. To calibrate: put a bowl on a kitchen scale, press tare, add one
          scoop, then look up the grams (HPB / Google &quot;kcal per 100g&quot;) and update the numbers here. Do it once per dish type.
          The AI also uses these when you type things like &quot;2 scoops kailan&quot;.
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
          onClick={() => set("homeUnits", [...s.homeUnits, { id: `unit-${Date.now()}`, label: "New scoop type", kcal: 100, protein: 5, carbs: 5, fat: 5 }])}
          className="mt-3 rounded-full bg-track px-3 py-1.5 text-sm"
        >
          + Add scoop type
        </button>
      </Card>

      <Card title="Garmin sync">
        <p className="text-sm text-ink-2">
          Garmin doesn&apos;t give personal accounts API access, so calories come in through your phone&apos;s health app or a sync script.
          Send a POST request to:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-track p-3 text-xs">{`POST ${origin}/api/energy/sync
Authorization: Bearer <INGEST_TOKEN>
Content-Type: application/json

{"active": 650, "resting": 1650}`}</pre>
        <p className="mt-2 text-sm text-ink-2">
          Set up an iPhone Shortcut (Garmin → Apple Health → this app) that sends this every hour. Steps are in the README. You can also tap
          &quot;Burned&quot; on the diary screen to type it in.
        </p>
      </Card>

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
