"use client";

import { useEffect, useState } from "react";
import { autoDeficit, type WeightPoint } from "@/lib/budget";
import type { Settings } from "@/lib/types";

const FIXED = [200, 300, 400, 500];
const todaySG = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date());

// How much under your burn you eat each day: worked out from your goal, or a fixed number.
export function DeficitCard({ settings, weights, onChange, onEditGoal }: { settings: Settings; weights: WeightPoint[]; onChange: (s: Settings) => void; onEditGoal: () => void }) {
  const [custom, setCustom] = useState(FIXED.includes(settings.deficit) ? "" : String(settings.deficit));
  const [saving, setSaving] = useState(false);
  useEffect(() => setCustom(FIXED.includes(settings.deficit) ? "" : String(settings.deficit)), [settings.deficit]);

  async function save(patch: Partial<Settings>) {
    setSaving(true);
    const r = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...settings, ...patch }) });
    setSaving(false);
    if (r.ok) onChange(await r.json());
  }

  const auto = autoDeficit(settings, weights, todaySG());
  const usesDeficit = settings.budgetMode === "total_minus_deficit";
  const autoActive = settings.deficitMode === "auto" && auto.value !== null;
  const inUse = autoActive ? Math.round(auto.value!) : settings.deficit;

  return (
    <section className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-line">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Daily deficit</h2>
        <span className="tabular text-lg font-semibold">
          {inUse.toLocaleString()} <span className="text-xs font-normal text-ink-3">kcal/day</span>
        </span>
      </div>
      <p className="mt-0.5 text-xs text-ink-3">How much less than you burn you aim to eat. About 7,700 kcal = 1 kg.</p>

      <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-track p-1 text-sm">
        {(["auto", "manual"] as const).map((m) => (
          <button
            key={m}
            disabled={saving}
            onClick={() => m !== settings.deficitMode && save({ deficitMode: m })}
            className={`rounded-lg py-1.5 ${settings.deficitMode === m ? "bg-card font-semibold shadow-sm" : "text-ink-2"}`}
          >
            {m === "auto" ? "From my goal" : "Fixed"}
          </button>
        ))}
      </div>

      {settings.deficitMode === "auto" ? (
        <div className="mt-3 text-sm">
          {auto.value !== null ? (
            <p className="text-ink-2">{"lines" in auto ? auto.lines.map((l) => l.detail ?? l.label).join(" ") : ""}</p>
          ) : (
            <p className="text-ink-2">
              {"reason" in auto ? auto.reason : ""} so it can be worked out. Until then the fixed {settings.deficit} kcal is used.
            </p>
          )}
          <button onClick={onEditGoal} className="mt-2 rounded-full bg-track px-3 py-1.5 text-xs font-semibold text-ink-2 active:opacity-70">
            {settings.goalWeightKg && settings.goalDate ? "Change goal or date" : "Set goal and date"}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
          {FIXED.map((n) => (
            <button
              key={n}
              disabled={saving}
              onClick={() => {
                setCustom("");
                save({ deficit: n });
              }}
              className={`h-9 rounded-full px-3 ring-1 ${settings.deficit === n ? "bg-brand font-semibold text-white ring-brand" : "bg-card ring-line active:opacity-70"}`}
            >
              {n}
            </button>
          ))}
          <input
            type="number"
            inputMode="numeric"
            value={custom}
            placeholder="other"
            onChange={(e) => setCustom(e.target.value)}
            onBlur={() => {
              const n = Math.round(Number(custom));
              if (n >= 0 && n <= 1500 && custom !== "" && n !== settings.deficit) save({ deficit: n });
            }}
            className={`tabular h-9 w-20 rounded-full px-3 ring-1 outline-none ${FIXED.includes(settings.deficit) ? "ring-line" : "ring-brand"}`}
            aria-label="Custom deficit in kcal"
          />
          <p className="w-full text-xs text-ink-3">
            300 kcal/day ≈ 0.27 kg a week. Most people find 200–400 easy to stick to.
          </p>
        </div>
      )}

      {!usesDeficit && (
        <div className="mt-3 rounded-xl bg-brand-soft p-3 text-xs">
          Your budget currently {settings.budgetMode === "fixed" ? "is a fixed target" : "is your target + active calories"}, so this deficit isn&apos;t used.{" "}
          <button disabled={saving} onClick={() => save({ budgetMode: "total_minus_deficit" })} className="font-semibold text-brand-strong underline">
            Use Apple Health burned − deficit
          </button>
        </div>
      )}
    </section>
  );
}
