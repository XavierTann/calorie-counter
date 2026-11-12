// Finds official nutrition data for a meal before the AI sees it.
// 1. Detect the meal's cuisine by keyword matching (one cuisine per meal; Singapore by default).
// 2. Search that cuisine's national dataset (imported into the ref_foods table) by dish name.
// 3. For parts of the meal nothing matched (and for Western/generic food), ask USDA FoodData Central.
import { FOODS } from "./foods";
import { listRefFoods, type RefFood } from "./db";
import { searchFdc } from "./fdc";

export type Cuisine = "singapore" | "korean" | "indian" | "western";

export const CUISINE_SOURCE: Record<Exclude<Cuisine, "singapore" | "western">, string> = {
  korean: "Korea MFDS national dish database",
  indian: "Indian Nutrient Databank (INDB)",
};

const KEYWORDS: Record<Exclude<Cuisine, "singapore">, string[]> = {
  korean: [
    "korean", "kimchi", "jjigae", "chigae", "jjige", "bibimbap", "bibimbab", "bulgogi", "galbi", "kalbi", "tteok", "tteokbokki",
    "topokki", "ddukbokki", "ramyeon", "ramyun", "japchae", "chapchae", "samgyeopsal", "samgyupsal", "sundubu", "soondubu",
    "doenjang", "gochujang", "kimbap", "gimbap", "jjajang", "jajang", "jajangmyeon", "jjajangmyeon", "jjamppong", "jjambbong",
    "naengmyeon", "bossam", "jokbal", "dakgalbi", "budae", "pajeon", "haemul pajeon", "mandu", "seolleongtang", "galbitang",
    "samgyetang", "kongguksu", "banchan", "yangnyeom", "dakgangjeong", "tteokguk", "miyeokguk", "hotteok", "bingsu", "soju",
    "makgeolli", "kimchijeon", "jeyuk", "gamjatang", "haejangguk", "dolsot", "kalguksu", "japgokbap", "eomuk", "odeng",
  ],
  indian: [
    "indian", "biryani", "biriyani", "briyani", "masala", "tikka", "tandoori", "naan", "chapati", "chapatti", "paratha",
    "parantha", "dal", "daal", "dhal", "paneer", "palak", "aloo", "gobi", "chana", "chole", "rajma", "dosa", "idli", "vada",
    "sambar", "rasam", "korma", "vindaloo", "butter chicken", "raita", "lassi", "poha", "upma", "khichdi", "pulao", "kheer",
    "halwa", "ladoo", "laddu", "gulab jamun", "samosa", "pakora", "pakoda", "bhaji", "bhatura", "kulcha", "keema", "rogan josh",
    "kofta", "dhokla", "pav bhaji", "chaat", "uttapam", "appam", "kadai", "kadhai", "saag", "methi", "jalebi", "makhani",
    "thali", "puri", "poori", "kachori", "rasgulla", "dahi", "matar", "bhindi", "baingan", "jeera", "chai",
  ],
  western: [
    "burger", "sandwich", "salad", "pasta", "spaghetti", "pizza", "steak", "fries", "oats", "oatmeal", "granola", "cereal",
    "yogurt", "yoghurt", "toast", "bagel", "croissant", "muffin", "pancake", "waffle", "bacon", "sausage", "protein shake",
    "whey", "avocado", "banana", "apple", "blueberries", "strawberries", "almonds", "peanut butter", "chicken breast",
    "salmon", "broccoli", "quinoa", "wrap", "burrito", "taco", "lasagna", "lasagne", "mac and cheese", "hot dog", "smoothie",
  ],
};

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const hasWord = (text: string, kw: string) => new RegExp(`(^|\\s)${kw}(s|es)?(\\s|$)`).test(text);

export function detectCuisine(text: string): Cuisine {
  if (/[가-힯]/.test(text)) return "korean";
  if (/[ऀ-ॿ]/.test(text)) return "indian";
  const t = norm(text);
  let best: Cuisine = "singapore";
  let bestHits = 0;
  for (const [cuisine, words] of Object.entries(KEYWORDS) as [Exclude<Cuisine, "singapore">, string[]][]) {
    const hits = words.filter((w) => hasWord(t, w)).length;
    if (hits > bestHits) {
      best = cuisine;
      bestHits = hits;
    }
  }
  return best;
}

/* ---------------- Matching dish names ---------------- */

// Words that don't identify a dish on their own.
const STOP = new Set(
  "a an the and with of in on for my some plus correction from me answers to your questions extra less more no half large small medium big regular plate plates bowl bowls cup cups glass piece pieces pc pcs serving servings portion portion slice slices tbsp tsp spoon spoons scoop scoops g gm gram grams ml kg x had ate eat drank i".split(" "),
);
const GENERIC = new Set("rice chicken pork beef fish egg eggs soup stew fried noodles noodle curry spicy sauce vegetable vegetables veg tofu seafood sweet sour hot cold set".split(" "));

type Indexed = { row: RefFood; tokens: Set<string>; compact: string };
const cache = new Map<string, { at: number; rows: Indexed[]; df: Map<string, number> }>();
const TTL = 60 * 60 * 1000;

async function indexFor(cuisine: string) {
  const hit = cache.get(cuisine);
  if (hit && Date.now() - hit.at < TTL) return hit;
  const rows = (await listRefFoods(cuisine)).map((row) => {
    const words = norm(`${row.name} ${row.search}`).split(" ");
    return { row, tokens: new Set(words.filter((w) => w.length > 1)), compact: words.join("") };
  });
  const df = new Map<string, number>();
  for (const r of rows) for (const t of r.tokens) df.set(t, (df.get(t) ?? 0) + 1);
  const entry = { at: Date.now(), rows, df };
  cache.set(cuisine, entry);
  return entry;
}

// Splits "kimchi jjigae, rice and soju" into the separate foods.
function segments(text: string): string[] {
  return text
    .split(/[,+&\n;]|\band\b|\bwith\b/i)
    .map((s) => s.replace(/\d+(\.\d+)?/g, " ").trim())
    .filter((s) => /\p{L}{2,}/u.test(s));
}

function queryTokens(seg: string) {
  return norm(seg)
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w));
}

function scoreRows(idx: Awaited<ReturnType<typeof indexFor>>, seg: string, limit: number): RefFood[] {
  const q = queryTokens(seg);
  if (!q.length) return [];
  const local = seg.replace(/[^가-힯]/g, "");
  const n = idx.rows.length || 1;
  const idf = (t: string) => Math.log(1 + n / (1 + (idx.df.get(t) ?? 0)));
  const joined = q.join("");
  const scored: { row: RefFood; s: number }[] = [];
  for (const r of idx.rows) {
    let s = 0;
    let specific = false;
    for (const t of q) {
      let w = 0;
      if (r.tokens.has(t)) w = idf(t);
      else if (t.length >= 4) for (const rt of r.tokens) if (rt.length >= 4 && (rt.startsWith(t) || t.startsWith(rt))) w = Math.max(w, 0.6 * idf(rt));
      if (w > 0) {
        s += w;
        if (!GENERIC.has(t)) specific = true;
      }
    }
    if (local && r.row.nameLocal?.includes(local)) {
      s += 5;
      specific = true;
    }
    if (joined.length >= 5 && r.compact.includes(joined)) {
      s += 3;
      specific = true;
    }
    if (s > 0 && specific) scored.push({ row: r.row, s: s / Math.sqrt(r.tokens.size) });
  }
  return scored
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.row);
}

// Does the Singapore hawker table already cover this part of the meal?
function hawkerCovers(seg: string): boolean {
  const q = queryTokens(seg).filter((t) => !GENERIC.has(t));
  if (!q.length) return queryTokens(seg).length > 0; // e.g. "chicken rice": all generic words, leave it to the hawker table
  return FOODS.some((f) => {
    const words = new Set(norm(`${f.name} ${(f.aliases ?? []).join(" ")}`).split(" "));
    return q.some((t) => words.has(t));
  });
}

// Common English spellings -> Revised Romanization used in the Korean data ("kimchi" -> "gimchi").
const KOREAN_SPELLINGS: [RegExp, string][] = [
  [/\bkimchi/g, "gimchi"],
  [/\b(kimbap|kimbab|gimbab)\b/g, "gimbap"],
  [/\bkalbi/g, "galbi"],
  [/\b(chigae|jjige|chige|jigae)\b/g, "jjigae"],
  [/(?<=\w)(chigae|jjige|chige)\b/g, "jjigae"],
  [/\b(topokki|ddukbokki|ddeokbokki|tokbokki|dukbokki|tteokboki|teokbokki)\b/g, "tteokbokki"],
  [/\b(samgyupsal|samgyeobsal|samgyeopsal)\b/g, "samgyeopsal"],
  [/\b(soondubu|sundooboo|soon dubu)\b/g, "sundubu"],
  [/\b(jajangmyeon|jajangmyun|jjajangmyun|jajangmyen)\b/g, "jjajangmyeon"],
  [/\b(jjambbong|jjampong|champong|jjambong)\b/g, "jjamppong"],
  [/\bbibimbab\b/g, "bibimbap"],
  [/\bnaengmyun\b/g, "naengmyeon"],
  [/\bramyun\b/g, "ramyeon"],
  [/\bodeng\b/g, "eomuk"],
  [/\bdakgangjung\b/g, "dakgangjeong"],
  [/\bkimchi fried rice\b/g, "gimchibokkeumbap"],
  [/\bfried rice\b/g, "bokkeumbap"],
  [/\bstew\b/g, "jjigae"],
  [/\bdumplings?\b/g, "mandu"],
  [/\bcold noodles?\b/g, "naengmyeon"],
  [/\brice cakes?\b/g, "tteok"],
];
const toKoreanSpelling = (s: string) => KOREAN_SPELLINGS.reduce((acc, [re, to]) => acc.replace(re, to), s.toLowerCase());

export type Lookup = { cuisine: Cuisine; matches: RefFood[] };

export async function findSources(text: string): Promise<Lookup> {
  const cuisine = detectCuisine(text);
  const segs = segments(text);
  const matches: RefFood[] = [];
  const unmatched: string[] = [];

  if (cuisine === "korean" || cuisine === "indian") {
    const idx = await indexFor(cuisine).catch(() => null);
    for (const seg of segs) {
      const found = idx ? scoreRows(idx, cuisine === "korean" ? toKoreanSpelling(seg) : seg, 4) : [];
      if (found.length) matches.push(...found);
      else unmatched.push(seg);
    }
  } else if (cuisine === "western") {
    unmatched.push(...segs);
  } else {
    unmatched.push(...segs.filter((s) => !hawkerCovers(s)));
  }

  // Anything the cuisine's own data didn't cover: try USDA (generic foods and ingredients).
  if (unmatched.length) {
    const fdc = await Promise.all(unmatched.slice(0, 4).map((s) => searchFdc(queryTokens(s).join(" ")).catch(() => [])));
    matches.push(...fdc.flat());
  }

  const seen = new Set<string>();
  return { cuisine, matches: matches.filter((m) => !seen.has(m.id) && seen.add(m.id)).slice(0, 14) };
}
