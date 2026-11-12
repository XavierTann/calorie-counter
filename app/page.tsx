"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dailyBudget } from "@/lib/budget";
import { MEALS, type Energy, type Entry, type FoodItem, type Meal, type Settings } from "@/lib/types";

const MEAL_LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };

function localDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA").format(d);
}
function shiftDate(date: string, days: number) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return localDate(d);
}
function prettyDate(date: string) {
  const today = localDate();
  if (date === today) return "Today";
  if (date === shiftDate(today, -1)) return "Yesterday";
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
function mealForNow(): Meal {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h < 10.5) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 17.5) return "snacks";
  if (h < 22) return "dinner";
  return "snacks";
}
const sum = (xs: FoodItem[], k: "kcal" | "protein" | "carbs" | "fat") => xs.reduce((a, x) => a + (Number(x[k]) || 0), 0);

type DayData = { entries: Entry[]; energy: Energy | null; settings: Settings };

export default function Home() {
  const [date, setDate] = useState(localDate);
  const [data, setData] = useState<DayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "review" | "home" | "recent" | "energy">(null);
  const [draft, setDraft] = useState<FoodItem[]>([]);
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/entries?date=${date}`);
    if (r.status === 401) return (window.location.href = "/login");
    setData(await r.json());
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitText() {
    if (!text.trim() || parsing) return;
    setParsing(true);
    setError(null);
    try {
      const r = await fetch("/api/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Lookup failed");
      if (!j.items.length) throw new Error("Couldn't find any food in that. Try rephrasing.");
      setDraft(j.items);
      setSheet("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setParsing(false);
    }
  }

  async function addItems(items: FoodItem[], meal: Meal) {
    await fetch("/api/entries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, meal, items }) });
    setSheet(null);
    setDraft([]);
    setText("");
    load();
  }

  async function remove(id: number) {
    setData((d) => (d ? { ...d, entries: d.entries.filter((e) => e.id !== id) } : d));
    await fetch(`/api/entries?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-40" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-1">
          <IconButton label="Previous day" onClick={() => setDate((d) => shiftDate(d, -1))}>‹</IconButton>
          <button className="min-w-28 text-center text-lg font-semibold" onClick={() => setDate(localDate())}>
            {prettyDate(date)}
          </button>
          <IconButton label="Next day" onClick={() => setDate((d) => shiftDate(d, 1))}>›</IconButton>
        </div>
        <Link href="/settings" className="rounded-full px-3 py-2 text-sm text-ink-2 active:bg-track">
          Settings
        </Link>
      </header>

      {!data ? (
        <p className="px-4 py-10 text-center text-ink-3">Loading…</p>
      ) : (
        <>
          <Summary data={data} onEditEnergy={() => setSheet("energy")} />
          <div className="mt-3 space-y-3 px-4">
            {MEALS.map((m) => (
              <MealCard key={m} meal={m} entries={data.entries.filter((e) => e.meal === m)} onRemove={remove} />
            ))}
          </div>
        </>
      )}

      <Composer
        text={text}
        setText={setText}
        parsing={parsing}
        error={error}
        onSubmit={submitText}
        onHome={() => setSheet("home")}
        onRecent={() => setSheet("recent")}
      />

      {sheet === "review" && <ReviewSheet items={draft} onClose={() => setSheet(null)} onAdd={addItems} />}
      {sheet === "home" && data && <HomeMealSheet settings={data.settings} onClose={() => setSheet(null)} onAdd={addItems} />}
      {sheet === "recent" && <RecentSheet onClose={() => setSheet(null)} onPick={(i) => { setDraft([i]); setSheet("review"); }} />}
      {sheet === "energy" && data && (
        <EnergySheet date={date} energy={data.energy} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />
      )}
    </main>
  );
}

/* ---------------- Summary (Cronometer-style energy + macros) ---------------- */

function Summary({ data, onEditEnergy }: { data: DayData; onEditEnergy: () => void }) {
  const { entries, energy, settings } = data;
  const consumed = Math.round(sum(entries, "kcal"));
  const { budget, explain } = dailyBudget(settings, energy);
  const remaining = budget - consumed;
  const over = remaining < 0;
  const burned = energy?.total ?? null;

  return (
    <section className="mx-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-line">
      <div className="flex items-center gap-4">
        <Ring value={consumed} max={budget} over={over}>
          <div className={`tabular text-3xl font-semibold ${over ? "text-over" : ""}`}>{Math.abs(remaining).toLocaleString()}</div>
          <div className="text-xs text-ink-2">{over ? "kcal over" : "kcal left"}</div>
        </Ring>
        <div className="grid flex-1 grid-cols-1 gap-2">
          <Stat label="Consumed" value={consumed} />
          <Stat label="Budget" value={budget} sub={explain} />
          <button onClick={onEditEnergy} className="-m-1 rounded-lg p-1 text-left active:bg-track">
            <Stat
              label="Burned"
              value={burned}
              sub={
                energy
                  ? `${energy.active !== null ? `${Math.round(energy.active)} active · ` : ""}${energy.source}`
                  : "Tap to add / sync Garmin"
              }
            />
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <MacroBar label="Protein" value={sum(entries, "protein")} target={settings.proteinG} color="var(--protein)" />
        <MacroBar label="Carbs" value={sum(entries, "carbs")} target={settings.carbsG} color="var(--carbs)" />
        <MacroBar label="Fat" value={sum(entries, "fat")} target={settings.fatG} color="var(--fat)" />
      </div>
    </section>
  );
}

function Ring({ value, max, over, children }: { value: number; max: number; over: boolean; children: React.ReactNode }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const frac = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div className="relative h-36 w-36 shrink-0" role="img" aria-label={`${value} of ${max} kcal eaten`}>
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--track)" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={over ? "var(--over)" : "var(--brand)"}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${frac * c} ${c}`}
          style={{ transition: "stroke-dasharray 400ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | null; sub?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-ink-2">{label}</span>
        <span className="tabular font-semibold">{value === null ? "–" : Math.round(value).toLocaleString()}</span>
      </div>
      {sub && <div className="truncate text-[11px] text-ink-3">{sub}</div>}
    </div>
  );
}

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(value / target, 1) * 100 : 0;
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-ink-2">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-track">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: "width 400ms ease" }} />
      </div>
      <div className="tabular mt-1 text-xs">
        <span className="font-semibold">{Math.round(value)}</span>
        <span className="text-ink-3"> / {target} g</span>
      </div>
    </div>
  );
}

/* ---------------- Diary ---------------- */

function MealCard({ meal, entries, onRemove }: { meal: Meal; entries: Entry[]; onRemove: (id: number) => void }) {
  const total = Math.round(sum(entries, "kcal"));
  return (
    <section className="rounded-2xl bg-card shadow-sm ring-1 ring-line">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="font-semibold">{MEAL_LABEL[meal]}</h2>
        <span className="tabular text-sm text-ink-2">{total ? `${total} kcal` : ""}</span>
      </div>
      {entries.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px]">{e.name}</div>
                <div className="truncate text-xs text-ink-3">
                  {e.quantity}
                  {e.quantity ? " · " : ""}
                  <ConfidenceTag c={e.confidence} /> {sourceLabel(e.source)}
                </div>
              </div>
              <span className="tabular text-sm font-medium">{Math.round(e.kcal)}</span>
              <button
                aria-label={`Delete ${e.name}`}
                onClick={() => confirm(`Delete ${e.name}?`) && onRemove(e.id)}
                className="-mr-2 h-8 w-8 rounded-full text-ink-3 active:bg-track"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function sourceLabel(s: string) {
  if (s.startsWith("db:")) return "hawker DB";
  if (s.startsWith("home")) return "home scoop";
  if (s.startsWith("web")) return s.replace(/^web:\s*/, "");
  if (s === "learned") return "saved";
  return s;
}

function ConfidenceTag({ c }: { c: FoodItem["confidence"] }) {
  const map = { high: "●●●", medium: "●●○", low: "●○○" } as const;
  return (
    <span title={`${c} confidence`} aria-label={`${c} confidence`} className="tracking-tighter">
      {map[c]}
    </span>
  );
}

/* ---------------- Composer ---------------- */

function Composer(p: {
  text: string;
  setText: (s: string) => void;
  parsing: boolean;
  error: string | null;
  onSubmit: () => void;
  onHome: () => void;
  onRecent: () => void;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card/95 backdrop-blur"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      <div className="mx-auto max-w-xl px-4 pt-3">
        {p.error && <p className="mb-2 text-sm text-over">{p.error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            p.onSubmit();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={p.text}
            onChange={(e) => p.setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                p.onSubmit();
              }
            }}
            rows={1}
            placeholder="e.g. chicken rice less rice + kopi-c"
            className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-xl bg-track px-3 py-2.5 outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-brand"
          />
          <button
            type="submit"
            disabled={p.parsing || !p.text.trim()}
            className="h-11 rounded-xl bg-brand px-4 font-semibold text-brand-ink disabled:opacity-40"
          >
            {p.parsing ? "…" : "Log"}
          </button>
        </form>
        <div className="mt-2 flex gap-2 text-sm">
          <button onClick={p.onHome} className="rounded-full bg-track px-3 py-1.5 active:opacity-70">🍚 Home meal (scoops)</button>
          <button onClick={p.onRecent} className="rounded-full bg-track px-3 py-1.5 active:opacity-70">↺ Recent</button>
          {p.parsing && <span className="self-center text-xs text-ink-3">Looking it up…</span>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Sheets ---------------- */

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-card p-4"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-ink-2 active:bg-track">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MealPicker({ meal, setMeal }: { meal: Meal; setMeal: (m: Meal) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1 rounded-xl bg-track p-1 text-sm">
      {MEALS.map((m) => (
        <button
          key={m}
          onClick={() => setMeal(m)}
          className={`rounded-lg py-1.5 ${meal === m ? "bg-card font-semibold shadow-sm" : "text-ink-2"}`}
        >
          {MEAL_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

function ReviewSheet({ items: initial, onClose, onAdd }: { items: FoodItem[]; onClose: () => void; onAdd: (i: FoodItem[], m: Meal) => Promise<void> }) {
  const [items, setItems] = useState(initial);
  const [meal, setMeal] = useState<Meal>(mealForNow);
  const [saving, setSaving] = useState(false);
  const total = Math.round(sum(items, "kcal"));

  function setKcal(idx: number, kcal: number) {
    setItems((xs) =>
      xs.map((x, i) => {
        if (i !== idx) return x;
        // Scale macros with the calorie edit so they stay consistent.
        const f = x.kcal > 0 ? kcal / x.kcal : 1;
        return { ...x, kcal, protein: +(x.protein * f).toFixed(1), carbs: +(x.carbs * f).toFixed(1), fat: +(x.fat * f).toFixed(1), source: x.source.includes("edited") ? x.source : `${x.source} (edited)` };
      }),
    );
  }

  return (
    <Sheet title="Check & log" onClose={onClose}>
      <MealPicker meal={meal} setMeal={setMeal} />
      <ul className="mt-3 divide-y divide-line">
        {items.map((it, i) => (
          <li key={i} className="py-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{it.name}</div>
                <div className="text-xs text-ink-3">
                  {it.quantity} · <ConfidenceTag c={it.confidence} /> {sourceLabel(it.source)}
                </div>
                <div className="tabular mt-1 text-xs text-ink-2">
                  P {Math.round(it.protein)}g · C {Math.round(it.carbs)}g · F {Math.round(it.fat)}g
                </div>
                {it.note && <div className="mt-1 text-xs text-ink-3">{it.note}</div>}
              </div>
              <label className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="numeric"
                  value={Math.round(it.kcal)}
                  onChange={(e) => setKcal(i, Number(e.target.value) || 0)}
                  className="tabular w-20 rounded-lg bg-track px-2 py-1.5 text-right"
                  aria-label={`${it.name} calories`}
                />
                <span className="text-xs text-ink-3">kcal</span>
              </label>
              <button aria-label={`Remove ${it.name}`} onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} className="h-8 w-8 rounded-full text-ink-3 active:bg-track">
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        disabled={!items.length || saving}
        onClick={async () => {
          setSaving(true);
          await onAdd(items, meal);
        }}
        className="mt-3 h-12 w-full rounded-xl bg-brand font-semibold text-brand-ink disabled:opacity-40"
      >
        Add {total} kcal to {MEAL_LABEL[meal]}
      </button>
    </Sheet>
  );
}

function HomeMealSheet({ settings, onClose, onAdd }: { settings: Settings; onClose: () => void; onAdd: (i: FoodItem[], m: Meal) => Promise<void> }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [meal, setMeal] = useState<Meal>(mealForNow);
  const [saving, setSaving] = useState(false);

  const items: FoodItem[] = useMemo(
    () =>
      settings.homeUnits
        .filter((u) => (counts[u.id] ?? 0) > 0)
        .map((u) => {
          const n = counts[u.id];
          return {
            name: `Home: ${u.label.replace(/\s*\(.*\)$/, "")}`,
            quantity: `${n} × ${u.label.toLowerCase().startsWith("bowl") ? "bowl" : "scoop"}`,
            kcal: Math.round(u.kcal * n),
            protein: +(u.protein * n).toFixed(1),
            carbs: +(u.carbs * n).toFixed(1),
            fat: +(u.fat * n).toFixed(1),
            source: `home:${u.id}`,
            confidence: "medium" as const,
          };
        }),
    [counts, settings.homeUnits],
  );
  const total = Math.round(sum(items, "kcal"));

  return (
    <Sheet title="Home meal" onClose={onClose}>
      <p className="mb-3 text-sm text-ink-2">Count scoops with the serving spoon. Half scoops are fine. You can change the scoop sizes in Settings.</p>
      <MealPicker meal={meal} setMeal={setMeal} />
      <ul className="mt-2 divide-y divide-line">
        {settings.homeUnits.map((u) => {
          const n = counts[u.id] ?? 0;
          const set = (v: number) => setCounts((c) => ({ ...c, [u.id]: Math.max(0, v) }));
          return (
            <li key={u.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-[15px]">{u.label}</div>
                <div className="tabular text-xs text-ink-3">{u.kcal} kcal each</div>
              </div>
              <div className="flex items-center gap-1">
                <button aria-label={`Less ${u.label}`} onClick={() => set(n - 0.5)} className="h-9 w-9 rounded-full bg-track text-lg active:opacity-70">−</button>
                <span className="tabular w-8 text-center font-semibold">{n}</span>
                <button aria-label={`More ${u.label}`} onClick={() => set(n + (n === 0 ? 1 : 0.5))} className="h-9 w-9 rounded-full bg-track text-lg active:opacity-70">+</button>
              </div>
            </li>
          );
        })}
      </ul>
      <button
        disabled={!items.length || saving}
        onClick={async () => {
          setSaving(true);
          await onAdd(items, meal);
        }}
        className="mt-3 h-12 w-full rounded-xl bg-brand font-semibold text-brand-ink disabled:opacity-40"
      >
        Add {total} kcal to {MEAL_LABEL[meal]}
      </button>
    </Sheet>
  );
}

function RecentSheet({ onClose, onPick }: { onClose: () => void; onPick: (i: FoodItem) => void }) {
  const [items, setItems] = useState<FoodItem[] | null>(null);
  useEffect(() => {
    fetch("/api/recent").then((r) => r.json()).then((j) => setItems(j.items));
  }, []);
  return (
    <Sheet title="Recent foods" onClose={onClose}>
      {!items ? (
        <p className="text-ink-3">Loading…</p>
      ) : !items.length ? (
        <p className="text-ink-3">Nothing logged yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((it, i) => (
            <li key={i}>
              <button onClick={() => onPick(it)} className="flex w-full items-center gap-3 py-3 text-left active:bg-track">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{it.name}</div>
                  <div className="truncate text-xs text-ink-3">{it.quantity}</div>
                </div>
                <span className="tabular text-sm">{Math.round(it.kcal)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function EnergySheet({ date, energy, onClose, onSaved }: { date: string; energy: Energy | null; onClose: () => void; onSaved: () => void }) {
  const [active, setActive] = useState(energy?.active?.toString() ?? "");
  const [resting, setResting] = useState(energy?.resting?.toString() ?? "");
  const [total, setTotal] = useState(energy?.total?.toString() ?? "");
  return (
    <Sheet title="Calories burned" onClose={onClose}>
      <p className="mb-3 text-sm text-ink-2">
        Copy these from the Garmin Connect app (My Day → Calories), or set up automatic sync in Settings.
        {energy && ` Last update: ${energy.source}, ${energy.updated_at} UTC.`}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <NumField label="Active" value={active} onChange={setActive} />
        <NumField label="Resting" value={resting} onChange={setResting} />
        <NumField label="Total" value={total} onChange={setTotal} placeholder="auto" />
      </div>
      <button
        onClick={async () => {
          await fetch("/api/energy", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ date, active, resting, total: total || null }),
          });
          onSaved();
        }}
        className="mt-4 h-12 w-full rounded-xl bg-brand font-semibold text-brand-ink"
      >
        Save
      </button>
    </Sheet>
  );
}

function NumField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="text-sm text-ink-2">
      {label}
      <input
        type="number"
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="tabular mt-1 w-full rounded-lg bg-track px-3 py-2 text-ink"
      />
    </label>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button aria-label={label} onClick={onClick} className="h-9 w-9 rounded-full text-2xl leading-none text-ink-2 active:bg-track">
      {children}
    </button>
  );
}
