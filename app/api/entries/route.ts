import { NextResponse } from "next/server";
import { addEntries, deleteEntry, getEnergy, getSettings, listEntries, recordFoods } from "@/lib/db";
import { isDate } from "@/lib/date";
import { MEALS, type FoodItem, type Meal } from "@/lib/types";

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date");
  if (!isDate(date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  const [entries, energy, settings] = await Promise.all([listEntries(date), getEnergy(date), getSettings()]);
  return NextResponse.json({ entries, energy, settings });
}

export async function POST(req: Request) {
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
      protein: Number(i.protein) || 0,
      carbs: Number(i.carbs) || 0,
      fat: Number(i.fat) || 0,
      source: String(i.source ?? "manual").slice(0, 200),
      confidence: (["high", "medium", "low"].includes(i.confidence) ? i.confidence : "medium") as FoodItem["confidence"],
      note: i.note ? String(i.note).slice(0, 300) : undefined,
    }));
  if (items.length) await addEntries(body.date, body.meal, items);
  // Every logged food goes into your Foods dictionary; corrected calories are used by the AI next time.
  await recordFoods(items);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await deleteEntry(id);
  return NextResponse.json({ ok: true });
}
