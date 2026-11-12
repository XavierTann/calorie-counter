import { NextResponse } from "next/server";
import { createCustomFood, deleteMyFood, listMyFoods, updateMyFood, type FoodInput } from "@/lib/db";
import { currentUserId, unauthorized } from "@/lib/session";

function clean(b: Partial<FoodInput>): FoodInput | null {
  const name = String(b.name ?? "").trim().slice(0, 200);
  const kcal = Number(b.kcal);
  if (!name || !Number.isFinite(kcal) || kcal < 0) return null;
  return {
    name,
    quantity: String(b.quantity ?? "").trim().slice(0, 200) || "1 serving",
    kcal: Math.round(kcal),
    protein: Math.max(0, Number(b.protein) || 0),
    carbs: Math.max(0, Number(b.carbs) || 0),
    fat: Math.max(0, Number(b.fat) || 0),
  };
}

const conflict = (e: unknown) => e instanceof Error && /unique/i.test(e.message);

export async function GET() {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  return NextResponse.json({ foods: await listMyFoods(uid) });
}

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const f = clean(await req.json());
  if (!f) return NextResponse.json({ error: "Name and calories are required" }, { status: 400 });
  await createCustomFood(uid, f);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const b = await req.json();
  const id = Number(b.id);
  const f = clean(b);
  if (!Number.isInteger(id) || !f) return NextResponse.json({ error: "Name and calories are required" }, { status: 400 });
  try {
    await updateMyFood(uid, id, f);
  } catch (e) {
    if (conflict(e)) return NextResponse.json({ error: "You already have a food with that name and serving" }, { status: 409 });
    throw e;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await deleteMyFood(uid, id);
  return NextResponse.json({ ok: true });
}
