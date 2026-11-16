"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { KCAL_PER_KG, MAX_DEFICIT } from "@/lib/budget";
import type { Settings } from "@/lib/types";

const DAY = 86_400_000;
const localDate = (d = new Date()) => new Intl.DateTimeFormat("en-CA").format(d);
const daysUntil = (date: string) => Math.round((new Date(date + "T12:00:00").getTime() - new Date(localDate() + "T12:00:00").getTime()) / DAY);
const PACES = [
  { kg: 0.25, label: "Gentle", sub: "0.25 kg/wk" },
  { kg: 0.5, label: "Steady", sub: "0.5 kg/wk" },
  { kg: 0.75, label: "Faster", sub: "0.75 kg/wk" },
];

const SKIP_KEY = "goal-setup-skipped";
export function goalSetupSkipped() {
  try {
    return localStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

// Goal weight + date → the daily deficit the budget will use. Shown on first run ("first") and from the Weight page ("edit").
export function GoalSetup({
  settings,
  mode = "first",
  onClose,
  onSaved,
}: {
  settings: Settings;
  mode?: "first" | "edit";
  onClose: () => void;
  onSaved: () => void;
}) {
  const [now, setNow] = useState("");
  const [hadToday, setHadToday] = useState<number | null>(null);
  const [goal, setGoal] = useState(settings.goalWeightKg ? String(settings.goalWeightKg) : "");
  const [date, setDate] = useState(settings.goalDate ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill with the latest weigh-in.
  useEffect(() => {
    fetch("/api/weight").then(async (r) => {
      if (!r.ok) return;
      const j = (await r.json()) as { weights: { date: string; kg: number }[] };
      const last = j.weights[j.weights.length - 1];
      if (last) setNow((v) => v || String(last.kg));
      const today = j.weights.find((w) => w.date === localDate());
      if (today) setHadToday(today.kg);
    });
  }, []);

  const cur = Number(now);
  const target = Number(goal);
  const toLose = cur > 0 && target > 0 ? Math.round((cur - target) * 10) / 10 : null;
  const days = date ? daysUntil(date) : null;
  const needed = toLose !== null && toLose > 0 && days && days > 0 ? (toLose * KCAL_PER_KG) / days : null;
  const deficit = needed === null ? null : Math.min(needed, MAX_DEFICIT);
  const perWeek = deficit === null ? null : (deficit * 7) / KCAL_PER_KG;

  const pickPace = (kgPerWeek: number) => {
    if (toLose === null || toLose <= 0) return;
    const weeks = toLose / kgPerWeek;
    setDate(localDate(new Date(Date.now() + Math.ceil(weeks * 7) * DAY)));
  };
  const paceOf = (kgPerWeek: number) => toLose !== null && toLose > 0 && days !== null && Math.abs(days - Math.ceil((toLose / kgPerWeek) * 7)) <= 1;

  function skip() {
    if (mode === "first") {
      try {
        localStorage.setItem(SKIP_KEY, "1");
      } catch {}
    }
    onClose();
  }

  async function removeGoal() {
    if (!confirm("Remove your goal? The budget will go back to your fixed deficit.")) return;
    setSaving(true);
    const r = await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...settings, goalWeightKg: null, goalDate: null }),
    });
    if (r.ok) onSaved();
    else setSaving(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (hadToday !== cur) {
        const w = await fetch("/api/weight", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: localDate(), kg: cur }) });
        if (!w.ok) throw new Error((await w.json()).error ?? "Couldn't save your weight");
      }
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        // Budget = Apple Health burned − the deficit worked out from this goal.
        body: JSON.stringify({ ...settings, goalWeightKg: target, goalDate: date, budgetMode: "total_minus_deficit", deficitMode: "auto" }),
      });
      if (!r.ok) throw new Error("Couldn't save your goal");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setSaving(false);
    }
  }

  const field = "tabular min-w-0 flex-1 bg-transparent py-2.5 text-xl font-semibold outline-none placeholder:text-ink-3";
  const valid = cur >= 20 && cur <= 400 && target >= 20 && target <= 400 && days !== null && days >= 1;

  return (
    <Sheet title={mode === "first" ? "Set your goal" : "Your goal"} onClose={skip}>
      <p className="text-sm text-ink-2">
        {mode === "first" ? "Takes 20 seconds. " : ""}Your goal weight and date set how big your daily deficit is.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-sm text-ink-2">
          Weight now
          <span className="mt-1 flex items-center rounded-xl bg-track px-3 focus-within:ring-2 focus-within:ring-brand">
            <input autoFocus={mode === "first"} type="number" inputMode="decimal" step="0.1" value={now} onChange={(e) => setNow(e.target.value)} placeholder="0.0" className={field} />
            <span className="text-ink-3">kg</span>
          </span>
        </label>
        <label className="text-sm text-ink-2">
          Goal weight
          <span className="mt-1 flex items-center rounded-xl bg-track px-3 focus-within:ring-2 focus-within:ring-brand">
            <input type="number" inputMode="decimal" step="0.1" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="0.0" className={field} />
            <span className="text-ink-3">kg</span>
          </span>
        </label>
      </div>

      {toLose !== null && toLose > 0 && (
        <div className="mt-3">
          <div className="text-sm text-ink-2">How fast?</div>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {PACES.map((p) => (
              <button
                key={p.kg}
                type="button"
                onClick={() => pickPace(p.kg)}
                className={`rounded-xl px-2 py-2 text-center ring-1 ${paceOf(p.kg) ? "bg-brand text-white ring-brand" : "bg-card ring-line active:opacity-70"}`}
              >
                <div className="text-sm font-semibold">{p.label}</div>
                <div className={`text-xs ${paceOf(p.kg) ? "text-white/80" : "text-ink-3"}`}>{p.sub}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="mt-3 block text-sm text-ink-2">
        Reach it by <span className="text-ink-3">(pick a pace above, or a date)</span>
        {/* An empty date input on iPhone renders as a blank sliver, so draw our own label over it. */}
        <span className="relative mt-1 block">
          <input
            type="date"
            value={date}
            min={localDate(new Date(Date.now() + DAY))}
            onChange={(e) => setDate(e.target.value)}
            className={`block min-h-12 w-full appearance-none rounded-xl bg-track px-3 py-2.5 text-left outline-none focus:ring-2 focus:ring-brand ${date ? "text-ink" : "text-transparent"}`}
          />
          {!date && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-3">📅 Choose a date</span>}
        </span>
      </label>

      {valid && toLose !== null && (
        <div className="mt-3 rounded-xl bg-brand-soft p-3 text-sm">
          {toLose <= 0 ? (
            <p>You&apos;re already at or under this goal, so the app will budget for maintenance (no deficit).</p>
          ) : (
            <>
              <p>
                <span className="tabular text-lg font-semibold text-brand-strong">≈ {Math.round(deficit!).toLocaleString()} kcal/day</span> deficit, about{" "}
                {perWeek!.toFixed(2).replace(/0$/, "")} kg a week.
              </p>
              <p className="mt-1 text-xs text-ink-2">
                {toLose} kg × {KCAL_PER_KG.toLocaleString()} kcal ÷ {days} days. Your daily budget = calories burned (from Apple Health) − this
                deficit, recalculated from your weigh-ins.
              </p>
              {needed! > MAX_DEFICIT && (
                <p className="mt-1 text-xs text-over">
                  That date needs {Math.round(needed!).toLocaleString()} kcal/day, so it&apos;s capped at {MAX_DEFICIT.toLocaleString()} for safety. Pick a
                  later date or a slower pace.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-over">{error}</p>}
      <button disabled={!valid || saving} onClick={save} className="mt-3 h-12 w-full rounded-xl bg-brand font-semibold text-white disabled:opacity-40">
        {saving ? "Saving…" : "Save goal"}
      </button>
      {!valid && cur > 0 && target > 0 && !date && <p className="mt-2 text-xs text-ink-3">Pick a pace or a date to save.</p>}
      {mode === "edit" && settings.goalWeightKg !== null ? (
        <button disabled={saving} onClick={removeGoal} className="mt-1 h-11 w-full rounded-xl text-sm text-over active:bg-track">
          Remove goal
        </button>
      ) : (
        <button onClick={skip} className="mt-1 h-11 w-full rounded-xl text-sm text-ink-2 active:bg-track">
          {mode === "first" ? "Not now (set it later on the Weight page)" : "Cancel"}
        </button>
      )}
    </Sheet>
  );
}
