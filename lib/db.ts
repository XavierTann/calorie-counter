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

// Data owned by "user 0" is from before accounts existed; the first account to sign up claims it.
const LEGACY_USER = 0;

async function db(): Promise<Client> {
  const c = getClient();
  if (!ready) {
    ready = c
      .batch(
        [
          `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            pass_hash TEXT NOT NULL,
            sync_token TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
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
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            user_id INTEGER NOT NULL DEFAULT 0
          )`,
          `CREATE TABLE IF NOT EXISTS daily_energy (
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            active REAL,
            resting REAL,
            total REAL,
            source TEXT NOT NULL DEFAULT 'manual',
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (user_id, date)
          )`,
          `CREATE TABLE IF NOT EXISTS user_settings (
            user_id INTEGER PRIMARY KEY,
            json TEXT NOT NULL
          )`,
          // Each user's food dictionary: everything they've logged ("recorded") plus foods they added ("custom").
          `CREATE TABLE IF NOT EXISTS user_foods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            key TEXT NOT NULL,
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
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE (user_id, key)
          )`,
        ],
        "write",
      )
      .then(() => migrateSingleUserData(c))
      .catch((e) => {
        ready = null;
        throw e;
      });
  }
  await ready;
  return c;
}

// Moves data from the single-user tables into the per-user ones (owned by LEGACY_USER until claimed).
async function migrateSingleUserData(c: Client) {
  const tables = new Set((await c.execute("SELECT name FROM sqlite_master WHERE type = 'table'")).rows.map((r) => String(r.name)));
  const entryCols = (await c.execute("SELECT name FROM pragma_table_info('entries')")).rows.map((r) => String(r.name));
  const stmts: string[] = [];
  if (!entryCols.includes("user_id")) stmts.push("ALTER TABLE entries ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0");
  if (tables.has("energy")) {
    stmts.push(
      `INSERT OR IGNORE INTO daily_energy (user_id, date, active, resting, total, source, updated_at)
       SELECT ${LEGACY_USER}, date, active, resting, total, source, updated_at FROM energy`,
      "DROP TABLE energy",
    );
  }
  if (tables.has("settings")) {
    stmts.push(`INSERT OR IGNORE INTO user_settings (user_id, json) SELECT ${LEGACY_USER}, json FROM settings`, "DROP TABLE settings");
  }
  if (tables.has("my_foods")) {
    stmts.push(
      `INSERT OR IGNORE INTO user_foods (user_id, key, name, quantity, kcal, protein, carbs, fat, kind, edited, times, last_used, updated_at)
       SELECT ${LEGACY_USER}, key, name, quantity, kcal, protein, carbs, fat, kind, edited, times, last_used, updated_at FROM my_foods`,
      "DROP TABLE my_foods",
    );
  }
  for (const old of ["learned_foods", "meta"]) if (tables.has(old)) stmts.push(`DROP TABLE ${old}`);
  if (tables.has("entries")) stmts.push("DROP INDEX IF EXISTS entries_date");
  stmts.push("CREATE INDEX IF NOT EXISTS entries_user_date ON entries(user_id, date)");
  await c.batch(stmts, "write");
}

/* ---------------- Users ---------------- */

export type User = { id: number; username: string; passHash: string; syncToken: string };

function rowToUser(row: Record<string, unknown>): User {
  return { id: Number(row.id), username: String(row.username), passHash: String(row.pass_hash), syncToken: String(row.sync_token) };
}

export async function getUserByName(username: string): Promise<User | null> {
  const c = await db();
  const r = await c.execute({ sql: "SELECT * FROM users WHERE username = ?", args: [username] });
  return r.rows[0] ? rowToUser(r.rows[0] as Record<string, unknown>) : null;
}

export async function getUserById(id: number): Promise<User | null> {
  const c = await db();
  const r = await c.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] });
  return r.rows[0] ? rowToUser(r.rows[0] as Record<string, unknown>) : null;
}

export async function getUserBySyncToken(token: string): Promise<User | null> {
  if (!token) return null;
  const c = await db();
  const r = await c.execute({ sql: "SELECT * FROM users WHERE sync_token = ?", args: [token] });
  return r.rows[0] ? rowToUser(r.rows[0] as Record<string, unknown>) : null;
}

// Creates the account. The very first account also takes over the data from before accounts existed.
export async function createUser(username: string, passHash: string, syncToken: string): Promise<User> {
  const c = await db();
  const r = await c.execute({
    sql: "INSERT INTO users (username, pass_hash, sync_token) VALUES (?, ?, ?) RETURNING *",
    args: [username, passHash, syncToken],
  });
  const user = rowToUser(r.rows[0] as Record<string, unknown>);
  const first = await c.execute("SELECT MIN(id) AS id FROM users");
  if (Number(first.rows[0].id) === user.id) {
    await c.batch(
      ["entries", "daily_energy", "user_settings", "user_foods"].map((t) => ({
        sql: `UPDATE ${t} SET user_id = ? WHERE user_id = ${LEGACY_USER}`,
        args: [user.id],
      })),
      "write",
    );
  }
  return user;
}

export async function setSyncToken(userId: number, token: string) {
  const c = await db();
  await c.execute({ sql: "UPDATE users SET sync_token = ? WHERE id = ?", args: [token, userId] });
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/* ---------------- Diary ---------------- */

export async function listEntries(userId: number, date: string): Promise<Entry[]> {
  const c = await db();
  const r = await c.execute({ sql: "SELECT * FROM entries WHERE user_id = ? AND date = ? ORDER BY id", args: [userId, date] });
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

export async function addEntries(userId: number, date: string, meal: Meal, items: FoodItem[]) {
  const c = await db();
  await c.batch(
    items.map((i) => ({
      sql: `INSERT INTO entries (user_id, date, meal, name, quantity, kcal, protein, carbs, fat, source, confidence, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [userId, date, meal, i.name, i.quantity, i.kcal, i.protein, i.carbs, i.fat, i.source, i.confidence, i.note ?? null],
    })),
    "write",
  );
}

export async function deleteEntry(userId: number, id: number) {
  const c = await db();
  await c.execute({ sql: "DELETE FROM entries WHERE id = ? AND user_id = ?", args: [id, userId] });
}

export async function getEnergy(userId: number, date: string): Promise<Energy | null> {
  const c = await db();
  const r = await c.execute({ sql: "SELECT * FROM daily_energy WHERE user_id = ? AND date = ?", args: [userId, date] });
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

export async function upsertEnergy(userId: number, e: { date: string; active: number | null; resting: number | null; total: number | null; source: string }) {
  const c = await db();
  const total = e.total ?? (e.active !== null && e.resting !== null ? e.active + e.resting : null);
  await c.execute({
    sql: `INSERT INTO daily_energy (user_id, date, active, resting, total, source, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(user_id, date) DO UPDATE SET active = excluded.active, resting = excluded.resting,
            total = excluded.total, source = excluded.source, updated_at = excluded.updated_at`,
    args: [userId, e.date, e.active, e.resting, total, e.source],
  });
}

export async function getSettings(userId: number): Promise<Settings> {
  const c = await db();
  const r = await c.execute({ sql: "SELECT json FROM user_settings WHERE user_id = ?", args: [userId] });
  if (!r.rows[0]) return DEFAULT_SETTINGS;
  const saved = { ...DEFAULT_SETTINGS, ...JSON.parse(String(r.rows[0].json)) } as Settings;
  // Older versions measured home cooking in scoops; switch those to the tablespoon defaults.
  if (saved.homeUnits.some((u) => u.id.endsWith("-scoop"))) saved.homeUnits = DEFAULT_SETTINGS.homeUnits;
  return saved;
}

export async function saveSettings(userId: number, s: Settings) {
  const c = await db();
  await c.execute({
    sql: "INSERT INTO user_settings (user_id, json) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET json = excluded.json",
    args: [userId, JSON.stringify(s)],
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

export async function listMyFoods(userId: number): Promise<MyFood[]> {
  const c = await db();
  const r = await c.execute({ sql: "SELECT * FROM user_foods WHERE user_id = ? ORDER BY COALESCE(last_used, updated_at) DESC", args: [userId] });
  return r.rows.map((row) => rowToMyFood(row as Record<string, unknown>));
}

// Foods the AI should treat as the user's own numbers: custom foods and corrected ones.
export async function foodsForAI(userId: number): Promise<FoodItem[]> {
  const c = await db();
  const r = await c.execute({
    sql: "SELECT * FROM user_foods WHERE user_id = ? AND (kind = 'custom' OR edited = 1) ORDER BY COALESCE(last_used, updated_at) DESC LIMIT 300",
    args: [userId],
  });
  return r.rows.map((row) => ({ ...rowToMyFood(row as Record<string, unknown>), source: "my food", confidence: "high" as const }));
}

// Called on every log. Keeps counts; corrected numbers win, otherwise the latest AI numbers are kept.
export async function recordFoods(userId: number, items: FoodItem[]) {
  if (!items.length) return;
  const c = await db();
  const pick = (col: string) =>
    `${col} = CASE WHEN excluded.edited = 1 OR (user_foods.kind = 'recorded' AND user_foods.edited = 0) THEN excluded.${col} ELSE user_foods.${col} END`;
  await c.batch(
    items.map((i) => ({
      sql: `INSERT INTO user_foods (user_id, key, name, quantity, kcal, protein, carbs, fat, kind, edited, times, last_used)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'recorded', ?, 1, datetime('now'))
            ON CONFLICT(user_id, key) DO UPDATE SET times = user_foods.times + 1, last_used = excluded.last_used,
              ${["kcal", "protein", "carbs", "fat"].map(pick).join(", ")},
              edited = MAX(user_foods.edited, excluded.edited), updated_at = datetime('now')`,
      args: [userId, foodKey(i.name, i.quantity), i.name, i.quantity, i.kcal, i.protein, i.carbs, i.fat, i.source.includes("(edited)") ? 1 : 0],
    })),
    "write",
  );
}

export type FoodInput = { name: string; quantity: string; kcal: number; protein: number; carbs: number; fat: number };

export async function createCustomFood(userId: number, f: FoodInput) {
  const c = await db();
  await c.execute({
    sql: `INSERT INTO user_foods (user_id, key, name, quantity, kcal, protein, carbs, fat, kind, edited)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'custom', 1)
          ON CONFLICT(user_id, key) DO UPDATE SET name = excluded.name, quantity = excluded.quantity, kcal = excluded.kcal, protein = excluded.protein,
            carbs = excluded.carbs, fat = excluded.fat, kind = 'custom', edited = 1, updated_at = datetime('now')`,
    args: [userId, foodKey(f.name, f.quantity), f.name, f.quantity, f.kcal, f.protein, f.carbs, f.fat],
  });
}

export async function updateMyFood(userId: number, id: number, f: FoodInput) {
  const c = await db();
  await c.execute({
    sql: `UPDATE user_foods SET key = ?, name = ?, quantity = ?, kcal = ?, protein = ?, carbs = ?, fat = ?, edited = 1, updated_at = datetime('now')
          WHERE id = ? AND user_id = ?`,
    args: [foodKey(f.name, f.quantity), f.name, f.quantity, f.kcal, f.protein, f.carbs, f.fat, id, userId],
  });
}

export async function deleteMyFood(userId: number, id: number) {
  const c = await db();
  await c.execute({ sql: "DELETE FROM user_foods WHERE id = ? AND user_id = ?", args: [id, userId] });
}
