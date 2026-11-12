"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Sheet } from "@/components/Sheet";
import type { MyFood } from "@/lib/types";

type Tab = "recorded" | "custom";
type Draft = { id?: number; kind: Tab; name: string; quantity: string; kcal: string; protein: string; carbs: string; fat: string };

const emptyDraft: Draft = { kind: "custom", name: "", quantity: "", kcal: "", protein: "", carbs: "", fat: "" };

export default function FoodsPage() {
  const [foods, setFoods] = useState<MyFood[] | null>(null);
  const [tab, setTab] = useState<Tab>("recorded");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/foods");
    if (r.status === 401) return (window.location.href = "/login");
    setFoods((await r.json()).foods);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({ recorded: foods?.filter((f) => f.kind === "recorded").length ?? 0, custom: foods?.filter((f) => f.kind === "custom").length ?? 0 }),
    [foods],
  );
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (foods ?? []).filter((f) => f.kind === tab && (!needle || `${f.name} ${f.quantity}`.toLowerCase().includes(needle)));
  }, [foods, tab, q]);

  const open = (f: MyFood) =>
    setDraft({ id: f.id, kind: f.kind, name: f.name, quantity: f.quantity, kcal: String(f.kcal), protein: String(f.protein), carbs: String(f.carbs), fat: String(f.fat) });

  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-28" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <AppHeader center={<h1 className="text-lg font-semibold">Foods</h1>} />

      <div className="px-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-track p-1 text-sm">
          {(["recorded", "custom"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg py-2 ${tab === t ? "bg-card font-semibold shadow-sm" : "text-ink-2"}`}>
              {t === "recorded" ? "Recorded" : "Custom"} <span className="tabular text-ink-3">{counts[t]}</span>
            </button>
          ))}
        </div>

        <p className="mt-3 text-sm text-ink-2">
          {tab === "recorded"
            ? "Everything you've logged. Tap a food to fix its calories; the AI uses your numbers next time."
            : "Foods you add yourself, like a home recipe or a packaged snack. Type the name when logging and the AI uses these numbers."}
        </p>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search foods"
          className="mt-3 w-full rounded-xl bg-card px-3 py-2.5 ring-1 ring-line outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-brand"
        />

        {!foods ? (
          <p className="py-10 text-center text-ink-3">Loading…</p>
        ) : !shown.length ? (
          <div className="py-12 text-center text-ink-3">
            <div className="text-4xl">{tab === "recorded" ? "🍜" : "🥣"}</div>
            <p className="mt-2">
              {q ? "No matches." : tab === "recorded" ? "Foods you log will show up here." : "No custom foods yet."}
            </p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-line">
            {shown.map((f) => (
              <li key={f.id}>
                <button onClick={() => open(f)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-track">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px]">{f.name}</div>
                    <div className="truncate text-xs text-ink-3">
                      {f.quantity}
                      {f.kind === "recorded" && f.times > 0 && ` · logged ${f.times}×`}
                      {f.kind === "recorded" && f.edited && " · edited"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="tabular font-semibold">{Math.round(f.kcal)}</div>
                    <div className="text-[11px] text-ink-3">kcal</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {tab === "custom" && (
        <button
          onClick={() => setDraft(emptyDraft)}
          className="fab fixed right-5 z-10 flex h-14 items-center gap-2 rounded-full px-5 font-semibold text-brand-ink shadow-lg active:scale-95"
          style={{ bottom: "max(calc(env(safe-area-inset-bottom) + 12px), 24px)" }}
        >
          <span className="text-2xl leading-none">+</span> Custom food
        </button>
      )}

      {draft && <FoodSheet draft={draft} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); load(); }} />}
    </main>
  );
}

function FoodSheet({ draft: initial, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value });
  const isNew = d.id === undefined;

  async function save() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/foods", {
      method: isNew ? "POST" : "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(d),
    });
    setBusy(false);
    if (!r.ok) return setError((await r.json()).error ?? "Couldn't save");
    onSaved();
  }

  async function remove() {
    if (!confirm(`Delete ${d.name} from your foods?`)) return;
    await fetch(`/api/foods?id=${d.id}`, { method: "DELETE" });
    onSaved();
  }

  return (
    <Sheet title={isNew ? "New custom food" : "Edit food"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name">
          <input value={d.name} onChange={set("name")} placeholder="e.g. Mum's lotus root soup" className={inputCls} />
        </Field>
        <Field label="Serving">
          <input value={d.quantity} onChange={set("quantity")} placeholder="e.g. 1 bowl" className={inputCls} />
        </Field>
        <Field label="Calories (kcal)">
          <input type="number" inputMode="numeric" value={d.kcal} onChange={set("kcal")} className={`${inputCls} tabular text-lg font-semibold`} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Protein g">
            <input type="number" inputMode="decimal" value={d.protein} onChange={set("protein")} className={`${inputCls} tabular`} />
          </Field>
          <Field label="Carbs g">
            <input type="number" inputMode="decimal" value={d.carbs} onChange={set("carbs")} className={`${inputCls} tabular`} />
          </Field>
          <Field label="Fat g">
            <input type="number" inputMode="decimal" value={d.fat} onChange={set("fat")} className={`${inputCls} tabular`} />
          </Field>
        </div>
        {d.kind === "recorded" && <p className="text-xs text-ink-3">Changes apply to future logs. Past diary entries stay as they were.</p>}
        {error && <p className="text-sm text-over">{error}</p>}
        <button disabled={busy || !d.name.trim() || d.kcal === ""} onClick={save} className="h-12 w-full rounded-xl bg-brand font-semibold text-brand-ink disabled:opacity-40">
          {isNew ? "Add food" : "Save"}
        </button>
        {!isNew && (
          <button onClick={remove} className="h-11 w-full rounded-xl text-sm text-over active:bg-track">
            Delete food
          </button>
        )}
      </div>
    </Sheet>
  );
}

const inputCls = "mt-1 w-full rounded-lg bg-track px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-brand";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-ink-2">
      {label}
      {children}
    </label>
  );
}
