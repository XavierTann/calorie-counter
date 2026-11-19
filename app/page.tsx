"use client";

import { AppHeader } from "@/components/AppHeader";
import { Buddy, buddyLine } from "@/components/Buddy";
import { GoalSetup, goalSetupSkipped } from "@/components/GoalSetup";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Sheet } from "@/components/Sheet";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Budget } from "@/lib/budget";
import type { Clarification } from "@/lib/parse";
import { MEALS, type Energy, type Entry, type FoodItem, type Meal, type MyFood, type Settings } from "@/lib/types";

const MEAL_LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };
const MEAL_ICON: Record<Meal, string> = { breakfast: "☀️", lunch: "🍜", dinner: "🌙", snacks: "🍪" };

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

type DayData = { entries: Entry[]; energy: Energy | null; settings: Settings; budget: Budget };

export default function Home() {
  const [date, setDate] = useState(localDate);
  const [data, setData] = useState<DayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "compose" | "review" | "energy" | "budget">(null);
  const [draft, setDraft] = useState<FoodItem[]>([]);
  const [questions, setQuestions] = useState<Clarification[]>([]);
  const [asked, setAsked] = useState(""); // the text that produced the current draft
  const [extras, setExtras] = useState<FoodItem[]>([]); // usual foods picked alongside the typed text
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [setup, setSetup] = useState(false);
  const [logMeal, setLogMeal] = useState<Meal>(mealForNow); // the meal the + you tapped belongs to
  const setupChecked = useRef(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/entries?date=${date}`);
    if (r.status === 401) return (window.location.href = "/login");
    setData(await r.json());
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  // First time in with no goal: ask for one so the budget can work out the deficit.
  useEffect(() => {
    if (!data || setupChecked.current) return;
    setupChecked.current = true;
    if ((data.settings.goalWeightKg === null || !data.settings.goalDate) && !goalSetupSkipped()) setSetup(true);
  }, [data]);

  async function lookup(query: string, picked: FoodItem[]) {
    const r = await fetch("/api/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: query }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Lookup failed");
    if (!j.items.length) throw new Error("Couldn't find any food in that. Try rephrasing.");
    setDraft([...j.items, ...picked]);
    setQuestions(j.questions ?? []);
    setAsked(query);
  }

  // Typed text goes to the AI; usual foods you tapped are added as they are (no AI call).
  async function submitText(picked: FoodItem[] = []) {
    if ((!text.trim() && !picked.length) || parsing) return;
    setExtras(picked);
    if (!text.trim()) {
      setDraft(picked);
      setQuestions([]);
      setAsked("");
      setSheet("review");
      return;
    }
    setParsing(true);
    setError(null);
    try {
      await lookup(text, picked);
      setText("");
      setSheet("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setParsing(false);
    }
  }

  // Re-runs the lookup with the answers to the AI's clarifying questions.
  async function answer(answers: { question: string; answer: string }[]) {
    await lookup(`${asked}\n\nAnswers to your questions:\n${answers.map((a) => `- ${a.question} ${a.answer}`).join("\n")}`, extras);
  }

  async function addItems(items: FoodItem[], meal: Meal) {
    await fetch("/api/entries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, meal, items }) });
    setSheet(null);
    setDraft([]);
    setText("");
    load();
  }

  function openCompose(meal: Meal) {
    setError(null);
    setLogMeal(meal);
    setSheet("compose");
  }

  async function remove(id: number) {
    setData((d) => (d ? { ...d, entries: d.entries.filter((e) => e.id !== id) } : d));
    await fetch(`/api/entries?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-28" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <PullToRefresh onRefresh={load} disabled={!!sheet || !!editing || setup} />
      <AppHeader
        center={
          <div className="flex items-center gap-1">
            <IconButton label="Previous day" onClick={() => setDate((d) => shiftDate(d, -1))}>‹</IconButton>
            <button className="min-w-28 text-center text-lg font-semibold" onClick={() => setDate(localDate())}>
              {prettyDate(date)}
            </button>
            <IconButton label="Next day" onClick={() => setDate((d) => shiftDate(d, 1))}>›</IconButton>
          </div>
        }
      />

      {!data ? (
        <p className="px-4 py-10 text-center text-ink-3">Loading…</p>
      ) : (
        <>
          <Summary data={data} onEditEnergy={() => setSheet("energy")} onShowBudget={() => setSheet("budget")} />
          <div className="mt-3 space-y-3 px-4">
            {MEALS.map((m) => (
              <MealCard key={m} meal={m} entries={data.entries.filter((e) => e.meal === m)} onRemove={remove} onEdit={(e) => setEditing(e)} onAdd={() => openCompose(m)} />
            ))}
          </div>
        </>
      )}

      <button
        aria-label="Log food"
        onClick={() => openCompose(mealForNow())}
        className="fab fixed right-5 z-10 flex h-16 w-16 items-center justify-center rounded-full text-4xl leading-none font-light text-white shadow-lg active:scale-95"
        style={{ bottom: "max(calc(env(safe-area-inset-bottom) + 12px), 24px)", transition: "transform 120ms" }}
      >
        +
      </button>

      {sheet === "compose" && (
        <ComposeSheet meal={logMeal} text={text} setText={setText} parsing={parsing} error={error} onSubmit={submitText} onManual={addItems} onClose={() => setSheet(null)} />
      )}
      {sheet === "review" && <ReviewSheet meal={logMeal} items={draft} questions={questions} onAnswer={answer} onClose={() => setSheet(null)} onAdd={addItems} />}
      {editing && (
        <EntrySheet
          entry={editing}
          onClose={() => setEditing(null)}
          onDelete={() => {
            remove(editing.id);
            setEditing(null);
          }}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {setup && data && !sheet && (
        <GoalSetup
          settings={data.settings}
          onClose={() => setSetup(false)}
          onSaved={() => {
            setSetup(false);
            load();
          }}
        />
      )}
      {sheet === "budget" && data && <BudgetSheet budget={data.budget} onClose={() => setSheet(null)} />}
      {sheet === "energy" && data && (
        <EnergySheet date={date} energy={data.energy} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />
      )}
    </main>
  );
}

/* ---------------- Summary (Cronometer-style energy + macros) ---------------- */

function Summary({ data, onEditEnergy, onShowBudget }: { data: DayData; onEditEnergy: () => void; onShowBudget: () => void }) {
  const { entries, energy, settings } = data;
  const consumed = Math.round(sum(entries, "kcal"));
  const { budget, explain, burn } = data.budget;
  const remaining = budget - consumed;
  const over = remaining < 0;
  const k = (n: number) => Math.round(n).toLocaleString();

  return (
    <section className="summary-card mx-4 rounded-3xl p-4 shadow-sm ring-1 ring-line">
      <div className="mb-3 flex items-center gap-3">
        <Buddy mood={over ? "sad" : "happy"} />
        <p className={`bubble relative flex-1 rounded-2xl px-3 py-2 text-sm font-medium ${over ? "bubble-sad" : ""}`}>
          {buddyLine(consumed, remaining, budget)}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Ring value={consumed} max={budget} over={over}>
          <div className={`tabular text-3xl font-semibold ${over ? "text-over" : ""}`}>{Math.abs(remaining).toLocaleString()}</div>
          <div className="text-xs text-ink-2">{over ? "kcal over" : "kcal left"}</div>
        </Ring>
        <div className="grid flex-1 grid-cols-1 gap-2">
          <Stat label="Consumed" value={consumed} />
          <button onClick={onShowBudget} className="-m-1 rounded-lg p-1 text-left active:bg-track">
            <Stat label="Budget" value={budget} sub={explain} />
          </button>
          <button onClick={onEditEnergy} className="-m-1 rounded-lg p-1 text-left active:bg-track">
            {burn ? (
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-ink-2">Burned now</span>
                  <span className="tabular font-semibold">{burn.now === null ? "–" : k(burn.now)}</span>
                </div>
                {burn.projected && (
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-ink-2">Predicted</span>
                    <span className="tabular font-semibold text-ink-2">~{k(burn.predicted)}</span>
                  </div>
                )}
                <div className="truncate text-[11px] text-ink-3">
                  {burn.projected && burn.restingPredicted !== null
                    ? `~${k(burn.restingPredicted)} resting by midnight + ${k(burn.active)} active`
                    : `${burn.restingNow !== null ? `${k(burn.restingNow)} resting + ` : ""}${k(burn.active)} active`}
                </div>
              </div>
            ) : (
              <Stat label="Burned" value={null} sub={energy ? energy.source : "Tap to add, or sync Apple Health"} />
            )}
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
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffb547" />
            <stop offset="100%" stopColor="var(--brand)" />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--track)" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={over ? "var(--over)" : "url(#ring-grad)"}
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

function MealCard({ meal, entries, onRemove, onEdit, onAdd }: { meal: Meal; entries: Entry[]; onRemove: (id: number) => void; onEdit: (e: Entry) => void; onAdd: () => void }) {
  const total = Math.round(sum(entries, "kcal"));
  return (
    <section className="rounded-2xl bg-card shadow-sm ring-1 ring-line">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`meal-${meal} flex h-9 w-9 items-center justify-center rounded-xl text-lg`} aria-hidden>
          {MEAL_ICON[meal]}
        </span>
        <h2 className="flex-1 font-semibold">{MEAL_LABEL[meal]}</h2>
        {total ? (
          <span className={`meal-${meal} tabular rounded-full px-2.5 py-0.5 text-sm font-semibold`}>{total} kcal</span>
        ) : (
          <span className="text-xs text-ink-3">Nothing yet</span>
        )}
        <button
          onClick={onAdd}
          aria-label={`Add to ${MEAL_LABEL[meal].toLowerCase()}`}
          className="-mr-1 flex h-9 w-9 items-center justify-center rounded-full bg-track text-xl leading-none text-ink-2 active:scale-95 active:opacity-70"
        >
          +
        </button>
      </div>
      {entries.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
              <button onClick={() => onEdit(e)} className="min-w-0 flex-1 text-left" aria-label={`Edit ${e.name}`}>
                <div className="truncate text-[15px]">{e.name}</div>
                <div className="truncate text-xs text-ink-3">
                  {amount(e.quantity, e.portion)}
                  {e.quantity ? " · " : ""}
                  {sourceLabel(e.source)} · <ConfidenceTag c={e.confidence} />
                </div>
              </button>
              <button onClick={() => onEdit(e)} className="text-right" tabIndex={-1} aria-hidden>
                <div className="tabular text-sm font-medium">{Math.round(e.kcal)}</div>
                {e.kcalLow !== undefined && <div className="tabular text-[10px] text-ink-3">{e.kcalLow}–{Math.round(e.kcal)}</div>}
              </button>
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
  const edited = s.includes("(edited)") ? " (edited)" : "";
  const base = s.replace(/\s*\(edited\)/, "");
  if (base.startsWith("sg:")) return "SG FoodID (HPB)" + edited;
  if (base.startsWith("db:")) return "Hawker table (old)" + edited;
  if (base.startsWith("kr:")) return "Korea MFDS database" + edited;
  if (base.startsWith("in:")) return "Indian Nutrient Databank" + edited;
  if (base.startsWith("fdc:")) return "USDA FoodData Central" + edited;
  if (base.startsWith("off:")) return "Open Food Facts (product label)" + edited;
  if (base.startsWith("home")) return "Home cooking" + edited;
  if (base.startsWith("web")) return base.replace(/^web:\s*/, "") + edited;
  if (base === "learned" || base === "my food") return "My foods" + edited;
  if (base === "history") return "Your past logs" + edited;
  if (base === "estimate") return "AI estimate" + edited;
  if (base === "manual") return "Entered by you" + edited;
  return base + edited;
}

const CONFIDENCE = { high: { dots: "●●●", word: "High" }, medium: { dots: "●●○", word: "Medium" }, low: { dots: "●○○", word: "Low" } } as const;

function ConfidenceTag({ c }: { c: FoodItem["confidence"] }) {
  const { dots, word } = CONFIDENCE[c] ?? CONFIDENCE.medium;
  return (
    <span title={`${word} confidence`} aria-label={`${word} confidence`}>
      <span className="tracking-tighter">{dots}</span> {word.toLowerCase()} confidence
    </span>
  );
}

// One-tap modifiers shown under "Modify", based on what kind of food it is.
function modSuggestions(name: string): string[] {
  const n = name.toLowerCase();
  if (/\b(kopi|teh|milo|horlicks|coffee|tea|latte|juice|drink|bandung|chrysanthemum)\b/.test(n)) return ["kosong", "siu dai", "gah dai", "iced", "large cup"];
  if (/noodle|\bmee\b|bee ?hoon|kway teow|laksa|ramen|ramyeon|pasta|spaghetti/.test(n)) return ["dry", "soup", "extra noodles", "add egg", "large"];
  if (/rice|nasi|biryani|briyani|\bbap\b|bokkeumbap/.test(n)) return ["less rice", "more rice", "no skin", "add egg", "large"];
  return ["large", "small", "half portion", "add egg", "extra sauce"];
}

function ReviewItem({
  draft,
  onChange,
  onFix,
  onRemove,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onFix: (note: string) => Promise<void>;
  onRemove: () => void;
}) {
  const it = view(draft);
  const parts = draft.base.parts ?? [];
  const [fixOpen, setFixOpen] = useState(false);
  const [note, setNote] = useState("");
  const [fixing, setFixing] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);
  async function submitFix() {
    if (!note.trim()) return;
    setFixing(true);
    setFixError(null);
    try {
      await onFix(note.trim());
      setFixOpen(false);
      setNote("");
    } catch (e) {
      setFixError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setFixing(false);
    }
  }
  const addMod = (m: string) => setNote((n) => (n.toLowerCase().includes(m) ? n : n.trim() ? `${n.trim()}, ${m}` : m));
  const aiTotal = it.breakdown.reduce((a, b) => a + b.kcal, 0);
  const yourEdit = Math.round(it.kcal) - aiTotal;
  const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
  const conf = CONFIDENCE[it.confidence] ?? CONFIDENCE.medium;
  return (
    <li className="py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium">{it.name}</div>
          <div className="text-xs text-ink-3">{amount(it.quantity, it.portion)}</div>
        </div>
        <button aria-label={`Remove ${it.name}`} onClick={onRemove} className="-mr-2 h-8 w-8 shrink-0 rounded-full text-ink-3 active:bg-track">
          ×
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        <span className={`rounded-full px-2 py-0.5 conf-${it.confidence}`}>
          Confidence: <span className="tracking-tighter">{conf.dots}</span> {conf.word}
        </span>
        <span className="rounded-full bg-track px-2 py-0.5 text-ink-2">Source: {sourceLabel(it.source)}</span>
      </div>
      <PortionPicker value={draft.portion} onChange={(portion) => onChange({ ...draft, portion, override: null })} />
      {parts.length >= 2 && (
        <div className="mt-2">
          <div className="text-xs text-ink-3">What was in it? Tap anything you didn&apos;t eat.</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {parts.map((p) => {
              const out = draft.removed.includes(p.name);
              return (
                <button
                  key={p.name}
                  type="button"
                  aria-pressed={!out}
                  onClick={() =>
                    onChange({ ...draft, override: null, removed: out ? draft.removed.filter((n) => n !== p.name) : [...draft.removed, p.name] })
                  }
                  className={`rounded-full px-2.5 py-1 text-xs ring-1 ${out ? "bg-card text-ink-3 line-through ring-line" : "bg-brand-soft font-medium text-brand-strong ring-brand"}`}
                >
                  {out ? "" : "✓ "}
                  {p.name} <span className="tabular opacity-70">{p.kcal}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <table className="tabular mt-2 w-full text-sm">
        <tbody>
          {it.breakdown.map((b, j) => (
            <tr key={j}>
              <td className={`py-1 pr-2 ${j === 0 ? "" : "pl-3 text-ink-2"}`}>{b.label}</td>
              <td className={`py-1 text-right ${j > 0 && b.kcal < 0 ? "text-good" : j > 0 ? "text-over" : ""}`}>{j === 0 ? b.kcal : signed(b.kcal)}</td>
              <td className="w-10 py-1 pl-1 text-xs text-ink-3">kcal</td>
            </tr>
          ))}
          {yourEdit !== 0 && (
            <tr>
              <td className="py-1 pr-2 pl-3 text-ink-2">Your edit</td>
              <td className="py-1 text-right text-ink-2">{signed(yourEdit)}</td>
              <td className="w-10 py-1 pl-1 text-xs text-ink-3">kcal</td>
            </tr>
          )}
          <tr className="border-t border-line font-semibold">
            <td className="pt-2 pr-2">Total</td>
            <td className="pt-2 text-right">
              <KcalInput
                value={Math.round(it.kcal)}
                onChange={(n) => onChange({ ...draft, override: n })}
                className="tabular w-20 rounded-lg bg-track px-2 py-1 text-right font-semibold ring-1 ring-line focus:ring-2 focus:ring-brand focus:outline-none"
                aria-label={`${it.name} total calories`}
              />
            </td>
            <td className="w-10 pt-2 pl-1 text-xs font-normal text-ink-3">kcal</td>
          </tr>
        </tbody>
      </table>
      {it.kcalLow !== undefined && (
        <div className="mt-1.5 rounded-lg bg-track px-2.5 py-1.5 text-xs text-ink-2">
          Likely <span className="tabular font-semibold text-ink">{it.kcalLow}–{Math.round(it.kcal)} kcal</span>, depending on portion and oil.
          Logging the upper end.
        </div>
      )}
      <div className="tabular mt-2 text-xs text-ink-2">
        Protein {Math.round(it.protein)}g · Carbs {Math.round(it.carbs)}g · Fat {Math.round(it.fat)}g
      </div>
      {fixOpen ? (
        <div className="mt-2 rounded-xl bg-track p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {modSuggestions(it.name).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => addMod(m)}
                className={`rounded-full px-2.5 py-1 text-xs ring-1 ${note.toLowerCase().includes(m) ? "bg-brand font-semibold text-white ring-brand" : "bg-card ring-line active:opacity-70"}`}
              >
                {m}
              </button>
            ))}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitFix();
            }}
          >
            <input
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did I miss? e.g. kosong, no gravy, it was fish"
              className="min-w-0 flex-1 rounded-lg bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
            />
            <button disabled={fixing || !note.trim()} className="rounded-lg bg-brand px-3 text-sm font-semibold text-white disabled:opacity-40">
              {fixing ? "…" : "Update"}
            </button>
          </form>
          <button type="button" onClick={() => setFixOpen(false)} className="mt-1.5 text-xs text-ink-3">
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setFixOpen(true)} className="mt-2 rounded-full bg-track px-3 py-1.5 text-xs font-semibold text-ink-2 active:opacity-70">
          ✏️ Modify
        </button>
      )}
      {fixError && <p className="mt-1 text-xs text-over">{fixError}</p>}
    </li>
  );
}

// A whole-number box that shows exactly what you type while you're editing (so clearing it doesn't leave a 0 that
// your digits then get appended to), and only snaps back to the computed value when you leave it.
function KcalInput({ value, onChange, ...rest }: { value: number; onChange: (n: number) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={text ?? String(value)}
      onFocus={(e) => {
        setText(String(value));
        e.target.select();
      }}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
        setText(digits);
        if (digits) onChange(Number(digits));
      }}
      onBlur={() => {
        if (text === "") onChange(0);
        setText(null);
      }}
    />
  );
}

/* ---------------- Sheets ---------------- */

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

const EXAMPLES = ["chicken rice less rice + kopi-c", "1 bowl rice, 3 tbsp kailan, 2 tbsp curry chicken", "2 egg prata + teh peng"];

// Your usual foods for the meal you're probably logging, from your own history.
function useUsuals(meal: Meal) {
  const [items, setItems] = useState<FoodItem[] | null>(null);
  useEffect(() => {
    fetch(`/api/foods/suggest?meal=${meal}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j: { items: FoodItem[] }) => setItems(j.items))
      .catch(() => setItems([]));
  }, [meal]);
  return { meal, items };
}

function ComposeSheet(p: {
  meal: Meal;
  text: string;
  setText: (s: string) => void;
  parsing: boolean;
  error: string | null;
  onSubmit: (picked: FoodItem[]) => void;
  onManual: (items: FoodItem[], meal: Meal) => Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const usuals = useUsuals(p.meal);
  const [picked, setPicked] = useState<number[]>([]);
  const pickedItems = picked.map((i) => usuals.items![i]);
  const pickedKcal = Math.round(pickedItems.reduce((a, x) => a + x.kcal * (x.portion ?? 1), 0));
  const toggle = (i: number) => setPicked((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]));
  const submit = () => p.onSubmit(pickedItems);
  return (
    <Sheet title="What did you eat?" onClose={p.onClose}>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-track p-1 text-sm">
        {(["ai", "manual"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`rounded-lg py-1.5 ${mode === m ? "bg-card font-semibold shadow-sm" : "text-ink-2"}`}>
            {m === "ai" ? "✨ Ask AI" : "✏️ Enter manually"}
          </button>
        ))}
      </div>
      {mode === "manual" ? <ManualForm meal={p.meal} onAdd={p.onManual} /> : (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          autoFocus
          value={p.text}
          onChange={(e) => p.setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder="e.g. chicken rice less rice + kopi-c"
          className="w-full resize-none rounded-xl bg-track px-3 py-2.5 outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-brand"
        />
        {p.error && <p className="mt-2 text-sm text-over">{p.error}</p>}
        {usuals.items?.length ? (
          <div className="mt-2">
            <div className="text-xs text-ink-3">Your usual for {MEAL_LABEL[usuals.meal].toLowerCase()} · tap to add, no AI needed</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {usuals.items.map((it, i) => {
                const on = picked.includes(i);
                return (
                  <button
                    type="button"
                    key={`${it.name}|${it.quantity}`}
                    onClick={() => toggle(i)}
                    aria-pressed={on}
                    className={`rounded-full px-2.5 py-1 text-xs ring-1 active:opacity-70 ${on ? "bg-brand text-white ring-brand" : "bg-track text-ink-2 ring-transparent"}`}
                  >
                    {on ? "✓ " : ""}
                    {it.name} <span className={on ? "text-white/75" : "text-ink-3"}>{Math.round(it.kcal * (it.portion ?? 1))}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          usuals.items &&
          !p.text && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES.map((x) => (
                <button type="button" key={x} onClick={() => p.setText(x)} className="rounded-full bg-track px-2.5 py-1 text-xs text-ink-2 active:opacity-70">
                  {x}
                </button>
              ))}
            </div>
          )
        )}
        <button
          type="submit"
          disabled={p.parsing || (!p.text.trim() && !picked.length)}
          className="mt-3 h-12 w-full rounded-xl bg-brand font-semibold text-brand-ink disabled:opacity-40"
        >
          {p.parsing
            ? "Looking it up…"
            : p.text.trim()
              ? picked.length
                ? `Look up calories + ${picked.length} picked`
                : "Look up calories"
              : picked.length
                ? `Add ${picked.length} picked · ${pickedKcal.toLocaleString()} kcal`
                : "Look up calories"}
        </button>
      </form>
      )}
    </Sheet>
  );
}

// Your starred foods, most logged first.
function useFavourites() {
  const [foods, setFoods] = useState<MyFood[] | null>(null);
  useEffect(() => {
    fetch("/api/foods")
      .then((r) => (r.ok ? r.json() : { foods: [] }))
      .then((j: { foods: MyFood[] }) => setFoods(j.foods.filter((f) => f.favourite).sort((a, b) => b.times - a.times)))
      .catch(() => setFoods([]));
  }, []);
  return foods;
}

const sameFood = (f: { name: string; quantity: string }, g: { name: string; quantity: string }) =>
  f.name.trim().toLowerCase() === g.name.trim().toLowerCase() && f.quantity.trim().toLowerCase() === g.quantity.trim().toLowerCase();

function ManualForm({ meal: initialMeal, onAdd }: { meal: Meal; onAdd: (items: FoodItem[], meal: Meal) => Promise<void> }) {
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [f, setF] = useState({ name: "", quantity: "", kcal: "", protein: "", carbs: "", fat: "" });
  const [saving, setSaving] = useState(false);
  const [favourite, setFavourite] = useState(false);
  const favourites = useFavourites();
  const logFavourite = async (x: MyFood) => {
    if (saving) return;
    setSaving(true);
    await onAdd(
      [{ name: x.name, quantity: x.quantity, kcal: x.kcal, protein: x.protein, carbs: x.carbs, fat: x.fat, source: x.kind === "custom" || x.edited ? "my food" : "history", confidence: "high" }],
      meal,
    );
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const ok = f.name.trim() && Number(f.kcal) >= 0 && f.kcal !== "";
  const field = "mt-1 w-full rounded-lg bg-track px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-brand";

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return;
        setSaving(true);
        await onAdd(
          [
            {
              name: f.name.trim(),
              quantity: f.quantity.trim() || "1 serving",
              kcal: Math.round(Number(f.kcal)),
              protein: Number(f.protein) || 0,
              carbs: Number(f.carbs) || 0,
              fat: Number(f.fat) || 0,
              source: "manual",
              confidence: "high",
              favourite,
            },
          ],
          meal,
        );
      }}
    >
      <MealPicker meal={meal} setMeal={setMeal} />
      {favourites && favourites.length > 0 && (
        <div>
          <div className="text-xs text-ink-3">★ Favourites · tap to add to {MEAL_LABEL[meal].toLowerCase()}</div>
          <ul className="mt-1.5 max-h-56 divide-y divide-line overflow-y-auto rounded-xl bg-track">
            {favourites.map((x) => (
              <li key={x.id}>
                <button type="button" disabled={saving} onClick={() => logFavourite(x)} className="flex w-full items-center gap-3 px-3 py-2 text-left active:opacity-60 disabled:opacity-40">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{x.name}</div>
                    <div className="truncate text-xs text-ink-3">{x.quantity}</div>
                  </div>
                  <span className="tabular text-sm font-medium">{Math.round(x.kcal)}</span>
                  <span className="text-lg leading-none text-brand">+</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-xs text-ink-3">Or enter something new</div>
        </div>
      )}
      <label className="block text-sm text-ink-2">
        Dish
        <input autoFocus value={f.name} onChange={set("name")} placeholder="e.g. Mum's fried bee hoon" className={field} />
      </label>
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <label className="block text-sm text-ink-2">
          Amount
          <input value={f.quantity} onChange={set("quantity")} placeholder="1 plate" className={field} />
        </label>
        <label className="block text-sm text-ink-2">
          Calories
          <input type="number" inputMode="numeric" value={f.kcal} onChange={set("kcal")} placeholder="kcal" className={`${field} tabular font-semibold`} />
        </label>
      </div>
      <div className="-mb-2 text-sm text-ink-2">
        Macros <span className="text-ink-3">(optional)</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["protein", "carbs", "fat"] as const).map((k) => (
          <label key={k} className="block text-xs text-ink-3">
            {k[0].toUpperCase() + k.slice(1)} g
            <input type="number" inputMode="decimal" value={f[k]} onChange={set(k)} className={`${field} tabular`} />
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-2">
        <input type="checkbox" checked={favourite} onChange={(e) => setFavourite(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
        ★ Save to favourites for one-tap logging
      </label>
      <button disabled={!ok || saving} className="h-12 w-full rounded-xl bg-brand font-semibold text-white disabled:opacity-40">
        {saving ? "Adding…" : `Add ${f.kcal ? Math.round(Number(f.kcal)) + " kcal" : ""} to ${MEAL_LABEL[meal]}`}
      </button>
    </form>
  );
}

type Shown = FoodItem & { breakdown: { label: string; kcal: number }[] };
// A looked-up item plus what you changed on Check & log: portion, parts you didn't eat, and a typed-in total.
type Draft = { base: Shown; portion: number; removed: string[]; override: number | null };

const toDrafts = (xs: FoodItem[]): Draft[] =>
  xs.map((x) => ({
    base: { ...x, breakdown: x.breakdown ?? [{ label: `${x.name}, ${x.quantity}`, kcal: Math.round(x.kcal) }] },
    portion: x.portion ?? 1,
    removed: [],
    override: null,
  }));

const PORTIONS = [0.25, 0.5, 0.75, 1, 1.5, 2];
const FRACTION: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾", "1.5": "1½" };
const portionLabel = (p: number) => FRACTION[String(p)] ?? String(+p.toFixed(2));
// "½ × 1 plate": the serving with how many of it you had.
const amount = (quantity: string, portion = 1) => (portion !== 1 ? `${portionLabel(portion)} × ${quantity}` : quantity);

// What actually gets logged. No AI call needed: parts carry their own calories, so unticking one just subtracts it.
function view(d: Draft): Shown {
  const b = d.base;
  const gone = (b.parts ?? []).filter((p) => d.removed.includes(p.name));
  const minus = (k: "kcal" | "protein" | "carbs" | "fat") => gone.reduce((a, p) => a + p[k], 0);
  const breakdown = [...b.breakdown, ...gone.map((p) => ({ label: `No ${p.name.toLowerCase()}`, kcal: -p.kcal }))];
  const kept = Math.max(0, b.kcal - minus("kcal"));
  const scaled = Math.round(kept * d.portion);
  if (d.portion !== 1) breakdown.push({ label: `${portionLabel(d.portion)} portion`, kcal: scaled - kept });
  const f = d.override !== null && scaled > 0 ? d.override / scaled : 1;
  const macro = (k: "protein" | "carbs" | "fat") => +Math.max(0, (b[k] - minus(k)) * d.portion * f).toFixed(1);
  const low = b.kcalLow !== undefined ? Math.round((b.kcalLow - minus("kcal")) * d.portion) : undefined;
  const kcal = d.override ?? scaled;
  return {
    ...b,
    name: gone.length ? `${b.name} (no ${gone.map((p) => p.name.toLowerCase()).join(", ")})` : b.name,
    quantity: b.quantity,
    portion: d.portion,
    kcal,
    kcalLow: d.override === null && low !== undefined && low > 0 && low < kcal ? low : undefined,
    protein: macro("protein"),
    carbs: macro("carbs"),
    fat: macro("fat"),
    source: d.override !== null && !b.source.includes("edited") ? `${b.source} (edited)` : b.source,
    breakdown,
  };
}

function PortionPicker({ value, onChange }: { value: number; onChange: (p: number) => void }) {
  const custom = !PORTIONS.includes(value);
  const [text, setText] = useState(custom ? String(value) : "");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-ink-3">Portion</span>
      {PORTIONS.map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={value === p}
          onClick={() => {
            setText("");
            onChange(p);
          }}
          className={`h-7 min-w-8 rounded-full px-2 ring-1 ${value === p ? "bg-brand font-semibold text-white ring-brand" : "bg-card ring-line active:opacity-70"}`}
        >
          {portionLabel(p)}
        </button>
      ))}
      <label className={`flex h-7 items-center rounded-full px-2 ring-1 ${custom ? "ring-brand" : "ring-line"}`}>
        <span className="text-ink-3">×</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          value={text}
          placeholder="other"
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (n > 0 && n <= 20) onChange(n);
          }}
          className="tabular w-11 bg-transparent pl-1 outline-none placeholder:text-ink-3"
          aria-label="Custom portion multiplier"
        />
      </label>
    </div>
  );
}

function ReviewSheet(p: {
  meal: Meal;
  items: FoodItem[];
  questions: Clarification[];
  onAnswer: (a: { question: string; answer: string }[]) => Promise<void>;
  onClose: () => void;
  onAdd: (i: FoodItem[], m: Meal) => Promise<void>;
}) {
  const { items: initial, onClose, onAdd } = p;
  // Each item keeps the AI's original working so the table can show your changes separately.
  const [drafts, setDrafts] = useState(() => toDrafts(initial));
  useEffect(() => setDrafts(toDrafts(initial)), [initial]);
  const [meal, setMeal] = useState<Meal>(p.meal);
  const [saving, setSaving] = useState(false);
  const items = drafts.map(view);
  const total = Math.round(sum(items, "kcal"));

  // Re-asks the AI about one item with the user's correction, e.g. "kosong" or "large plate".
  // The note goes on the first line too, so the database search sees e.g. "Iced Teh kosong".
  // The portion you picked carries over unless the correction itself changes it (e.g. "only ate half").
  async function fix(idx: number, note: string) {
    const it = view(drafts[idx]);
    const keep = drafts[idx].portion;
    const r = await fetch("/api/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `${it.name} ${note} (${it.quantity})\nCorrection from me: ${note}` }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Lookup failed");
    if (!j.items.length) throw new Error("Couldn't work that out. Try rewording.");
    const fixed = toDrafts(j.items).map((d) => (d.portion === 1 ? { ...d, portion: keep } : d));
    setDrafts((xs) => [...xs.slice(0, idx), ...fixed, ...xs.slice(idx + 1)]);
  }

  return (
    <Sheet title="Check & log" onClose={onClose}>
      {p.questions.length > 0 && <Questions questions={p.questions} onAnswer={p.onAnswer} />}
      <MealPicker meal={meal} setMeal={setMeal} />
      <ul className="mt-3 divide-y divide-line">
        {drafts.map((d, i) => (
          <ReviewItem
            key={i}
            draft={d}
            onChange={(next) => setDrafts((xs) => xs.map((x, j) => (j === i ? next : x)))}
            onFix={(note) => fix(i, note)}
            onRemove={() => setDrafts((xs) => xs.filter((_, j) => j !== i))}
          />
        ))}
      </ul>
      <MissedItem
        onAdd={async (text) => {
          const r = await fetch("/api/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error ?? "Lookup failed");
          if (!j.items.length) throw new Error("Couldn't find any food in that. Try rephrasing.");
          setDrafts((xs) => [...xs, ...toDrafts(j.items)]);
        }}
      />
      <button
        disabled={!items.length || saving}
        onClick={async () => {
          setSaving(true);
          await onAdd(items.map((x) => ({ ...x, breakdown: undefined, parts: undefined })), meal);
        }}
        className="mt-3 h-12 w-full rounded-xl bg-brand font-semibold text-brand-ink disabled:opacity-40"
      >
        Add {total} kcal to {MEAL_LABEL[meal]}
      </button>
    </Sheet>
  );
}

function MissedItem({ onAdd }: { onAdd: (text: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="mt-1 w-full rounded-xl border border-dashed border-line py-2.5 text-sm text-ink-2 active:bg-track">
        + Add something I missed
      </button>
    );
  return (
    <form
      className="mt-1 rounded-xl bg-track p-2.5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        setBusy(true);
        setError(null);
        try {
          await onAdd(text.trim());
          setText("");
          setOpen(false);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Lookup failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex gap-2">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. a fried egg, 1 curry puff"
          className="min-w-0 flex-1 rounded-lg bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
        />
        <button disabled={busy || !text.trim()} className="rounded-lg bg-brand px-3 text-sm font-semibold text-white disabled:opacity-40">
          {busy ? "…" : "Add"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-over">{error}</p>}
      <button type="button" onClick={() => setOpen(false)} className="mt-1.5 text-xs text-ink-3">
        Cancel
      </button>
    </form>
  );
}

function Questions({ questions, onAnswer }: { questions: Clarification[]; onAnswer: (a: { question: string; answer: string }[]) => Promise<void> }) {
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setPicked({}), [questions]);
  const answered = Object.keys(picked).length;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onAnswer(Object.entries(picked).map(([i, answer]) => ({ question: questions[Number(i)].question, answer })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 rounded-2xl bg-brand-soft p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-brand-strong">
        <span aria-hidden>🤔</span> A quick question so the numbers are right
      </div>
      {questions.map((q, i) => (
        <div key={q.question} className="mt-2">
          <div className="text-sm">{q.question}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {q.options.map((o) => (
              <button
                key={o}
                onClick={() => setPicked((p) => ({ ...p, [i]: o }))}
                className={`rounded-full px-3 py-1.5 text-sm ring-1 ${picked[i] === o ? "bg-brand font-semibold text-white ring-brand" : "bg-card ring-line active:opacity-70"}`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      ))}
      {error && <p className="mt-2 text-sm text-over">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button disabled={!answered || busy} onClick={submit} className="h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-40">
          {busy ? "Updating…" : "Update calories"}
        </button>
        <span className="text-xs text-ink-3">Or skip: the numbers below use the most common choice.</span>
      </div>
    </div>
  );
}

function EntrySheet({ entry, onClose, onSaved, onDelete }: { entry: Entry; onClose: () => void; onSaved: () => void; onDelete: () => void }) {
  const [meal, setMeal] = useState<Meal>(entry.meal);
  const [f, setF] = useState({
    name: entry.name,
    quantity: entry.quantity,
    kcal: String(Math.round(entry.kcal)),
    protein: String(entry.protein),
    carbs: String(entry.carbs),
    fat: String(entry.fat),
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [portion, setPortion] = useState(entry.portion ?? 1);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  // The entry holds what you ate; Amount is one serving. Picking a portion works from that one full serving,
  // so an entry logged at ½ shows ½ here, and 1 gives the whole plate.
  const logged = entry.portion ?? 1;
  const favourites = useFavourites();
  const [starred, setStarred] = useState<boolean | null>(null);
  const isFavourite = starred ?? (favourites ? favourites.some((x) => sameFood(x, entry)) : null);
  const toggleStar = async () => {
    setStarred(!isFavourite);
    await fetch("/api/foods", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: entry.name, quantity: entry.quantity, favourite: !isFavourite }),
    });
  };
  const pickPortion = (p: number) => {
    setPortion(p);
    const k = p / logged;
    setF({
      ...f,
      kcal: String(Math.round(entry.kcal * k)),
      protein: String(+(entry.protein * k).toFixed(1)),
      carbs: String(+(entry.carbs * k).toFixed(1)),
      fat: String(+(entry.fat * k).toFixed(1)),
    });
  };
  // Changing calories scales the macros along with it, unless you edit those yourself.
  const setKcal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const k = Number(e.target.value);
    const ratio = entry.kcal > 0 && k > 0 ? k / entry.kcal : null;
    setF({
      ...f,
      kcal: e.target.value,
      ...(ratio && {
        protein: String(+(entry.protein * ratio).toFixed(1)),
        carbs: String(+(entry.carbs * ratio).toFixed(1)),
        fat: String(+(entry.fat * ratio).toFixed(1)),
      }),
    });
  };
  const field = "mt-1 w-full rounded-lg bg-track px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-brand";

  async function save() {
    setSaving(true);
    setError(null);
    const r = await fetch("/api/entries", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: entry.id, meal, ...f, portion }),
    });
    setSaving(false);
    if (!r.ok) return setError((await r.json()).error ?? "Couldn't save");
    onSaved();
  }

  return (
    <Sheet title="Edit food" onClose={onClose}>
      <div className="space-y-3">
        <MealPicker meal={meal} setMeal={setMeal} />
        <label className="block text-sm text-ink-2">
          Dish
          <input value={f.name} onChange={set("name")} className={field} />
        </label>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <label className="block text-sm text-ink-2">
            One serving
            <input value={f.quantity} onChange={set("quantity")} className={field} />
          </label>
          <label className="block text-sm text-ink-2">
            Calories
            <input type="number" inputMode="numeric" value={f.kcal} onChange={setKcal} className={`${field} tabular font-semibold`} />
          </label>
        </div>
        <PortionPicker value={portion} onChange={pickPortion} />
        {entry.kcalLow !== undefined && (
          <p className="text-xs text-ink-3">
            The AI&apos;s likely range was {entry.kcalLow}–{Math.round(entry.kcal)} kcal. Saving makes your number exact.
          </p>
        )}
        <div className="grid grid-cols-3 gap-2">
          {(["protein", "carbs", "fat"] as const).map((k) => (
            <label key={k} className="block text-xs text-ink-3">
              {k[0].toUpperCase() + k.slice(1)} g
              <input type="number" inputMode="decimal" value={f[k]} onChange={set(k)} className={`${field} tabular`} />
            </label>
          ))}
        </div>
        {error && <p className="text-sm text-over">{error}</p>}
        <button disabled={saving || !f.name.trim() || f.kcal === ""} onClick={save} className="h-12 w-full rounded-xl bg-brand font-semibold text-white disabled:opacity-40">
          {saving ? "Saving…" : "Save changes"}
        </button>
        <p className="text-center text-xs text-ink-3">Your corrected numbers are remembered for next time.</p>
        {isFavourite !== null && (
          <button onClick={toggleStar} aria-pressed={isFavourite} className="h-11 w-full rounded-xl text-sm text-ink-2 ring-1 ring-line active:bg-track">
            {isFavourite ? "★ In your favourites · tap to remove" : "☆ Add to favourites"}
          </button>
        )}
        <button onClick={() => confirm(`Delete ${entry.name}?`) && onDelete()} className="h-11 w-full rounded-xl text-sm text-over active:bg-track">
          Delete from diary
        </button>
      </div>
    </Sheet>
  );
}

function BudgetSheet({ budget, onClose }: { budget: Budget; onClose: () => void }) {
  const signed = (n: number) => (n < 0 ? `−${Math.abs(Math.round(n)).toLocaleString()}` : Math.round(n).toLocaleString());
  return (
    <Sheet title="How today's budget was worked out" onClose={onClose}>
      <ul className="divide-y divide-line">
        {budget.lines.map((l, i) => (
          <li key={i} className={`flex gap-3 py-2.5 ${l.total ? "font-semibold" : ""}`}>
            <div className="min-w-0 flex-1">
              <div className="text-sm">{l.label}</div>
              {l.detail && <div className="mt-0.5 text-xs font-normal text-ink-3">{l.detail}</div>}
            </div>
            {l.kcal !== null && <div className={`tabular shrink-0 text-sm ${l.kcal < 0 ? "text-good" : ""}`}>{signed(l.kcal)}</div>}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-3">Change how this works in Settings → How your budget is calculated. Set your goal weight and date on the Weight page.</p>
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
        Copy these from the Health app (Browse → Activity → Active Energy / Resting Energy), or set up automatic Apple Health sync in Settings.
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
