import { createClient, type Client } from "@libsql/client";
import { DEFAULT_SETTINGS } from "./defaults";
import type { Energy, Entry, FoodItem, Meal, Settings } from "./types";

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
          // Foods whose calories you corrected, so the AI uses your numbers next time.
          `CREATE TABLE IF NOT EXISTS learned_foods (
            name TEXT PRIMARY KEY,
            quantity TEXT NOT NULL,
            kcal REAL NOT NULL,
            protein REAL NOT NULL,
            carbs REAL NOT NULL,
            fat REAL NOT NULL,
            source TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
        ],
        "write",
      )
      .then(() => undefined)
      .catch((e) => {
        ready = null;
        throw e;
      });
  }
  await ready;
  return c;
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

export async function listLearnedFoods(): Promise<FoodItem[]> {
  const c = await db();
  const r = await c.execute("SELECT * FROM learned_foods ORDER BY created_at DESC LIMIT 300");
  return r.rows.map((row) => ({
    name: String(row.name),
    quantity: String(row.quantity),
    kcal: Number(row.kcal),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
    source: String(row.source),
    confidence: "medium" as const,
  }));
}

export async function saveLearnedFoods(items: FoodItem[]) {
  if (!items.length) return;
  const c = await db();
  await c.batch(
    items.map((i) => ({
      sql: `INSERT INTO learned_foods (name, quantity, kcal, protein, carbs, fat, source) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET quantity = excluded.quantity, kcal = excluded.kcal, protein = excluded.protein,
              carbs = excluded.carbs, fat = excluded.fat, source = excluded.source`,
      args: [i.name.toLowerCase(), i.quantity, i.kcal, i.protein, i.carbs, i.fat, i.source],
    })),
    "write",
  );
}

// Recent distinct foods, for one-tap re-logging.
export async function recentFoods(limit = 12): Promise<FoodItem[]> {
  const c = await db();
  const r = await c.execute({
    sql: `SELECT name, quantity, kcal, protein, carbs, fat, source, confidence, MAX(id) AS last
          FROM entries GROUP BY name, quantity ORDER BY last DESC LIMIT ?`,
    args: [limit],
  });
  return r.rows.map((row) => ({
    name: String(row.name),
    quantity: String(row.quantity),
    kcal: Number(row.kcal),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
    source: String(row.source),
    confidence: String(row.confidence) as FoodItem["confidence"],
  }));
}
