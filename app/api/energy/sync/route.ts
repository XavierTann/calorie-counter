import { NextResponse } from "next/server";
import { getUserBySyncToken, upsertEnergy } from "@/lib/db";
import { isDate, todaySG } from "@/lib/date";

// Called by each user's iPhone Shortcut (Apple Health → this app):
//   POST /api/energy/sync
//   Authorization: Bearer <that user's sync token, shown in Settings>
//   { "date": "2026-11-12", "active": 650, "resting": 1650 }   (or "total": 2300)
const n = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(x) ? Math.round(x) : null;
};

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const user = await getUserBySyncToken(token);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const date = isDate(b.date) ? b.date : todaySG();
  const active = n(b.active);
  const resting = n(b.resting);
  const total = n(b.total);
  if (active === null && resting === null && total === null) {
    return NextResponse.json({ error: "send active, resting and/or total" }, { status: 400 });
  }
  await upsertEnergy(user.id, { date, active, resting, total, source: String(b.source ?? "apple health") });
  return NextResponse.json({ ok: true, date, active, resting, total });
}
