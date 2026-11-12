import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { FOODS, foodsAsPromptTable } from "./foods";
import type { FoodItem, HomeUnit } from "./types";

// Free tier: get a key at https://aistudio.google.com/apikey
// Tried in order. Free-tier models are sometimes overloaded (503) or rate
// limited (429), so we fall back to the next one.
const MODELS = [
  ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []),
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
].filter((m, i, a) => a.indexOf(m) === i);
const TIMEOUT_MS = 12_000;
let ai: GoogleGenAI | null = null;
function client() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}

const ItemSchema = z.object({
  name: z.string(),
  quantity: z.string(),
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  source: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  note: z.string(),
  breakdown: z.array(z.object({ label: z.string(), kcal: z.number() })),
});
const ResultSchema = z.object({ items: z.array(ItemSchema) });

// JSON schema handed to structured outputs (kept in sync with ItemSchema).
const RESULT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "kcal", "protein", "carbs", "fat", "source", "confidence", "note", "breakdown"],
        properties: {
          name: { type: "string", description: "Short display name, e.g. 'Roasted chicken rice'" },
          quantity: { type: "string", description: "Amount eaten, e.g. '1 plate, less rice' or '3 tbsp'" },
          kcal: { type: "number" },
          protein: { type: "number", description: "grams" },
          carbs: { type: "number", description: "grams" },
          fat: { type: "number", description: "grams" },
          source: {
            type: "string",
            description: "'db:<id>' for the reference table, 'home:<unit id>' for home units, 'my food' for MY FOODS, 'estimate' otherwise",
          },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          note: { type: "string", description: "One short line on adjustments made, or empty string" },
          breakdown: {
            type: "array",
            description: "How kcal was worked out. Row 1 = base serving; later rows = signed adjustments. Rows sum to kcal.",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "kcal"],
              properties: {
                label: { type: "string", description: "e.g. 'Chicken rice, 1 plate' or 'Less rice'" },
                kcal: { type: "number", description: "Base kcal, or a signed change like -80" },
              },
            },
          },
        },
      },
    },
  },
} as const;

const STATIC_SYSTEM = `You are the food-logging engine of a calorie tracker for someone in Singapore who mostly eats at hawker centres and eats home-cooked Chinese-style meals made by their mum.

The user types what they ate in casual language (Singlish and hawker terms are normal). Split it into separate food items and return calories and macros for exactly what they ate.

How to find the numbers, in this order:
1. The REFERENCE TABLE below (Singapore hawker servings, based on HPB data). Use it whenever a dish matches, even loosely (e.g. "ckt" = char kway teow, "bcm" = bak chor mee). Scale it for quantity and modifiers. source = "db:<id>", confidence high (or medium if you adjusted it a lot).
2. HOME UNITS (the user's calibrated sizes for mum's cooking, mostly per tablespoon). Use them when the user talks about tablespoons/tbsp, bowls of rice or home food. A specific dish ("3 tbsp kailan", "2 tbsp curry chicken") maps to the closest unit type; multiply by the number of tablespoons. If they say "spoon" for home food, treat it as 1 tbsp; a "scoop" with a serving spoon ≈ 3 tbsp. source = "home:<unit id>".
3. MY FOODS (custom foods the user added, and numbers they corrected). These override the reference table for the same food. source = "my food".
4. Otherwise estimate from your own knowledge of typical Singapore servings (for chains like McDonald's SG, Subway, Starbucks, KFC, use their published nutrition values if you know them). source = "estimate", confidence low (medium if you're confident about a branded item).

Modifiers to apply:
- "less rice" ≈ -80 kcal (-18g carbs); "more/extra rice" ≈ +100 kcal; "no rice" removes the rice portion.
- Chicken rice "no skin" ≈ -100 kcal (-11g fat); "breast meat" is leaner.
- "add egg" + fried egg ≈ 90 kcal; extra meat/sides add their own values.
- "dry" vs "soup" noodles are different entries. Drinking all the soup/gravy adds calories; "didn't finish the soup" removes some.
- Kopi/teh: no suffix = condensed milk + sugar; -O = sugar only; -C = evaporated milk + sugar; kosong = no sugar; siew dai = less sugar; gah dai = more sugar; peng = iced (same calories); "po" = weaker (same calories). Combine them, e.g. "kopi-c siew dai" ≈ 75 kcal.
- Economic rice/cai fan: rice base (half rice = half) + each scoop from the cf-* rows.
- "half", "shared", "ate a few spoons": scale proportionally.

Breakdown: for every item, show the working. Row 1 is the base serving you started from (label like "Chicken rice, 1 plate" with its kcal). Each later row is one modifier or scaling step as a signed kcal change (e.g. "Less rice" -80, "Extra plate" +607, "Half portion" -300). Use only the base row if nothing was adjusted. The rows must add up exactly to kcal.

Round kcal to whole numbers and macros to 1 decimal place. One entry per distinct food/drink. If the text isn't food at all, return an empty items list.

REFERENCE TABLE (id | name | serving | kcal | macros):
${foodsAsPromptTable(FOODS)}`;

export async function parseMeal(text: string, homeUnits: HomeUnit[], myFoods: FoodItem[]): Promise<FoodItem[]> {
  const dynamicContext = [
    "HOME UNITS (id | label | kcal | macros per unit):",
    homeUnits.map((u) => `${u.id} | ${u.label} | ${u.kcal} kcal | P${u.protein} C${u.carbs} F${u.fat}`).join("\n"),
    "",
    "MY FOODS:",
    myFoods.length
      ? myFoods.map((f) => `${f.name} | ${f.quantity} | ${f.kcal} kcal | P${f.protein} C${f.carbs} F${f.fat}`).join("\n")
      : "(none yet)",
  ].join("\n");

  let lastError: unknown;
  for (const model of MODELS) {
    try {
      const response = await client().models.generateContent({
        model,
        contents: `${dynamicContext}\n\nWhat I ate:\n${text}`,
        config: {
          systemInstruction: STATIC_SYSTEM,
          responseMimeType: "application/json",
          responseJsonSchema: RESULT_JSON_SCHEMA,
          temperature: 0.2,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        },
      });
      const out = response.text;
      if (!out) throw new Error("Empty answer");
      const parsed = ResultSchema.parse(JSON.parse(out));
      console.log(`Gemini ${model} ok`);
      return parsed.items.map((i) => {
        const breakdown = i.breakdown.map((b) => ({ label: b.label, kcal: Math.round(b.kcal) }));
        // Trust the shown working so the table always adds up.
        const kcal = breakdown.length ? breakdown.reduce((a, b) => a + b.kcal, 0) : Math.round(i.kcal);
        return { ...i, kcal, breakdown: breakdown.length ? breakdown : undefined, note: i.note || undefined };
      });
    } catch (e) {
      lastError = e;
      // A bad key won't work on any model, so stop straight away.
      if (e instanceof ApiError && (e.status === 401 || e.status === 403 || /api key/i.test(e.message))) throw e;
      console.warn(`Gemini ${model} failed, trying next model:`, e instanceof Error ? e.message.slice(0, 200) : e);
    }
  }
  throw lastError;
}
