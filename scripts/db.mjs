/**
 * Shared database plumbing for the migration and type-generation scripts.
 *
 * The Supabase CLI wants Docker running even to read a remote schema, which is
 * a heavy dependency for two jobs that are really just "run this SQL" and
 * "describe these tables". This connects straight to the project over the
 * session pooler instead.
 *
 * Credentials are read from .env at run time and never written into a script.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** A deliberately small .env reader — enough for KEY=value and "quoted values". */
export function readEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) throw new Error("No .env found at the project root.");

  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[trimmed.slice(0, eq).trim()] = value;
  }
  return env;
}

/**
 * The session pooler on port 5432, not the transaction pooler on 6543:
 * migrations issue DDL and need a real session, which the transaction pooler
 * does not guarantee.
 */
export async function connect() {
  const env = readEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const password = env.SUPABASE_DB_PASSWORD;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set in .env");
  if (!password) throw new Error("SUPABASE_DB_PASSWORD is not set in .env");

  const ref = new URL(url).hostname.split(".")[0];

  const client = new pg.Client({
    host: env.SUPABASE_DB_HOST ?? "aws-0-ap-southeast-1.pooler.supabase.com",
    port: 5432,
    user: `postgres.${ref}`,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
  });

  await client.connect();
  return client;
}
