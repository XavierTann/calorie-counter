// Downloads freshly prepared foods and drinks (hawker, food court, restaurant items) from HPB's
// Singapore Food Insights Database (SG FoodID) into data/ref/singapore.json.
//
// Licence: SG FoodID Terms of Use, section 10 ("use, access, download, copy, distribute, transmit,
// modify, and adapt the Data"), with the attribution notice shown in the app.
// https://pphtpc.hpb.gov.sg/web/sgfoodid
//
// Polite by design: identifies itself, one request at a time (~1/second), and caches every response
// in data/ref/.cache/sgfoodid so it can resume and never re-downloads.
// Usage: node scripts/ref/fetch_sgfoodid.mjs
import fs from "node:fs";
import path from "node:path";

const API = "https://pphtpc.hpb.gov.sg/bff/v1/food-portal";
const UA = "MakanLog-data-import/1.0 (personal calorie-tracker import of SG FoodID open data)";
const CACHE = "data/ref/.cache/sgfoodid";
const DELAY_MS = 1100;
fs.mkdirSync(path.join(CACHE, "details"), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function get(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const wait = last + DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
      if (r.ok) return r.json();
      if (r.status === 404) return null;
      console.warn(`  ${r.status} for ${url}, backing off`);
    } catch (e) {
      console.warn(`  ${e.message} for ${url}, backing off`);
    }
    await sleep(5000 * (attempt + 1));
  }
  throw new Error(`gave up on ${url}`);
}

async function cached(file, url) {
  const p = path.join(CACHE, file);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  const data = await get(url);
  fs.writeFileSync(p, JSON.stringify(data));
  return data;
}

// 1. Every food group and subgroup.
const groups = await cached("groups.json", `${API}/foods/groups`);

// 2. List the freshly prepared items in each subgroup.
const items = new Map();
for (const g of groups) {
  for (const sub of g.l2Categories) {
    for (let page = 1; ; page++) {
      const q = new URLSearchParams({ pageNumber: String(page), preparationFormat: "Freshly Prepared" });
      if (g.type === "Drink") q.set("type", "Drink");
      q.set("foodGroupId", String(g.id));
      q.set("foodSubGroupId", String(sub.id));
      const rows = (await cached(`list-${g.id}-${sub.id}-${page}.json`, `${API}/foods?${q}`)) ?? [];
      for (const r of rows) if (!r.isDeactivated) items.set(r.crId, r);
      const total = rows[0]?.totalCount ?? 0;
      if (rows.length < 25 || page * 25 >= total) break;
    }
  }
  console.log(`${g.name}: ${items.size} items so far`);
}

// 3. Nutrients for each item.
let done = 0;
let skipped = 0;
const out = [];
const val = (v) => (typeof v === "number" && v >= 0 ? v : null);
for (const [crId, row] of items) {
  // An item that keeps failing is skipped (not cached), so the next run retries it.
  const d = await cached(`details/${crId}.json`, `${API}/foods/details/${crId}`).catch((e) => {
    console.warn(`  skipped ${crId}: ${e.message}`);
    skipped++;
    return null;
  });
  if (++done % 100 === 0) console.log(`  details ${done}/${items.size}`);
  const per = d?.calculatedFoodNutrients;
  const base = d?.baseFoodNutrients;
  if (!d || !per || val(per.energy) === null) continue;
  out.push({
    code: crId,
    name: d.name,
    description: d.description ?? row.description ?? "",
    group: d.l1Category,
    subgroup: d.l2Category,
    type: row.type,
    serving: d.defaultPortion,
    serving_g: d.defaultWeight,
    kcal: Math.round(per.energy),
    protein: Math.round((val(per.protein) ?? 0) * 10) / 10,
    carbs: Math.round((val(per.carbohydrate) ?? 0) * 10) / 10,
    fat: Math.round((val(per.fat) ?? 0) * 10) / 10,
    kcal_100: val(base?.energy),
    year: d.yearOfData,
    data_source: d.sourceOfData,
  });
}

out.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync("data/ref/singapore.json", JSON.stringify(out, null, 0));
fs.writeFileSync("data/ref/singapore.meta.json", JSON.stringify({ accessed: new Date().toISOString().slice(0, 10), items: out.length }, null, 1));
console.log(`${out.length} SG FoodID items -> data/ref/singapore.json${skipped ? ` (${skipped} skipped; rerun to retry them)` : ""}`);
