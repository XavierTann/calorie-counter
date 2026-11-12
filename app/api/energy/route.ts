import { NextResponse } from "next/server";
import { upsertEnergy } from "@/lib/db";
import { isDate } from "@/lib/date";
import { currentUserId, unauthorized } from "@/lib/session";

const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

// Manual entry from the app.
export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const b = (await req.json()) as Record<string, unknown>;
  if (!isDate(b.date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  await upsertEnergy(uid, { date: b.date, active: n(b.active), resting: n(b.resting), total: n(b.total), source: "manual" });
  return NextResponse.json({ ok: true });
}
