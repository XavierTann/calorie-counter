import { NextResponse } from "next/server";
import { deleteWeight, getSettings, listWeights, upsertWeight } from "@/lib/db";
import { isDate } from "@/lib/date";
import { currentUserId, unauthorized } from "@/lib/session";

export async function GET() {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const [weights, settings] = await Promise.all([listWeights(uid), getSettings(uid)]);
  return NextResponse.json({ weights, goalKg: settings.goalWeightKg, goalDate: settings.goalDate });
}

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as { date?: string; kg?: number | string };
  const kg = Number(b.kg);
  if (!isDate(b.date) || !Number.isFinite(kg) || kg < 20 || kg > 400) {
    return NextResponse.json({ error: "Enter a weight between 20 and 400 kg" }, { status: 400 });
  }
  await upsertWeight(uid, b.date, Math.round(kg * 10) / 10);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const date = new URL(req.url).searchParams.get("date");
  if (!isDate(date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  await deleteWeight(uid, date);
  return NextResponse.json({ ok: true });
}
