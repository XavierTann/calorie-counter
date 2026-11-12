import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getSettings, listLearnedFoods, saveLearnedFoods } from "@/lib/db";
import { parseMeal } from "@/lib/parse";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) return NextResponse.json({ error: "Type what you ate" }, { status: 400 });
  try {
    const [settings, learned] = await Promise.all([getSettings(), listLearnedFoods()]);
    const items = await parseMeal(text.slice(0, 2000), settings.homeUnits, learned);
    // Remember anything that came from the web so next time it's instant.
    await saveLearnedFoods(items.filter((i) => i.source.startsWith("web")));
    return NextResponse.json({ items });
  } catch (e) {
    console.error(e);
    if (e instanceof Anthropic.AuthenticationError || !process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Anthropic API key is missing or invalid" }, { status: 500 });
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limited, try again in a moment" }, { status: 429 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lookup failed" }, { status: 500 });
  }
}
