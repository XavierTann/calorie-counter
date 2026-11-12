// USDA FoodData Central search (generic foods and ingredients, values per 100 g).
// Free key: https://fdc.nal.usda.gov/api-key-signup (1,000 requests/hour). Falls back to the shared DEMO_KEY.
import type { RefFood } from "./db";

type FdcNutrient = { nutrientName?: string; unitName?: string; value?: number };
type FdcFood = { fdcId: number; description: string; dataType: string; foodNutrients?: FdcNutrient[] };

function nutrient(f: FdcFood, names: string[], unit: string) {
  for (const name of names) {
    const n = f.foodNutrients?.find((x) => x.nutrientName === name && x.unitName?.toUpperCase() === unit);
    if (n?.value !== undefined) return n.value;
  }
  return null;
}

export async function searchFdc(query: string, limit = 3): Promise<RefFood[]> {
  if (query.trim().length < 3) return [];
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", process.env.FDC_API_KEY || "DEMO_KEY");
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", String(limit));
  url.searchParams.set("dataType", "Foundation,SR Legacy,Survey (FNDDS)");
  const r = await fetch(url, { signal: AbortSignal.timeout(3500) });
  if (!r.ok) return [];
  const j = (await r.json()) as { foods?: FdcFood[] };
  return (j.foods ?? []).flatMap((f) => {
    const kcal = nutrient(f, ["Energy", "Energy (Atwater General Factors)", "Energy (Atwater Specific Factors)"], "KCAL");
    if (kcal === null) return [];
    return [
      {
        id: `fdc:${f.fdcId}`,
        source: "usda-fdc",
        cuisine: "western",
        name: f.description,
        nameLocal: null,
        search: "",
        serving: "100 g",
        kcal: Math.round(kcal),
        protein: nutrient(f, ["Protein"], "G") ?? 0,
        carbs: nutrient(f, ["Carbohydrate, by difference"], "G") ?? 0,
        fat: nutrient(f, ["Total lipid (fat)"], "G") ?? 0,
        kcal100: Math.round(kcal),
        note: `USDA ${f.dataType}`,
      },
    ];
  });
}
