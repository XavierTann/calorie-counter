"use client";

import { AppHeader } from "@/components/AppHeader";
import { Buddy, buddyLine } from "@/components/Buddy";
import { Sheet } from "@/components/Sheet";
import { useCallback, useEffect, useState } from "react";
import { dailyBudget } from "@/lib/budget";
import type { Clarification } from "@/lib/parse";
import { MEALS, type Energy, type Entry, type FoodItem, type Meal, type Settings } from "@/lib/types";

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

type DayData = { entries: Entry[]; energy: Energy | null; settings: Settings };

export default function Home() {
  const [date, setDate] = useState(localDate);
  const [data, setData] = useState<DayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "compose" | "review" | "energy">(null);
  const [draft, setDraft] = useState<FoodItem[]>([]);
  const [questions, setQuestions] = useState<Clarification[]>([]);
  const [asked, setAsked] = useState(""); // the text that produced the current draft
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/entries?date=${date}`);
    if (r.status === 401) return (window.location.href = "/login");
    setData(await r.json());
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  async function lookup(query: string) {
    const r = await fetch("/api/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: query }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Lookup failed");
    if (!j.items.length) throw new Error("Couldn't find any food in that. Try rephrasing.");
    setDraft(j.items);
    setQuestions(j.questions ?? []);
    setAsked(query);
  }

  async function submitText() {
    if (!text.trim() || parsing) return;
    setParsing(true);
    setError(null);
    try {
      await lookup(text);
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
    await lookup(`${asked}\n\nAnswers to your questions:\n${answers.map((a) => `- ${a.question} ${a.answer}`).join("\n")}`);
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
    <main className="mx-auto min-h-dvh max-w-xl pb-28" style={{ paddingTop: "env(safe-area-inset-top)" }}>
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
          <Summary data={data} onEditEnergy={() => setSheet("energy")} />
          <div className="mt-3 space-y-3 px-4">
            {MEALS.map((m) => (
              <MealCard key={m} meal={m} entries={data.entries.filter((e) => e.meal === m)} onRemove={remove} onEdit={(e) => setEditing(e)} />
            ))}
          </div>
        </>
      )}

      <button
        aria-label="Log food"
        onClick={() => {
          setError(null);
          setSheet("compose");
        }}
        className="fab fixed right-5 z-10 flex h-16 w-16 items-center justify-center rounded-full text-4xl leading-none font-light text-white shadow-lg active:scale-95"
        style={{ bottom: "max(calc(env(safe-area-inset-bottom) + 12px), 24px)", transition: "transform 120ms" }}
      >
        +
      </button>

      {sheet === "compose" && (
        <ComposeSheet text={text} setText={setText} parsing={parsing} error={error} onSubmit={submitText} onManual={addItems} onClose={() => setSheet(null)} />
      )}
      {sheet === "review" && <ReviewSheet items={draft} questions={questions} onAnswer={answer} onClose={() => setSheet(null)} onAdd={addItems} />}
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

function MealCard({ meal, entries, onRemove, onEdit }: { meal: Meal; entries: Entry[]; onRemove: (id: number) => void; onEdit: (e: Entry) => void }) {
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
      </div>
      {entries.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
              <button onClick={() => onEdit(e)} className="min-w-0 flex-1 text-left" aria-label={`Edit ${e.name}`}>
                <div className="truncate text-[15px]">{e.name}</div>
                <div className="truncate text-xs text-ink-3">
                  {e.quantity}
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
  if (base.startsWith("db:")) return "Hawker database" + edited;
  if (base.startsWith("kr:")) return "Korea MFDS database" + edited;
  if (base.startsWith("in:")) return "Indian Nutrient Databank" + edited;
  if (base.startsWith("fdc:")) return "USDA FoodData Central" + edited;
  if (base.startsWith("home")) return "Home cooking" + edited;
  if (base.startsWith("web")) return base.replace(/^web:\s*/, "") + edited;
  if (base === "learned" || base === "my food") return "My foods" + edited;
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

function ReviewItem({
  item: it,
  onKcal,
  onFix,
  onRemove,
}: {
  item: FoodItem & { breakdown: { label: string; kcal: number }[] };
  onKcal: (k: number) => void;
  onFix: (note: string) => Promise<void>;
  onRemove: () => void;
}) {
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
    } catch (e) {
      setFixError(e instanceof Error ? e.message : "Lookup failed");
      setFixing(false);
    }
  }
  const aiTotal = it.breakdown.reduce((a, b) => a + b.kcal, 0);
  const yourEdit = Math.round(it.kcal) - aiTotal;
  const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
  const conf = CONFIDENCE[it.confidence] ?? CONFIDENCE.medium;
  return (
    <li className="py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium">{it.name}</div>
          <div className="text-xs text-ink-3">{it.quantity}</div>
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
              <input
                type="number"
                inputMode="numeric"
                value={Math.round(it.kcal)}
                onChange={(e) => onKcal(Number(e.target.value) || 0)}
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
            placeholder="What's different? e.g. large plate, no gravy, it was fish"
            className="min-w-0 flex-1 rounded-lg bg-track px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
          <button disabled={fixing || !note.trim()} className="rounded-lg bg-brand px-3 text-sm font-semibold text-white disabled:opacity-40">
            {fixing ? "…" : "Fix"}
          </button>
        </form>
      ) : (
        <p className="mt-1.5 text-[11px] text-ink-3">
          Tap the total to type your own number, or{" "}
          <button onClick={() => setFixOpen(true)} className="font-semibold text-brand-strong underline">
            tell the AI what&apos;s off
          </button>
          . Corrections are remembered.
        </p>
      )}
      {fixError && <p className="mt-1 text-xs text-over">{fixError}</p>}
    </li>
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

function ComposeSheet(p: {
  text: string;
  setText: (s: string) => void;
  parsing: boolean;
  error: string | null;
  onSubmit: () => void;
  onManual: (items: FoodItem[], meal: Meal) => Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  return (
    <Sheet title="What did you eat?" onClose={p.onClose}>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-track p-1 text-sm">
        {(["ai", "manual"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`rounded-lg py-1.5 ${mode === m ? "bg-card font-semibold shadow-sm" : "text-ink-2"}`}>
            {m === "ai" ? "✨ Ask AI" : "✏️ Enter manually"}
          </button>
        ))}
      </div>
      {mode === "manual" ? <ManualForm onAdd={p.onManual} /> : (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          p.onSubmit();
        }}
      >
        <textarea
          autoFocus
          value={p.text}
          onChange={(e) => p.setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              p.onSubmit();
            }
          }}
          rows={3}
          placeholder="e.g. chicken rice less rice + kopi-c"
          className="w-full resize-none rounded-xl bg-track px-3 py-2.5 outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-brand"
        />
        {p.error && <p className="mt-2 text-sm text-over">{p.error}</p>}
        {!p.text && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXAMPLES.map((x) => (
              <button type="button" key={x} onClick={() => p.setText(x)} className="rounded-full bg-track px-2.5 py-1 text-xs text-ink-2 active:opacity-70">
                {x}
              </button>
            ))}
          </div>
        )}
        <button
          type="submit"
          disabled={p.parsing || !p.text.trim()}
          className="mt-3 h-12 w-full rounded-xl bg-brand font-semibold text-brand-ink disabled:opacity-40"
        >
          {p.parsing ? "Looking it up…" : "Look up calories"}
        </button>
      </form>
      )}
    </Sheet>
  );
}

function ManualForm({ onAdd }: { onAdd: (items: FoodItem[], meal: Meal) => Promise<void> }) {
  const [meal, setMeal] = useState<Meal>(mealForNow);
  const [f, setF] = useState({ name: "", quantity: "", kcal: "", protein: "", carbs: "", fat: "" });
  const [saving, setSaving] = useState(false);
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
            },
          ],
          meal,
        );
      }}
    >
      <MealPicker meal={meal} setMeal={setMeal} />
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
      <button disabled={!ok || saving} className="h-12 w-full rounded-xl bg-brand font-semibold text-white disabled:opacity-40">
        {saving ? "Adding…" : `Add ${f.kcal ? Math.round(Number(f.kcal)) + " kcal" : ""} to ${MEAL_LABEL[meal]}`}
      </button>
    </form>
  );
}

const withBreakdown = (xs: FoodItem[]) => xs.map((x) => ({ ...x, breakdown: x.breakdown ?? [{ label: `${x.name}, ${x.quantity}`, kcal: Math.round(x.kcal) }] }));

function ReviewSheet(p: {
  items: FoodItem[];
  questions: Clarification[];
  onAnswer: (a: { question: string; answer: string }[]) => Promise<void>;
  onClose: () => void;
  onAdd: (i: FoodItem[], m: Meal) => Promise<void>;
}) {
  const { items: initial, onClose, onAdd } = p;
  // Each item keeps the AI's original working so the table can show your edit separately.
  const [items, setItems] = useState(() => withBreakdown(initial));
  useEffect(() => setItems(withBreakdown(initial)), [initial]);
  const [meal, setMeal] = useState<Meal>(mealForNow);
  const [saving, setSaving] = useState(false);
  const total = Math.round(sum(items, "kcal"));

  function setKcal(idx: number, kcal: number) {
    setItems((xs) =>
      xs.map((x, i) => {
        if (i !== idx) return x;
        // Scale macros with the calorie edit so they stay consistent.
        const f = x.kcal > 0 ? kcal / x.kcal : 1;
        return { ...x, kcal, kcalLow: undefined, protein: +(x.protein * f).toFixed(1), carbs: +(x.carbs * f).toFixed(1), fat: +(x.fat * f).toFixed(1), source: x.source.includes("edited") ? x.source : `${x.source} (edited)` };
      }),
    );
  }

  // Re-asks the AI about one item with the user's correction, e.g. "it was a large plate".
  async function fix(idx: number, note: string) {
    const it = items[idx];
    const r = await fetch("/api/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `${it.name}, ${it.quantity}\nCorrection from me: ${note}` }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Lookup failed");
    if (!j.items.length) throw new Error("Couldn't work that out. Try rewording.");
    setItems((xs) => [...xs.slice(0, idx), ...withBreakdown(j.items), ...xs.slice(idx + 1)]);
  }

  return (
    <Sheet title="Check & log" onClose={onClose}>
      {p.questions.length > 0 && <Questions questions={p.questions} onAnswer={p.onAnswer} />}
      <MealPicker meal={meal} setMeal={setMeal} />
      <ul className="mt-3 divide-y divide-line">
        {items.map((it, i) => (
          <ReviewItem
            key={i}
            item={it}
            onKcal={(k) => setKcal(i, k)}
            onFix={(note) => fix(i, note)}
            onRemove={() => setItems((xs) => xs.filter((_, j) => j !== i))}
          />
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
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
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
      body: JSON.stringify({ id: entry.id, meal, ...f }),
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
            Amount
            <input value={f.quantity} onChange={set("quantity")} className={field} />
          </label>
          <label className="block text-sm text-ink-2">
            Calories
            <input type="number" inputMode="numeric" value={f.kcal} onChange={setKcal} className={`${field} tabular font-semibold`} />
          </label>
        </div>
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
        <button onClick={() => confirm(`Delete ${entry.name}?`) && onDelete()} className="h-11 w-full rounded-xl text-sm text-over active:bg-track">
          Delete from diary
        </button>
      </div>
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
