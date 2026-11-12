// Loads the prepared datasets in data/ref/*.json into the ref_foods table.
// Usage:
//   node scripts/ref/import.mjs           -> the database in .env.local (Turso if TURSO_DATABASE_URL is set)
//   node scripts/ref/import.mjs --local   -> ./local.db
// Safe to rerun: each source's rows are replaced.
import fs from "node:fs";
import { createClient } from "@libsql/client";

const env = fs.existsSync(".env.local")
  ? Object.fromEntries(
      fs
        .readFileSync(".env.local", "utf8")
        .split("\n")
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
    )
  : {};
const local = process.argv.includes("--local");
const url = local ? "file:local.db" : process.env.TURSO_DATABASE_URL || env.TURSO_DATABASE_URL || "file:local.db";
const db = createClient({ url, authToken: local ? undefined : process.env.TURSO_AUTH_TOKEN || env.TURSO_AUTH_TOKEN });

// Same table as lib/db.ts.
await db.execute(`CREATE TABLE IF NOT EXISTS ref_foods (
  id TEXT PRIMARY KEY, source TEXT NOT NULL, cuisine TEXT NOT NULL, name TEXT NOT NULL, name_local TEXT,
  search TEXT NOT NULL DEFAULT '', serving TEXT NOT NULL, kcal REAL NOT NULL, protein REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0, fat REAL NOT NULL DEFAULT 0, kcal_100 REAL, note TEXT)`);
await db.execute("CREATE INDEX IF NOT EXISTS ref_foods_cuisine ON ref_foods(cuisine)");

const datasets = [
  {
    source: "kr-mfds",
    cuisine: "korean",
    file: "data/ref/korea.json",
    toRow: (r) => ({
      id: `kr:${r.code}`,
      // Romanised name, e.g. "gimchijjigae haem" for 김치찌개_햄 (kimchi jjigae, ham).
      name: r.roman,
      name_local: r.name_local,
      search: [r.roman, r.roman_group].join(" "),
      serving: `1 serving (${r.serving_amount} ${r.serving_unit})`,
      kcal: r.kcal,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      kcal_100: r.kcal_100,
      note: r.origin,
    }),
  },
  {
    source: "in-indb",
    cuisine: "indian",
    file: "data/ref/india.json",
    toRow: (r) => ({
      id: `in:${r.code}`,
      name: r.name,
      name_local: null,
      search: r.name.replace(/[/()]/g, " "),
      serving: r.serving,
      kcal: r.kcal,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      kcal_100: r.kcal_100,
      note: null,
    }),
  },
];

for (const d of datasets) {
  if (!fs.existsSync(d.file)) {
    console.warn(`skip ${d.source}: ${d.file} not found`);
    continue;
  }
  const rows = JSON.parse(fs.readFileSync(d.file, "utf8")).map(d.toRow);
  const stmts = [{ sql: "DELETE FROM ref_foods WHERE source = ?", args: [d.source] }];
  for (const r of rows) {
    stmts.push({
      sql: `INSERT OR REPLACE INTO ref_foods (id, source, cuisine, name, name_local, search, serving, kcal, protein, carbs, fat, kcal_100, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [r.id, d.source, d.cuisine, r.name, r.name_local, r.search.toLowerCase(), r.serving, r.kcal, r.protein, r.carbs, r.fat, r.kcal_100, r.note],
    });
  }
  await db.batch(stmts, "write");
  console.log(`${d.source}: ${rows.length} rows -> ${local ? "local.db" : url.startsWith("file:") ? url : "Turso"}`);
}
