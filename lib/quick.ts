// Answers what it can without the AI, so most repeat meals cost nothing.
// Each food in the message is looked up in this order, and only what's left goes to the AI:
//   1. Your own numbers: foods you added or corrected in My Foods (you said what's right, so they win)
//   2. The food database (SG FoodID / MFDS / INDB), when the name matches a dish exactly
//   3. Your history: foods you've logged before, with the numbers you logged them at
//   4. The AI, for anything else (modifiers like "less rice", new foods, home-cooked tbsp, ...)
import type { RefFood } from "./db";
import { detectCuisine, dishKey, exactRef, type Cuisine } from "./ref";
import type { FoodItem, MyFood } from "./types";

const WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, half: 0.5 };

type Seg = { raw: string; count: number; name: string };

// "2 kopi c, chicken rice and teh x2" → [{2, "kopi c"}, {1, "chicken rice"}, {2, "teh"}]
function split(text: string): Seg[] {
  return text
    .split(/[,+&\n;]|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      let m = raw.match(/^(\d+(?:\.\d+)?|a|an|one|two|three|four|half)\s*(?:x|×|portions? of|plates? of|cups? of|bowls? of)?\s+(.+)$/i);
      if (m) return { raw, count: WORDS[m[1].toLowerCase()] ?? Number(m[1]), name: m[2] };
      m = raw.match(/^(.+?)\s*(?:x|×)\s*(\d+(?:\.\d+)?)$/i);
      if (m) return { raw, count: Number(m[2]), name: m[1] };
      return { raw, count: 1, name: raw };
    });
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const times = (count: number, quantity: string) => (count === 1 ? quantity : `${count} × ${quantity}`);

function fromMine(f: MyFood, count: number, source: string): FoodItem {
  return {
    name: f.name,
    quantity: times(count, f.quantity),
    kcal: Math.round(f.kcal * count),
    protein: r1(f.protein * count),
    carbs: r1(f.carbs * count),
    fat: r1(f.fat * count),
    source,
    confidence: "high",
    note: source === "history" ? `Same as last time you logged it (${f.times}×)` : undefined,
  };
}

function fromRef(r: RefFood, count: number): FoodItem {
  const kcal = Math.round(r.kcal * count);
  return {
    name: r.name,
    quantity: times(count, r.serving),
    kcal,
    kcalLow: Math.round(kcal * 0.85),
    protein: r1(r.protein * count),
    carbs: r1(r.carbs * count),
    fat: r1(r.fat * count),
    source: r.id,
    confidence: "high",
    breakdown: count === 1 ? undefined : [{ label: `${r.name}, ${r.serving}`, kcal: Math.round(r.kcal) }, { label: `× ${count}`, kcal: kcal - Math.round(r.kcal) }],
  };
}

export type Quick = { items: FoodItem[]; rest: string };

export async function quickLookup(text: string, mine: MyFood[]): Promise<Quick> {
  // Re-asks (answers to questions, corrections) need the AI's judgement.
  if (/answers to your questions|correction from me/i.test(text)) return { items: [], rest: text };
  const cuisine: Cuisine = detectCuisine(text);
  const byName = new Map<string, MyFood[]>();
  for (const f of mine) {
    const k = dishKey(f.name, cuisine);
    byName.set(k, [...(byName.get(k) ?? []), f]); // already sorted: corrected first, then most used
  }

  const items: FoodItem[] = [];
  const rest: string[] = [];
  for (const seg of split(text)) {
    const own = byName.get(dishKey(seg.name, cuisine)) ?? [];
    const yours = own.find((f) => f.kind === "custom" || f.edited);
    if (yours) {
      items.push(fromMine(yours, seg.count, "my food"));
      continue;
    }
    const ref = await exactRef(seg.name, cuisine);
    if (ref) {
      items.push(fromRef(ref, seg.count));
      continue;
    }
    if (own[0]) {
      items.push(fromMine(own[0], seg.count, "history"));
      continue;
    }
    rest.push(seg.raw);
  }
  return { items, rest: rest.join(", ") };
}
