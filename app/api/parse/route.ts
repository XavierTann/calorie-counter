import { ApiError } from "@google/genai";
import { NextResponse } from "next/server";
import { getSettings, listUserFoods } from "@/lib/db";
import { parseMeal } from "@/lib/parse";
import { quickLookup } from "@/lib/quick";
import { dishKey, findSources } from "@/lib/ref";
import { currentUserId, unauthorized } from "@/lib/session";

export const maxDuration = 60;

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) return NextResponse.json({ error: "Type what you ate" }, { status: 400 });
  try {
    const input = text.slice(0, 2000);
    const [settings, mine] = await Promise.all([getSettings(uid), listUserFoods(uid)]);
    // Your corrections, the food database and your history first; the AI only sees what they didn't answer.
    const quick = await quickLookup(input, mine).catch((e) => {
      console.warn("quick lookup failed", e);
      return { items: [], rest: input };
    });
    if (!quick.rest) return NextResponse.json({ items: quick.items, questions: [], ai: false });

    const words = new Set(dishKey(quick.rest).split(" ").filter((w) => w.length > 2));
    const myFoods = mine.filter((f) => f.kind === "custom" || f.edited).map((f) => ({ ...f, source: "my food", confidence: "high" as const }));
    // Foods you've logged before that share a word with the meal, so the AI reuses your numbers.
    const past = mine.filter((f) => f.kind === "recorded" && !f.edited && dishKey(f.name).split(" ").some((w) => words.has(w)))
      .slice(0, 15)
      .map((f) => ({ ...f, source: "history", confidence: "medium" as const }));
    const sources = await findSources(quick.rest).catch((e) => {
      console.warn("source lookup failed", e);
      return { cuisine: "singapore" as const, matches: [] };
    });
    const { items, questions } = await parseMeal(quick.rest, settings.homeUnits, myFoods, sources, past);
    return NextResponse.json({ items: [...quick.items, ...items], questions, ai: true });
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
