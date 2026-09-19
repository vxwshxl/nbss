/**
 * Writes packages/shared/src/db.ts by reading the live schema.
 *
 * Both the web app and the Expo app import these types, so they live in the
 * shared package rather than under either one.
 *
 * The Supabase CLI does this too, but only with a Docker daemon running. This
 * asks the catalog directly for the same information: columns, nullability,
 * defaults and enum labels.
 *
 *   pnpm db:types
 */

import fs from "node:fs";
import path from "node:path";

import { ROOT, connect } from "./db.mjs";

const OUT = path.join(ROOT, "packages", "shared", "src", "db.ts");

/** Postgres type → TypeScript. Anything unlisted falls back to string. */
const SCALARS = {
  bool: "boolean",
  int2: "number",
  int4: "number",
  int8: "number",
  float4: "number",
  float8: "number",
  numeric: "number",
  json: "Json",
  jsonb: "Json",
};

const client = await connect();

const { rows: enums } = await client.query(`
  select t.typname as name, array_agg(e.enumlabel::text order by e.enumsortorder) as labels
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  group by t.typname
  order by t.typname
`);

const enumNames = new Set(enums.map((e) => e.name));

const { rows: columns } = await client.query(`
  select c.relname as table,
         a.attname as column,
         format_type(a.atttypid, null) as formatted,
         t.typname as udt,
         not a.attnotnull as nullable,
         pg_get_expr(d.adbin, d.adrelid) is not null as has_default,
         a.attidentity <> '' as is_identity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  left join pg_type t on t.oid = a.atttypid
  where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'schema_migrations'
  order by c.relname, a.attnum
`);

/**
 * Views, separately.
 *
 * `client_attendance` is a view and not a table, and it is the only thing a client
 * is allowed to read presence from — so leaving it out of the generated types
 * meant the one query on the client's own page was untyped. A view has no
 * meaningful Insert or Update shape, so only Row is emitted for it.
 *
 * Nullability is not trustworthy for a view: Postgres reports almost every view
 * column as nullable because it cannot prove otherwise through a join. Rather than
 * pretend, every column is emitted as possibly null, which is the honest shape and
 * makes the caller handle the join miss it would otherwise be surprised by.
 */
const { rows: viewColumns } = await client.query(`
  select c.relname as table,
         a.attname as column,
         t.typname as udt
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_type t on t.oid = a.atttypid
  where n.nspname = 'public' and c.relkind in ('v', 'm')
  order by c.relname, a.attnum
`);

// Callable functions, so supabase-js `.rpc()` is typed rather than `never`.
// Trigger functions are excluded: they are invoked by Postgres, never by us.
const { rows: functions } = await client.query(`
  select p.proname as name,
         p.proretset as returns_set,
         coalesce(p.proallargtypes::oid[], p.proargtypes::oid[]) as arg_types,
         p.proargnames as arg_names,
         p.proargmodes::text[] as arg_modes,
         -- How many of the IN arguments have DEFAULTs. Postgres only allows
         -- defaults on trailing arguments, so this is the count of optional ones
         -- counting back from the end — which is what makes them optional in
         -- TypeScript too. Without this every RPC demanded every argument, and
         -- calling record_position without a heading was a type error for a
         -- parameter the database is perfectly happy to default.
         p.pronargdefaults as n_defaults,
         rt.typname as return_type
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_type rt on rt.oid = p.prorettype
  where n.nspname = 'public'
    and rt.typname <> 'trigger'
    and p.prokind = 'f'
  order by p.proname
`);

const { rows: typeNames } = await client.query(`
  select oid, typname from pg_type
`);
const typeByOid = new Map(typeNames.map((t) => [String(t.oid), t.typname]));

await client.end();

function tsType(col) {
  if (enumNames.has(col.udt)) return `Enums["${col.udt}"]`;
  const base = col.udt.startsWith("_") ? col.udt.slice(1) : col.udt;
  const ts = SCALARS[base] ?? "string";
  return col.udt.startsWith("_") ? `${ts}[]` : ts;
}

const tables = new Map();
for (const col of columns) {
  if (!tables.has(col.table)) tables.set(col.table, []);
  tables.get(col.table).push(col);
}

const views = new Map();
for (const col of viewColumns) {
  if (!views.has(col.table)) views.set(col.table, []);
  views.get(col.table).push(col);
}

const out = [];
out.push(`/**`);
out.push(` * Generated by scripts/gen-db-types.mjs — do not edit by hand.`);
out.push(` * Regenerate after any migration with \`pnpm db:types\`.`);
out.push(` */`);
out.push(``);
out.push(`export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];`);
out.push(``);
out.push(`export type Enums = {`);
for (const e of enums) {
  out.push(`  ${e.name}: ${e.labels.map((l) => `"${l}"`).join(" | ")};`);
}
out.push(`};`);
out.push(``);
out.push(`export type Database = {`);
out.push(`  public: {`);
out.push(`    Tables: {`);

for (const [table, cols] of tables) {
  out.push(`      ${table}: {`);

  out.push(`        Row: {`);
  for (const c of cols) {
    out.push(`          ${c.column}: ${tsType(c)}${c.nullable ? " | null" : ""};`);
  }
  out.push(`        };`);

  // A column is optional on insert when the database can supply it: it is
  // nullable, has a default, or is an identity column.
  out.push(`        Insert: {`);
  for (const c of cols) {
    const optional = c.nullable || c.has_default || c.is_identity;
    out.push(`          ${c.column}${optional ? "?" : ""}: ${tsType(c)}${c.nullable ? " | null" : ""};`);
  }
  out.push(`        };`);

  out.push(`        Update: {`);
  for (const c of cols) {
    out.push(`          ${c.column}?: ${tsType(c)}${c.nullable ? " | null" : ""};`);
  }
  out.push(`        };`);

  // supabase-js resolves its generics against this key too; without it the
  // whole Database type degrades to `never` at every call site.
  out.push(`        Relationships: [];`);

  out.push(`      };`);
}

out.push(`    };`);
// Views, Functions and CompositeTypes must be present even when empty, for
// the same reason: the client's generic constraints require all five keys.
if (views.size === 0) {
  out.push(`    Views: { [_ in never]: never };`);
} else {
  out.push(`    Views: {`);
  for (const [view, cols] of views) {
    out.push(`      ${view}: {`);
    out.push(`        Row: {`);
    for (const c of cols) out.push(`          ${c.column}: ${tsType(c)} | null;`);
    out.push(`        };`);
    out.push(`        Relationships: [];`);
    out.push(`      };`);
  }
  out.push(`    };`);
}
if (functions.length === 0) {
  out.push(`    Functions: { [_ in never]: never };`);
} else {
  out.push(`    Functions: {`);
  for (const fn of functions) {
    const argTypes = fn.arg_types ?? [];
    const argNames = fn.arg_names ?? [];
    const argModes = fn.arg_modes ?? null;

    const args = [];
    const returnCols = [];

    for (let i = 0; i < argTypes.length; i++) {
      // Modes: i=in, o=out, b=inout, v=variadic, t=table column.
      const mode = argModes ? argModes[i] : "i";
      const udt = typeByOid.get(String(argTypes[i])) ?? "text";
      const entry = { column: argNames[i] ?? `arg${i}`, udt };
      if (mode === "o" || mode === "t") returnCols.push(entry);
      else args.push(entry);
    }

    // The trailing `n_defaults` IN arguments may be omitted by the caller.
    const firstOptional = args.length - (fn.n_defaults ?? 0);

    out.push(`      ${fn.name}: {`);
    // A bare `{}` would mean "any non-nullish value", not "no arguments".
    if (args.length === 0) {
      out.push(`        Args: Record<PropertyKey, never>;`);
    } else {
      out.push(`        Args: {`);
      for (const [i, a] of args.entries()) {
        const optional = i >= firstOptional;
        out.push(`          ${a.column}${optional ? "?" : ""}: ${tsType(a)};`);
      }
      out.push(`        };`);
    }

    // A function with OUT columns returns rows shaped like them; otherwise it
    // returns its declared scalar.
    if (returnCols.length > 0) {
      const shape = returnCols.map((c) => `${c.column}: ${tsType(c)}`).join("; ");
      out.push(`        Returns: { ${shape} }${fn.returns_set ? "[]" : ""};`);
    } else {
      const scalar = tsType({ udt: fn.return_type });
      out.push(`        Returns: ${scalar}${fn.returns_set ? "[]" : ""};`);
    }

    out.push(`      };`);
  }
  out.push(`    };`);
}
out.push(`    Enums: Enums;`);
out.push(`    CompositeTypes: { [_ in never]: never };`);
out.push(`  };`);
out.push(`};`);
out.push(``);
out.push(`/** Shorthand: \`Row<"sites">\` instead of the full path. */`);
out.push(`export type Row<T extends keyof Database["public"]["Tables"]> =`);
out.push(`  Database["public"]["Tables"][T]["Row"];`);
out.push(``);
out.push(`/** The same, for a view: \`View<"client_attendance">\`. */`);
out.push(`export type View<T extends keyof Database["public"]["Views"]> =`);
out.push(`  Database["public"]["Views"][T]["Row"];`);
out.push(``);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out.join("\n"), "utf8");

console.log(`wrote ${path.relative(ROOT, OUT)} — ${tables.size} tables, ${views.size} views, ${enums.length} enums, ${functions.length} functions`);
