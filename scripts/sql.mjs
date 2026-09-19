/**
 * Runs one-off SQL against the project, for the questions a migration should not
 * answer — "how many rows does that table have now", "did the policy actually
 * get created", "show me the plan for this query".
 *
 *   pnpm db:sql "select count(*) from attendance"
 *   pnpm db:sql -f scripts/sql/some-query.sql
 *
 * Reads, deliberately, are what this is for. It will happily run DDL, but
 * anything meant to survive belongs in supabase/migrations so that the next
 * environment gets it too.
 */

import fs from "node:fs";

import { connect } from "./db.mjs";

const args = process.argv.slice(2);
const fileFlag = args.indexOf("-f");

const sql =
  fileFlag !== -1
    ? fs.readFileSync(args[fileFlag + 1], "utf8")
    : args.filter((a) => !a.startsWith("-")).join(" ");

if (!sql.trim()) {
  console.error('Nothing to run. Try: pnpm db:sql "select now()"');
  process.exit(1);
}

const client = await connect();

try {
  const result = await client.query(sql);
  const results = Array.isArray(result) ? result : [result];

  for (const r of results) {
    if (r.rows?.length) {
      console.table(r.rows);
    } else {
      console.log(`${r.command ?? "OK"} — ${r.rowCount ?? 0} row(s)`);
    }
  }
} catch (err) {
  console.error(`FAILED  ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
