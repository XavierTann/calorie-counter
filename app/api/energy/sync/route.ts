import { NextResponse } from "next/server";
import { ingestToken } from "@/lib/auth";
import { upsertEnergy } from "@/lib/db";
import { isDate, todaySG } from "@/lib/date";

// Called by an iOS Shortcut / Android automation / Garmin sync script:
//   POST /api/energy/sync
//   Authorization: Bearer <INGEST_TOKEN>
//   { "date": "2026-11-12", "active": 650, "resting": 1650 }   (or "total": 2300)
const n = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(x) ? Math.round(x) : null;
};

export async function POST(req: Request) {
  const token = ingestToken();
  const auth = req.headers.get("authorization") ?? "";
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const date = isDate(b.date) ? b.date : todaySG();
  const active = n(b.active);
  const resting = n(b.resting);
  const total = n(b.total);
  if (active === null && resting === null && total === null) {
    return NextResponse.json({ error: "send active, resting and/or total" }, { status: 400 });
  }
  await upsertEnergy({ date, active, resting, total, source: String(b.source ?? "garmin") });
  return NextResponse.json({ ok: true, date, active, resting, total });
}
