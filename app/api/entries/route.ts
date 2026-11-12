import { NextResponse } from "next/server";
import { addEntries, deleteEntry, updateEntry, getEnergy, getSettings, listEntries, recordFoods } from "@/lib/db";
import { isDate } from "@/lib/date";
import { currentUserId, unauthorized } from "@/lib/session";
import { MEALS, type FoodItem, type Meal } from "@/lib/types";

export async function GET(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const date = new URL(req.url).searchParams.get("date");
  if (!isDate(date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  const [entries, energy, settings] = await Promise.all([listEntries(uid, date), getEnergy(uid, date), getSettings(uid)]);
  return NextResponse.json({ entries, energy, settings });
}

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const body = (await req.json()) as { date?: string; meal?: Meal; items?: FoodItem[] };
  if (!isDate(body.date) || !body.meal || !MEALS.includes(body.meal) || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const items = body.items
    .filter((i) => i && typeof i.name === "string" && Number.isFinite(Number(i.kcal)))
    .map((i) => ({
      name: i.name.slice(0, 200),
      quantity: String(i.quantity ?? "").slice(0, 200),
      kcal: Math.round(Number(i.kcal)),
      kcalLow: Number(i.kcalLow) > 0 && Number(i.kcalLow) < Number(i.kcal) ? Math.round(Number(i.kcalLow)) : undefined,
      protein: Number(i.protein) || 0,
      carbs: Number(i.carbs) || 0,
      fat: Number(i.fat) || 0,
      source: String(i.source ?? "manual").slice(0, 200),
      confidence: (["high", "medium", "low"].includes(i.confidence) ? i.confidence : "medium") as FoodItem["confidence"],
      note: i.note ? String(i.note).slice(0, 300) : undefined,
    }));
  if (items.length) await addEntries(uid, body.date, body.meal, items);
  // Every logged food goes into your Foods dictionary; corrected calories are used by the AI next time.
  await recordFoods(uid, items);
  return NextResponse.json({ ok: true });
}

// Correct a logged item. The corrected numbers are also remembered for next time.
export async function PATCH(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as Partial<FoodItem> & { id?: number; meal?: Meal };
  const id = Number(b.id);
  const kcal = Number(b.kcal);
  const name = String(b.name ?? "").trim().slice(0, 200);
  if (!Number.isInteger(id) || !name || !Number.isFinite(kcal) || kcal < 0 || !b.meal || !MEALS.includes(b.meal)) {
    return NextResponse.json({ error: "Name and calories are required" }, { status: 400 });
  }
  const fixed = {
    meal: b.meal,
    name,
    quantity: String(b.quantity ?? "").trim().slice(0, 200),
    kcal: Math.round(kcal),
    protein: Math.max(0, Number(b.protein) || 0),
    carbs: Math.max(0, Number(b.carbs) || 0),
    fat: Math.max(0, Number(b.fat) || 0),
  };
  const source = await updateEntry(uid, id, fixed);
  if (source === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await recordFoods(uid, [{ ...fixed, source, confidence: "high" }], false);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await deleteEntry(uid, id);
  return NextResponse.json({ ok: true });
}
