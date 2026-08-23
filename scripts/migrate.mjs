/**
 * Applies every SQL file in supabase/migrations that has not run yet.
 *
 * Each file runs inside a transaction and is recorded in `schema_migrations`,
 * so a partial failure rolls back whole and re-running is always safe.
 *
 *   pnpm db:migrate            apply anything outstanding
 *   pnpm db:migrate --status   list what has and has not run
 */

import fs from "node:fs";
import path from "node:path";

import { ROOT, connect } from "./db.mjs";

const DIR = path.join(ROOT, "supabase", "migrations");

const client = await connect();

await client.query(`
  create table if not exists schema_migrations (
    name       text primary key,
    applied_at timestamptz not null default now()
  )
`);

const applied = new Set(
  (await client.query("select name from schema_migrations")).rows.map((r) => r.name),
);

const files = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()
  : [];

if (process.argv.includes("--status")) {
  for (const f of files) console.log(`${applied.has(f) ? "applied" : "  ----- "}  ${f}`);
  await client.end();
  process.exit(0);
}

const pending = files.filter((f) => !applied.has(f));

if (pending.length === 0) {
  console.log(`Up to date — ${files.length} migration(s) applied.`);
  await client.end();
  process.exit(0);
}

for (const name of pending) {
  const sql = fs.readFileSync(path.join(DIR, name), "utf8");
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into schema_migrations (name) values ($1)", [name]);
    await client.query("commit");
    console.log(`applied  ${name}`);
  } catch (err) {
    await client.query("rollback");
    console.error(`FAILED   ${name}\n  ${err.message}`);
    if (err.position) {
      const upto = sql.slice(0, Number(err.position)).split("\n");
      console.error(`  line ${upto.length}: ${sql.split("\n")[upto.length - 1]?.trim() ?? ""}`);
    }
    await client.end();
    process.exit(1);
  }
}

await client.end();
