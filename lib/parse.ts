import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { FOODS, foodsAsPromptTable } from "./foods";
import type { FoodItem, HomeUnit } from "./types";

const client = new Anthropic();

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
            description: "'db:<id>' for the reference table, 'home:<unit id>' for home units, 'learned' for learned foods, 'web: <domain>' for web results, 'estimate' otherwise",
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
3. LEARNED FOODS (looked up before). source = "learned".
4. Only if none of these cover the item: use web_search. Prefer HPB / HealthHub (healthhub.sg, focos.hpb.gov.sg), official nutrition pages for chains (McDonald's SG, Subway, Starbucks, KFC, etc.) and product labels. source = "web: <domain>", confidence medium.
5. Otherwise estimate from your own knowledge. source = "estimate", confidence low.
Don't search for items the table, home units or common knowledge already cover well. Searching is slow.

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

  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [
    { role: "user", content: `${dynamicContext}\n\nWhat I ate:\n${text}` },
  ];

  // Web search runs server-side; if the server loop pauses, resend to resume.
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: RESULT_JSON_SCHEMA },
      },
      cache_control: { type: "ephemeral" },
      system: STATIC_SYSTEM,
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: 3,
          user_location: { type: "approximate", country: "SG", city: "Singapore", timezone: "Asia/Singapore" },
        },
      ],
      messages,
    });

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    if (response.stop_reason === "refusal") {
      throw new Error("The model declined this request.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error("Response was cut off. Try logging fewer items at once.");
    }

    // The structured JSON is the final text block (earlier ones can precede a search).
    const textBlocks = response.content.filter(
      (b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text",
    );
    const last = textBlocks.at(-1)?.text ?? "";
    let json: unknown;
    try {
      json = JSON.parse(last);
    } catch {
      json = JSON.parse(textBlocks.map((b) => b.text).join(""));
    }
    const parsed = ResultSchema.parse(json);
    return parsed.items.map((i) => ({ ...i, note: i.note || undefined }));
  }
  throw new Error("Lookup took too long. Try again.");
}
