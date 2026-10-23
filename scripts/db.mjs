/**
 * Shared database plumbing for the migration and type-generation scripts.
 *
 * The database is the Supafleet tenant `tenant_nbss` on okhrang.core. Postgres
 * is bound to the server's loopback (127.0.0.1:5433), so `connect()` opens an
 * SSH tunnel to it for the life of the client and closes it on `end()`.
 *
 * The password is read from the tenant's own config on the server at connect
 * time, so the cluster's admin password is never copied into .env.
 *
 * One rule the cloud project did not have: pg_cron lives in the cluster's
 * `postgres` database, not in tenant_nbss. A migration that schedules a job
 * must use `cron.schedule_in_database(..., 'tenant_nbss')` from there (see
 * README → Database), not `cron.schedule` here.
 */

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
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

const HOST = process.env.NBSS_HOST ?? "root@187.126.117.188";

/** A free local port for the tunnel. */
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function waitForPort(port, child) {
  for (let i = 0; i < 50; i++) {
    if (child.exitCode !== null) throw new Error("The SSH tunnel to okhrang.core exited.");
    const open = await new Promise((resolve) => {
      const sock = net.connect(port, "127.0.0.1", () => (sock.end(), resolve(true)));
      sock.on("error", () => resolve(false));
    });
    if (open) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Timed out opening the SSH tunnel to okhrang.core.");
}

export async function connect() {
  const password = execFileSync(
    "ssh",
    [HOST, "sed -n 's/^PG_META_DB_PASSWORD=//p' /root/supafleet/tenants/nbss/meta.env"],
    { encoding: "utf8" },
  ).trim();
  if (!password) throw new Error("Could not read the tenant database password from okhrang.core.");

  const port = await freePort();
  const tunnel = spawn(
    "ssh",
    ["-N", "-o", "ExitOnForwardFailure=yes", "-L", `${port}:127.0.0.1:5433`, HOST],
    { stdio: "ignore" },
  );
  await waitForPort(port, tunnel);

  const client = new pg.Client({
    host: "127.0.0.1",
    port,
    user: "supabase_admin",
    password,
    database: "tenant_nbss",
    connectionTimeoutMillis: 15_000,
  });

  const end = client.end.bind(client);
  client.end = async () => {
    try {
      await end();
    } finally {
      tunnel.kill();
    }
  };

  try {
    await client.connect();
  } catch (err) {
    tunnel.kill();
    throw err;
  }
  return client;
}
