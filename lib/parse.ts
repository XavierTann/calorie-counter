import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import type { Lookup } from "./ref";
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
  kcal_low: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  source: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  note: z.string(),
  breakdown: z.array(z.object({ label: z.string(), kcal: z.number() })),
});
const QuestionSchema = z.object({ question: z.string(), options: z.array(z.string()) });
const ResultSchema = z.object({ items: z.array(ItemSchema), questions: z.array(QuestionSchema) });

export type Clarification = z.infer<typeof QuestionSchema>;
export type ParseResult = { items: FoodItem[]; questions: Clarification[] };

// JSON schema handed to structured outputs (kept in sync with ItemSchema).
const RESULT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items", "questions"],
  properties: {
    questions: {
      type: "array",
      description: "Up to 2 clarifying questions about details that change the calories a lot. Empty if none.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "options"],
        properties: {
          question: { type: "string", description: "Short question, e.g. 'Steamed or roasted chicken?'" },
          options: { type: "array", items: { type: "string" }, description: "2-4 short answers, e.g. ['Steamed', 'Roasted']" },
        },
      },
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "kcal", "kcal_low", "protein", "carbs", "fat", "source", "confidence", "note", "breakdown"],
        properties: {
          name: { type: "string", description: "Short display name, e.g. 'Roasted chicken rice'" },
          quantity: { type: "string", description: "Amount eaten, e.g. '1 plate, less rice' or '3 tbsp'" },
          kcal: { type: "number", description: "Upper end of the likely range (this is what gets logged)" },
          kcal_low: { type: "number", description: "Low end of the likely range for this item" },
          protein: { type: "number", description: "grams" },
          carbs: { type: "number", description: "grams" },
          fat: { type: "number", description: "grams" },
          source: {
            type: "string",
            description: "'my food' for MY FOODS, 'home:<unit id>' for home units, the row id for SOURCE MATCHES (e.g. 'sg:…', 'kr:…', 'in:…', 'fdc:…'), 'estimate' otherwise",
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

How to find the numbers, in this order. Always prefer real data over your own estimate:
1. MY FOODS (custom foods the user added, and numbers they corrected). These override everything else for the same food. source = "my food".
2. HOME UNITS (the user's calibrated sizes for mum's cooking, mostly per tablespoon). Use them when the user talks about tablespoons/tbsp, bowls of rice or home food. A specific dish ("3 tbsp kailan", "2 tbsp curry chicken") maps to the closest unit type; multiply by the number of tablespoons. If they say "spoon" for home food, treat it as 1 tbsp; a "scoop" with a serving spoon ≈ 3 tbsp. source = "home:<unit id>".
3. SOURCE MATCHES (rows from official food databases, found for this meal: Singapore's HPB SG FoodID for local food, Korea's MFDS dish database, the Indian Nutrient Databank, or USDA FoodData Central). If a row is the same dish (or a close variant, e.g. "ckt" = char kway teow, "bcm" = bak chor mee), use it: scale its serving to what the user ate and apply the modifiers below; if its serving size looks unrealistic for one portion, scale from its kcal per 100 g instead. source = the row's id (e.g. "sg:F05100133", "kr:D306-…", "in:ASC122", "fdc:12345"), confidence high (medium if you adapted it a lot). Ignore rows that are a different dish. Prefer sg: rows over fdc: rows for Singapore food.
4. Only if none of the above has the food: estimate from your own knowledge of typical Singapore servings (for chains like McDonald's SG, Subway, Starbucks, KFC, use their published nutrition values if you know them). source = "estimate", confidence low (medium if you're confident about a branded item).

Err on the high side: whenever you estimate and the calories are uncertain or sources disagree (e.g. teh-c kosong is listed anywhere from 30 to 66 kcal), use the UPPER end of the range, never the middle or low end. Say so in the note, e.g. "Range 30–66 kcal, used the upper bound". The same goes for any deduction you work out yourself (kosong, siew dai, half portion): take the smaller deduction, so the total stays on the high side. Fixed numbers from the databases and the modifier list below are used as given.

Modifiers to apply:
- "less rice" ≈ -80 kcal (-18g carbs); "more/extra rice" ≈ +100 kcal; "no rice" removes the rice portion.
- Chicken rice "no skin" ≈ -100 kcal (-11g fat); "breast meat" is leaner.
- "add egg" + fried egg ≈ 90 kcal; extra meat/sides add their own values.
- "dry" vs "soup" noodles are different entries. Drinking all the soup/gravy adds calories; "didn't finish the soup" removes some.
- Kopi/teh: no suffix = condensed milk + sugar; -O = sugar only; -C = evaporated milk + sugar; kosong = no sugar; siew dai = less sugar; gah dai = more sugar; peng = iced (same calories); "po" = weaker (same calories). Combine them, e.g. "kopi-c siew dai". Plain kopi/teh (no -O/-C) made kosong still has milk: since condensed milk is sweet, "teh kosong" / "kopi kosong" means the C kosong version (evaporated milk, no sugar), never O kosong unless they said O. Example: "iced teh kosong" = Iced Teh C kosong (~68 kcal), not Iced Teh O kosong.
- Economic rice/cai fan: one item per dish taken plus the rice (half rice = half), using SOURCE MATCHES rows where they exist.
- "half", "shared", "ate a few spoons": scale proportionally.

Range: real portions and oil vary, so also give kcal_low, the low end of a realistic range for what they described. kcal is the upper end. For a database dish with no adjustments, kcal_low is about 15% below kcal; for your own estimates it's usually 20–35% below; for MY FOODS, HOME UNITS and branded items with published values, kcal_low = kcal.

Breakdown: for every item, show the working. Row 1 is the base serving you started from (label like "Chicken rice, 1 plate" with its kcal). Each later row is one modifier or scaling step as a signed kcal change (e.g. "Less rice" -80, "Extra plate" +607, "Half portion" -300). Use only the base row if nothing was adjusted. The rows must add up exactly to kcal.

Clarifying questions: if the user left out a detail that changes the calories a lot (about 15% or 80+ kcal), add a question with 2–4 short options. Examples: "chicken rice" → "Steamed or roasted chicken?" [Steamed, Roasted]; "nasi lemak" → "Which main?" [Fried chicken wing, Fried fish, Egg only]; "fried rice" → "Which kind?" [Egg, Chicken, Seafood, Yang zhou]; "mee goreng" → "Plate size?" [Regular, Large]. Ask at most 2 questions per message and only about things that matter for calories. Never ask about something the text already states (e.g. "roasted chicken rice" already answers steamed vs roasted). Don't ask when the user already said it, when MY FOODS or HOME UNITS already pin it down, or about drinks' ice. Still return items now using the most common choice, and say which in the note (e.g. "Assumed steamed"). If the message includes "Correction from me", apply that correction to the food (it may change the dish, portion or cooking) and ask no questions. If the message includes "Answers to your questions", use them and return no further questions about the same food.

Round kcal to whole numbers and macros to 1 decimal place. One entry per distinct food/drink. If the text isn't food at all, return an empty items list.`;

export async function parseMeal(text: string, homeUnits: HomeUnit[], myFoods: FoodItem[], sources: Lookup): Promise<ParseResult> {
  const dynamicContext = [
    `SOURCE MATCHES (detected cuisine: ${sources.cuisine}; id | dish | serving | kcal per serving | macros per serving | kcal per 100 g | notes):`,
    sources.matches.length
      ? sources.matches
          .map((m) =>
            [m.id, m.nameLocal ? `${m.name} (${m.nameLocal})` : m.name, m.serving, `${m.kcal} kcal`, `P${m.protein} C${m.carbs} F${m.fat}`, m.kcal100 !== null ? `${m.kcal100} kcal/100g` : "", m.note ?? ""].join(" | "),
          )
          .join("\n")
      : "(none found)",
    "",
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
      const items = parsed.items.map((i) => {
        const breakdown = i.breakdown.map((b) => ({ label: b.label, kcal: Math.round(b.kcal) }));
        // Trust the shown working so the table always adds up.
        const kcal = breakdown.length ? breakdown.reduce((a, b) => a + b.kcal, 0) : Math.round(i.kcal);
        // Keep the range's width but anchor it to the shown total.
        const width = Math.max(0, Math.round(i.kcal) - Math.round(i.kcal_low));
        const kcalLow = width > 0 && width < kcal ? kcal - width : undefined;
        const { kcal_low: _low, ...rest } = i;
        void _low;
        return { ...rest, kcal, kcalLow, breakdown: breakdown.length ? breakdown : undefined, note: i.note || undefined };
      });
      const questions = parsed.questions
        .filter((q) => q.question.trim() && q.options.length >= 2)
        // Safety net: skip a question if the user's text already contains one of its answers.
        .filter((q) => !q.options.some((o) => new RegExp(`\\b${o.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text.toLowerCase())))
        .slice(0, 2)
        .map((q) => ({ question: q.question.trim(), options: q.options.slice(0, 4) }));
      return { items, questions };
    } catch (e) {
      lastError = e;
      // A bad key won't work on any model, so stop straight away.
      if (e instanceof ApiError && (e.status === 401 || e.status === 403 || /api key/i.test(e.message))) throw e;
      console.warn(`Gemini ${model} failed, trying next model:`, e instanceof Error ? e.message.slice(0, 200) : e);
    }
  }
  throw lastError;
}
