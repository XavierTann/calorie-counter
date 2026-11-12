import { createClient, type Client } from "@libsql/client";
import { DEFAULT_SETTINGS } from "./defaults";
import type { Energy, Entry, FoodItem, Meal, MyFood, Settings } from "./types";

let client: Client | null = null;
let ready: Promise<void> | null = null;

function getClient(): Client {
  if (!client) {
    client = createClient({
      // Local dev: a SQLite file. Production: a Turso database URL.
      url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

async function db(): Promise<Client> {
  const c = getClient();
  if (!ready) {
    ready = c
      .batch(
        [
          `CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            meal TEXT NOT NULL,
            name TEXT NOT NULL,
            quantity TEXT NOT NULL DEFAULT '',
            kcal REAL NOT NULL,
            protein REAL NOT NULL DEFAULT 0,
            carbs REAL NOT NULL DEFAULT 0,
            fat REAL NOT NULL DEFAULT 0,
            source TEXT NOT NULL DEFAULT '',
            confidence TEXT NOT NULL DEFAULT 'medium',
            note TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
          `CREATE INDEX IF NOT EXISTS entries_date ON entries(date)`,
          `CREATE TABLE IF NOT EXISTS energy (
            date TEXT PRIMARY KEY,
            active REAL,
            resting REAL,
            total REAL,
            source TEXT NOT NULL DEFAULT 'manual',
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
          `CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            json TEXT NOT NULL
          )`,
          // Your food dictionary: everything you've logged ("recorded") plus foods you added yourself ("custom").
          `CREATE TABLE IF NOT EXISTS my_foods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            quantity TEXT NOT NULL DEFAULT '',
            kcal REAL NOT NULL,
            protein REAL NOT NULL DEFAULT 0,
            carbs REAL NOT NULL DEFAULT 0,
            fat REAL NOT NULL DEFAULT 0,
            kind TEXT NOT NULL DEFAULT 'recorded',
            edited INTEGER NOT NULL DEFAULT 0,
            times INTEGER NOT NULL DEFAULT 0,
            last_used TEXT,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
          `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
        ],
        "write",
      )
      .then(() => backfillMyFoods(c))
      .catch((e) => {
        ready = null;
        throw e;
      });
  }
  await ready;
  return c;
}

// One-off: fill the food dictionary from past diary entries and the old learned_foods table.
async function backfillMyFoods(c: Client) {
  const done = await c.execute("SELECT v FROM meta WHERE k = 'my_foods_backfilled'");
  if (done.rows[0]) return;
  await c.execute(`INSERT OR IGNORE INTO my_foods (key, name, quantity, kcal, protein, carbs, fat, kind, edited, times, last_used)
    SELECT lower(trim(name)) || '|' || lower(trim(quantity)), name, quantity, kcal, protein, carbs, fat, 'recorded',
      CASE WHEN source LIKE '%(edited)%' THEN 1 ELSE 0 END, COUNT(*), MAX(created_at)
    FROM entries GROUP BY lower(trim(name)), lower(trim(quantity))`);
  try {
    await c.execute(`INSERT INTO my_foods (key, name, quantity, kcal, protein, carbs, fat, kind, edited, times)
      SELECT lower(trim(name)) || '|' || lower(trim(quantity)), name, quantity, kcal, protein, carbs, fat, 'recorded', 1, 0 FROM learned_foods WHERE true
      ON CONFLICT(key) DO UPDATE SET kcal = excluded.kcal, protein = excluded.protein, carbs = excluded.carbs, fat = excluded.fat, edited = 1`);
    await c.execute("DROP TABLE learned_foods");
  } catch {
    // No old table: nothing to move.
  }
  await c.execute("INSERT OR IGNORE INTO meta (k, v) VALUES ('my_foods_backfilled', datetime('now'))");
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function listEntries(date: string): Promise<Entry[]> {
  const c = await db();
  const r = await c.execute({ sql: "SELECT * FROM entries WHERE date = ? ORDER BY id", args: [date] });
  return r.rows.map((row) => ({
    id: Number(row.id),
    date: String(row.date),
    meal: String(row.meal) as Meal,
    name: String(row.name),
    quantity: String(row.quantity),
    kcal: Number(row.kcal),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
    source: String(row.source),
    confidence: String(row.confidence) as Entry["confidence"],
    note: row.note ? String(row.note) : undefined,
    created_at: String(row.created_at),
  }));
}

export async function addEntries(date: string, meal: Meal, items: FoodItem[]) {
  const c = await db();
  await c.batch(
    items.map((i) => ({
      sql: `INSERT INTO entries (date, meal, name, quantity, kcal, protein, carbs, fat, source, confidence, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [date, meal, i.name, i.quantity, i.kcal, i.protein, i.carbs, i.fat, i.source, i.confidence, i.note ?? null],
    })),
    "write",
  );
}

export async function deleteEntry(id: number) {
  const c = await db();
  await c.execute({ sql: "DELETE FROM entries WHERE id = ?", args: [id] });
}

export async function getEnergy(date: string): Promise<Energy | null> {
  const c = await db();
  const r = await c.execute({ sql: "SELECT * FROM energy WHERE date = ?", args: [date] });
  const row = r.rows[0];
  if (!row) return null;
  return {
    date: String(row.date),
    active: num(row.active),
    resting: num(row.resting),
    total: num(row.total),
    source: String(row.source),
    updated_at: String(row.updated_at),
  };
}

export async function upsertEnergy(e: { date: string; active: number | null; resting: number | null; total: number | null; source: string }) {
  const c = await db();
  const total = e.total ?? (e.active !== null && e.resting !== null ? e.active + e.resting : null);
  await c.execute({
    sql: `INSERT INTO energy (date, active, resting, total, source, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(date) DO UPDATE SET active = excluded.active, resting = excluded.resting,
            total = excluded.total, source = excluded.source, updated_at = excluded.updated_at`,
    args: [e.date, e.active, e.resting, total, e.source],
  });
}

export async function getSettings(): Promise<Settings> {
  const c = await db();
  const r = await c.execute("SELECT json FROM settings WHERE id = 1");
  if (!r.rows[0]) return DEFAULT_SETTINGS;
  const saved = { ...DEFAULT_SETTINGS, ...JSON.parse(String(r.rows[0].json)) } as Settings;
  // Older versions measured home cooking in scoops; switch those to the tablespoon defaults.
  if (saved.homeUnits.some((u) => u.id.endsWith("-scoop"))) saved.homeUnits = DEFAULT_SETTINGS.homeUnits;
  return saved;
}

export async function saveSettings(s: Settings) {
  const c = await db();
  await c.execute({
    sql: "INSERT INTO settings (id, json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json",
    args: [JSON.stringify(s)],
  });
}

export const foodKey = (name: string, quantity: string) => `${name.trim().toLowerCase()}|${quantity.trim().toLowerCase()}`;

function rowToMyFood(row: Record<string, unknown>): MyFood {
  return {
    id: Number(row.id),
    name: String(row.name),
    quantity: String(row.quantity),
    kcal: Number(row.kcal),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
    kind: row.kind === "custom" ? "custom" : "recorded",
    edited: Number(row.edited) === 1,
    times: Number(row.times),
    lastUsed: row.last_used ? String(row.last_used) : null,
  };
}

export async function listMyFoods(): Promise<MyFood[]> {
  const c = await db();
  const r = await c.execute("SELECT * FROM my_foods ORDER BY COALESCE(last_used, updated_at) DESC");
  return r.rows.map((row) => rowToMyFood(row as Record<string, unknown>));
}

// Foods the AI should treat as the user's own numbers: custom foods and corrected ones.
export async function foodsForAI(): Promise<FoodItem[]> {
  const c = await db();
  const r = await c.execute("SELECT * FROM my_foods WHERE kind = 'custom' OR edited = 1 ORDER BY COALESCE(last_used, updated_at) DESC LIMIT 300");
  return r.rows.map((row) => ({ ...rowToMyFood(row as Record<string, unknown>), source: "my food", confidence: "high" as const }));
}

// Called on every log. Keeps counts; corrected numbers win, otherwise the latest AI numbers are kept.
export async function recordFoods(items: FoodItem[]) {
  if (!items.length) return;
  const c = await db();
  const pick = (col: string) =>
    `${col} = CASE WHEN excluded.edited = 1 OR (my_foods.kind = 'recorded' AND my_foods.edited = 0) THEN excluded.${col} ELSE my_foods.${col} END`;
  await c.batch(
    items.map((i) => ({
      sql: `INSERT INTO my_foods (key, name, quantity, kcal, protein, carbs, fat, kind, edited, times, last_used)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'recorded', ?, 1, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET times = my_foods.times + 1, last_used = excluded.last_used,
              ${["kcal", "protein", "carbs", "fat"].map(pick).join(", ")},
              edited = MAX(my_foods.edited, excluded.edited), updated_at = datetime('now')`,
      args: [foodKey(i.name, i.quantity), i.name, i.quantity, i.kcal, i.protein, i.carbs, i.fat, i.source.includes("(edited)") ? 1 : 0],
    })),
    "write",
  );
}

export type FoodInput = { name: string; quantity: string; kcal: number; protein: number; carbs: number; fat: number };

export async function createCustomFood(f: FoodInput) {
  const c = await db();
  await c.execute({
    sql: `INSERT INTO my_foods (key, name, quantity, kcal, protein, carbs, fat, kind, edited)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'custom', 1)
          ON CONFLICT(key) DO UPDATE SET name = excluded.name, quantity = excluded.quantity, kcal = excluded.kcal, protein = excluded.protein,
            carbs = excluded.carbs, fat = excluded.fat, kind = 'custom', edited = 1, updated_at = datetime('now')`,
    args: [foodKey(f.name, f.quantity), f.name, f.quantity, f.kcal, f.protein, f.carbs, f.fat],
  });
}

export async function updateMyFood(id: number, f: FoodInput) {
  const c = await db();
  await c.execute({
    sql: `UPDATE my_foods SET key = ?, name = ?, quantity = ?, kcal = ?, protein = ?, carbs = ?, fat = ?, edited = 1, updated_at = datetime('now')
          WHERE id = ?`,
    args: [foodKey(f.name, f.quantity), f.name, f.quantity, f.kcal, f.protein, f.carbs, f.fat, id],
  });
}

export async function deleteMyFood(id: number) {
  const c = await db();
  await c.execute({ sql: "DELETE FROM my_foods WHERE id = ?", args: [id] });
}
