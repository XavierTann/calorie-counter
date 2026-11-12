import { ApiError } from "@google/genai";
import { NextResponse } from "next/server";
import { foodsForAI, getSettings } from "@/lib/db";
import { parseMeal } from "@/lib/parse";
import { findSources } from "@/lib/ref";
import { currentUserId, unauthorized } from "@/lib/session";

export const maxDuration = 60;

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) return NextResponse.json({ error: "Type what you ate" }, { status: 400 });
  try {
    const input = text.slice(0, 2000);
    // Look up official data first (keyword-matched cuisine), so the AI only estimates what no source covers.
    const [settings, myFoods, sources] = await Promise.all([
      getSettings(uid),
      foodsForAI(uid),
      findSources(input).catch((e) => {
        console.warn("source lookup failed", e);
        return { cuisine: "singapore" as const, matches: [] };
      }),
    ]);
    const { items, questions } = await parseMeal(input, settings.homeUnits, myFoods, sources);
    return NextResponse.json({ items, questions });
  } catch (e) {
    console.error(e);
    if (!process.env.GEMINI_API_KEY || (e instanceof ApiError && (e.status === 401 || e.status === 403 || /api key/i.test(e.message)))) {
      return NextResponse.json({ error: "Gemini API key is missing or invalid" }, { status: 500 });
    }
    if (e instanceof ApiError && e.status === 429) {
      return NextResponse.json({ error: "Hit the free-tier limit. Wait a minute and try again." }, { status: 429 });
    }
    if ((e instanceof ApiError && e.status >= 500) || (e instanceof Error && /abort|timeout/i.test(e.name + e.message))) {
      return NextResponse.json({ error: "Gemini's free models are busy right now. Try again in a minute." }, { status: 503 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lookup failed" }, { status: 500 });
  }
}
