"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DeficitCard } from "@/components/DeficitCard";
import { GoalSetup } from "@/components/GoalSetup";
import { ReminderCard } from "@/components/ReminderCard";
import type { Settings } from "@/lib/types";

type W = { date: string; kg: number };
type Range = "1M" | "3M" | "1Y" | "All";
const RANGE_DAYS: Record<Range, number | null> = { "1M": 31, "3M": 92, "1Y": 366, All: null };

const localDate = (d = new Date()) => new Intl.DateTimeFormat("en-CA").format(d);
const toTime = (date: string) => new Date(date + "T12:00:00").getTime();
const DAY = 86_400_000;
const fmtDate = (date: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(date + "T12:00:00").toLocaleDateString(undefined, opts);
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(1)}`;

// Latest entry on or before `days` ago, to compare against.
function changeOver(weights: W[], days: number): number | null {
  if (weights.length < 2) return null;
  const last = weights[weights.length - 1];
  const cutoff = toTime(last.date) - days * DAY;
  const past = [...weights].reverse().find((w) => toTime(w.date) <= cutoff);
  return past ? last.kg - past.kg : null;
}

export default function WeightPage() {
  const [weights, setWeights] = useState<W[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const goal = settings?.goalWeightKg ?? null;
  const goalDate = settings?.goalDate ?? null;
  const [date, setDate] = useState(localDate);
  const [kg, setKg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [range, setRange] = useState<Range>("3M");
  const [goalOpen, setGoalOpen] = useState(false);

  const load = useCallback(async () => {
    const [r, sr] = await Promise.all([fetch("/api/weight"), fetch("/api/settings")]);
    if (r.status === 401) return (window.location.href = "/login");
    const j = await r.json();
    setWeights(j.weights);
    if (sr.ok) setSettings(await sr.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Prefill the box with the weight already logged for the chosen date.
  useEffect(() => {
    const existing = weights?.find((w) => w.date === date);
    setKg(existing ? String(existing.kg) : "");
  }, [date, weights]);

  const existing = weights?.find((w) => w.date === date);
  const latest = weights?.[weights.length - 1] ?? null;

  async function save() {
    setSaving(true);
    setError(null);
    const r = await fetch("/api/weight", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, kg }) });
    setSaving(false);
    if (!r.ok) return setError((await r.json()).error ?? "Couldn't save");
    load();
  }

  async function remove(d: string) {
    if (!confirm(`Delete the weight for ${fmtDate(d)}?`)) return;
    await fetch(`/api/weight?date=${d}`, { method: "DELETE" });
    load();
  }

  const shown = useMemo(() => {
    if (!weights) return [];
    const days = RANGE_DAYS[range];
    if (!days) return weights;
    const from = Date.now() - days * DAY;
    return weights.filter((w) => toTime(w.date) >= from);
  }, [weights, range]);

  const week = weights ? changeOver(weights, 7) : null;
  const month = weights ? changeOver(weights, 30) : null;

  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-16" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <AppHeader center={<h1 className="text-lg font-semibold">Weight</h1>} />

      <div className="space-y-3 px-4">
        <section className="summary-card rounded-3xl p-4 shadow-sm ring-1 ring-line">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{date === localDate() ? "Today's weigh-in" : `Weigh-in for ${fmtDate(date)}`}</h2>
            <input
              type="date"
              value={date}
              max={localDate()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="rounded-lg bg-card px-2 py-1 text-sm text-ink-2 ring-1 ring-line"
              aria-label="Date"
            />
          </div>
          <form
            className="mt-3 flex items-stretch gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <label className="flex min-w-0 flex-1 items-center rounded-xl bg-card px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={kg}
                onChange={(e) => setKg(e.target.value)}
                placeholder={latest ? String(latest.kg) : "0.0"}
                className="tabular min-w-0 flex-1 bg-transparent py-2.5 text-2xl font-semibold outline-none placeholder:text-ink-3"
                aria-label="Weight in kg"
              />
              <span className="text-ink-3">kg</span>
            </label>
            <button disabled={saving || !kg} className="rounded-xl bg-brand px-5 font-semibold text-white disabled:opacity-40">
              {saving ? "…" : existing ? "Update" : "Save"}
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-over">{error}</p>}
          <p className="mt-2 text-xs text-ink-3">Tip: weigh yourself in the morning after the toilet, before eating, for the most consistent numbers.</p>
        </section>

        <div className="grid grid-cols-3 gap-2">
          <Tile label="Current" value={latest ? `${latest.kg.toFixed(1)}` : "–"} unit="kg" sub={latest ? fmtDate(latest.date) : "No weigh-ins yet"} />
          <Tile label="7 days" value={week === null ? "–" : signed(week)} unit="kg" sub={month === null ? "" : `30 days: ${signed(month)} kg`} />
          <button onClick={() => setGoalOpen(true)} className="text-left">
            <Tile
              label="Goal"
              value={goal ? goal.toFixed(1) : "Set"}
              unit={goal ? "kg" : ""}
              sub={
                goal && latest
                  ? `${Math.abs(latest.kg - goal).toFixed(1)} kg to go${goalDate ? ` by ${fmtDate(goalDate)}` : ""}`
                  : "Tap to set"
              }
            />
          </button>
        </div>

        {settings && weights && (
          <DeficitCard settings={settings} weights={weights} onChange={setSettings} onEditGoal={() => setGoalOpen(true)} />
        )}

        <section className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-line">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Trend</h2>
            <div className="flex gap-1 rounded-lg bg-track p-0.5 text-xs">
              {(Object.keys(RANGE_DAYS) as Range[]).map((r) => (
                <button key={r} onClick={() => setRange(r)} className={`rounded-md px-2.5 py-1 ${range === r ? "bg-card font-semibold shadow-sm" : "text-ink-2"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          {!weights ? (
            <p className="py-16 text-center text-ink-3">Loading…</p>
          ) : shown.length < 2 ? (
            <p className="py-12 text-center text-sm text-ink-3">
              {weights.length < 2 ? "Log at least two weigh-ins to see your trend." : "Not enough weigh-ins in this range."}
            </p>
          ) : (
            <WeightChart data={shown} goal={goal} />
          )}
        </section>

        <ReminderCard />

        {weights && weights.length > 0 && (
          <section className="rounded-2xl bg-card shadow-sm ring-1 ring-line">
            <h2 className="px-4 pt-3 pb-2 font-semibold">History</h2>
            <ul className="divide-y divide-line border-t border-line">
              {[...weights].reverse().slice(0, 60).map((w, i, arr) => {
                const prev = arr[i + 1];
                const diff = prev ? w.kg - prev.kg : null;
                return (
                  <li key={w.date} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex-1 text-sm">{fmtDate(w.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
                    {diff !== null && <span className="tabular w-14 text-right text-xs text-ink-3">{signed(diff)}</span>}
                    <span className="tabular w-16 text-right font-semibold">{w.kg.toFixed(1)}</span>
                    <button aria-label={`Delete ${w.date}`} onClick={() => remove(w.date)} className="-mr-2 h-8 w-8 rounded-full text-ink-3 active:bg-track">
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {goalOpen && settings && (
        <GoalSetup
          mode="edit"
          settings={settings}
          onClose={() => setGoalOpen(false)}
          onSaved={() => {
            setGoalOpen(false);
            load();
          }}
        />
      )}
    </main>
  );
}

function Tile({ label, value, unit, sub }: { label: string; value: string; unit: string; sub: string }) {
  return (
    <div className="h-full rounded-2xl bg-card p-3 shadow-sm ring-1 ring-line">
      <div className="text-xs text-ink-2">{label}</div>
      <div className="tabular mt-0.5 text-xl font-semibold">
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-ink-3">{unit}</span>}
      </div>
      <div className="truncate text-[11px] text-ink-3">{sub}</div>
    </div>
  );
}

/* ---------------- Chart: one series, one axis, crosshair tooltip ---------------- */

function WeightChart({ data, goal }: { data: W[]; goal: number | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 200;
  const pad = { l: 34, r: 12, t: 12, b: 22 };
  const t0 = toTime(data[0].date);
  const t1 = toTime(data[data.length - 1].date);
  const values = data.map((d) => d.kg);
  const goalInView = goal !== null && goal >= Math.min(...values) - 5 && goal <= Math.max(...values) + 5;
  let lo = Math.min(...values, ...(goalInView ? [goal!] : []));
  let hi = Math.max(...values, ...(goalInView ? [goal!] : []));
  const span = Math.max(hi - lo, 1);
  lo -= span * 0.15;
  hi += span * 0.15;
  const step = niceStep((hi - lo) / 4);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(+v.toFixed(2));

  const x = (date: string) => pad.l + ((toTime(date) - t0) / Math.max(t1 - t0, DAY)) * (width - pad.l - pad.r);
  const y = (kg: number) => pad.t + (1 - (kg - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(d.date).toFixed(1)},${y(d.kg).toFixed(1)}`).join("");
  const last = data[data.length - 1];
  const h = hover !== null ? data[hover] : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = 0;
    data.forEach((d, i) => {
      if (Math.abs(x(d.date) - px) < Math.abs(x(data[best].date) - px)) best = i;
    });
    setHover(best);
  }

  return (
    <div ref={wrap} className="relative">
      <svg
        width={width}
        height={H}
        className="block touch-pan-y select-none"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Weight from ${data[0].kg} kg to ${last.kg} kg`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--ink-3)" className="tabular">
              {step < 1 ? t.toFixed(1) : t}
            </text>
          </g>
        ))}
        {goalInView && (
          <g>
            <line x1={pad.l} x2={width - pad.r} y1={y(goal!)} y2={y(goal!)} stroke="var(--good)" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x={width - pad.r} y={y(goal!) - 5} textAnchor="end" fontSize="10" fill="var(--good)">
              Goal {goal!.toFixed(1)}
            </text>
          </g>
        )}
        <text x={pad.l} y={H - 6} fontSize="10" fill="var(--ink-3)">{fmtDate(data[0].date)}</text>
        <text x={width - pad.r} y={H - 6} textAnchor="end" fontSize="10" fill="var(--ink-3)">{fmtDate(last.date)}</text>
        <path d={path} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.length <= 45 &&
          data.map((d) => <circle key={d.date} cx={x(d.date)} cy={y(d.kg)} r="2.5" fill="var(--brand)" />)}
        <circle cx={x(last.date)} cy={y(last.kg)} r="5" fill="var(--brand)" stroke="var(--card)" strokeWidth="2" />
        {h && (
          <g pointerEvents="none">
            <line x1={x(h.date)} x2={x(h.date)} y1={pad.t} y2={H - pad.b} stroke="var(--ink-3)" strokeWidth="1" />
            <circle cx={x(h.date)} cy={y(h.kg)} r="5" fill="var(--brand)" stroke="var(--card)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg bg-ink px-2 py-1 text-xs whitespace-nowrap text-bg shadow"
          style={{ left: Math.min(Math.max(x(h.date) - 40, 0), width - 90) }}
        >
          <span className="tabular font-semibold">{h.kg.toFixed(1)} kg</span> · {fmtDate(h.date)}
        </div>
      )}
    </div>
  );
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}
