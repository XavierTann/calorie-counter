// Open Food Facts: crowd-sourced nutrition labels of packaged products, including many sold in Singapore
// supermarkets (FairPrice, Cold Storage, ...). Free, no key. Data under the Open Database License (ODbL).
import type { RefFood } from "./db";

type OffHit = {
  code?: string;
  product_name?: string;
  brands?: string[] | string;
  serving_size?: string;
  serving_quantity?: number | string;
  countries_tags?: string[];
  nutriments?: Record<string, number | undefined>;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function searchOff(query: string, limit = 3): Promise<RefFood[]> {
  if (query.trim().length < 3) return [];
  const url = new URL("https://search.openfoodfacts.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", "8");
  url.searchParams.set("fields", "code,product_name,brands,serving_size,serving_quantity,countries_tags,nutriments");
  const r = await fetch(url, { headers: { "User-Agent": "MakanLog/1.0 (personal calorie tracker)" }, signal: AbortSignal.timeout(3500) });
  if (!r.ok) return [];
  const j = (await r.json()) as { hits?: OffHit[] };
  const hits = (j.hits ?? []).filter((h) => h.code && h.product_name && Number.isFinite(h.nutriments?.["energy-kcal_100g"]));
  // Products sold in Singapore first.
  hits.sort((a, b) => Number(!!b.countries_tags?.includes("en:singapore")) - Number(!!a.countries_tags?.includes("en:singapore")));
  return hits.slice(0, limit).map((h) => {
    const n = h.nutriments!;
    const kcal100 = n["energy-kcal_100g"]!;
    const grams = Number(h.serving_quantity);
    const per = grams > 0 ? grams / 100 : 1;
    const brand = Array.isArray(h.brands) ? h.brands[0] : h.brands?.split(",")[0];
    const name = brand && !h.product_name!.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${h.product_name}` : h.product_name!;
    return {
      id: `off:${h.code}`,
      source: "open-food-facts",
      cuisine: "packaged",
      name,
      nameLocal: null,
      search: "",
      serving: grams > 0 ? `1 serving = ${h.serving_size || `${grams} g`}` : "100 g",
      kcal: Math.round(kcal100 * per),
      protein: round1((n.proteins_100g ?? 0) * per),
      carbs: round1((n.carbohydrates_100g ?? 0) * per),
      fat: round1((n.fat_100g ?? 0) * per),
      kcal100: Math.round(kcal100),
      note: `Packaged product label (Open Food Facts, barcode ${h.code})`,
    };
  });
}
