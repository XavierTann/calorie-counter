import { ApiError } from "@google/genai";
import { NextResponse } from "next/server";
import { getSettings, listLearnedFoods } from "@/lib/db";
import { parseMeal } from "@/lib/parse";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) return NextResponse.json({ error: "Type what you ate" }, { status: 400 });
  try {
    const [settings, learned] = await Promise.all([getSettings(), listLearnedFoods()]);
    const items = await parseMeal(text.slice(0, 2000), settings.homeUnits, learned);
    return NextResponse.json({ items });
  } catch (e) {
    console.error(e);
    if (!process.env.GEMINI_API_KEY || (e instanceof ApiError && (e.status === 401 || e.status === 403))) {
      return NextResponse.json({ error: "Gemini API key is missing or invalid" }, { status: 500 });
    }
    if (e instanceof ApiError && e.status === 429) {
      return NextResponse.json({ error: "Hit the free-tier limit. Wait a minute and try again." }, { status: 429 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lookup failed" }, { status: 500 });
  }
}
