import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { FOODS, foodsAsPromptTable } from "./foods";
import type { FoodItem, HomeUnit } from "./types";

// Free tier: get a key at https://aistudio.google.com/apikey
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
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
        required: ["name", "quantity", "kcal", "protein", "carbs", "fat", "source", "confidence", "note"],
        properties: {
          name: { type: "string", description: "Short display name, e.g. 'Roasted chicken rice'" },
          quantity: { type: "string", description: "Amount eaten, e.g. '1 plate, less rice' or '2 scoops'" },
          kcal: { type: "number" },
          protein: { type: "number", description: "grams" },
          carbs: { type: "number", description: "grams" },
          fat: { type: "number", description: "grams" },
          source: {
            type: "string",
            description: "'db:<id>' for the reference table, 'home:<unit id>' for home units, 'learned' for learned foods, 'estimate' otherwise",
          },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          note: { type: "string", description: "One short line on adjustments made, or empty string" },
        },
      },
    },
  },
} as const;

const STATIC_SYSTEM = `You are the food-logging engine of a calorie tracker for someone in Singapore who mostly eats at hawker centres and eats home-cooked Chinese-style meals made by their mum.

The user types what they ate in casual language (Singlish and hawker terms are normal). Split it into separate food items and return calories and macros for exactly what they ate.

How to find the numbers, in this order:
1. The REFERENCE TABLE below (Singapore hawker servings, based on HPB data). Use it whenever a dish matches, even loosely (e.g. "ckt" = char kway teow, "bcm" = bak chor mee). Scale it for quantity and modifiers. source = "db:<id>", confidence high (or medium if you adjusted it a lot).
2. HOME UNITS (the user's calibrated "scoop" sizes for mum's cooking). Use them when the user talks about scoops, bowls of rice or home food. A specific dish ("2 scoops kailan", "1 scoop curry chicken") maps to the closest unit type. source = "home:<unit id>".
3. LEARNED FOODS (numbers the user corrected or confirmed before). These override the reference table for the same food. source = "learned".
4. Otherwise estimate from your own knowledge of typical Singapore servings (for chains like McDonald's SG, Subway, Starbucks, KFC, use their published nutrition values if you know them). source = "estimate", confidence low (medium if you're confident about a branded item).

Modifiers to apply:
- "less rice" ≈ -80 kcal (-18g carbs); "more/extra rice" ≈ +100 kcal; "no rice" removes the rice portion.
- Chicken rice "no skin" ≈ -100 kcal (-11g fat); "breast meat" is leaner.
- "add egg" + fried egg ≈ 90 kcal; extra meat/sides add their own values.
- "dry" vs "soup" noodles are different entries. Drinking all the soup/gravy adds calories; "didn't finish the soup" removes some.
- Kopi/teh: no suffix = condensed milk + sugar; -O = sugar only; -C = evaporated milk + sugar; kosong = no sugar; siew dai = less sugar; gah dai = more sugar; peng = iced (same calories); "po" = weaker (same calories). Combine them, e.g. "kopi-c siew dai" ≈ 75 kcal.
- Economic rice/cai fan: rice base (half rice = half) + each scoop from the cf-* rows.
- "half", "shared", "ate a few spoons": scale proportionally.

Round kcal to whole numbers and macros to 1 decimal place. One entry per distinct food/drink. If the text isn't food at all, return an empty items list.

REFERENCE TABLE (id | name | serving | kcal | macros):
${foodsAsPromptTable(FOODS)}`;

export async function parseMeal(text: string, homeUnits: HomeUnit[], learned: FoodItem[]): Promise<FoodItem[]> {
  const dynamicContext = [
    "HOME UNITS (id | label | kcal | macros per unit):",
    homeUnits.map((u) => `${u.id} | ${u.label} | ${u.kcal} kcal | P${u.protein} C${u.carbs} F${u.fat}`).join("\n"),
    "",
    "LEARNED FOODS:",
    learned.length
      ? learned.map((f) => `${f.name} | ${f.quantity} | ${f.kcal} kcal | P${f.protein} C${f.carbs} F${f.fat} | ${f.source}`).join("\n")
      : "(none yet)",
  ].join("\n");

  const response = await client().models.generateContent({
    model: MODEL,
    contents: `${dynamicContext}\n\nWhat I ate:\n${text}`,
    config: {
      systemInstruction: STATIC_SYSTEM,
      responseMimeType: "application/json",
      responseJsonSchema: RESULT_JSON_SCHEMA,
      temperature: 0.2,
    },
  });
  const out = response.text;
  if (!out) throw new Error("No answer from Gemini. Try again.");
  const parsed = ResultSchema.parse(JSON.parse(out));
  return parsed.items.map((i) => ({ ...i, note: i.note || undefined }));
}
