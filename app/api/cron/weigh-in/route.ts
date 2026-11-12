import { NextResponse } from "next/server";
import { pushSubsMissingWeight } from "@/lib/db";
import { todaySG } from "@/lib/date";
import { sendPush } from "@/lib/push";

// Run daily by Vercel Cron at 01:00 UTC (9am Singapore), see vercel.json.
// Reminds everyone with reminders on who hasn't logged a weight today.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const subs = await pushSubsMissingWeight(todaySG());
  const sent = await sendPush(subs, { title: "Good morning ☀️", body: "Time to weigh in. Tap to log today's weight ⚖️", url: "/weight" });
  return NextResponse.json({ devices: subs.length, sent });
}
