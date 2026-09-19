/**
 * The database's shape, re-exported.
 *
 * The generated file itself now lives in `@nbss/shared` — the Expo app needs
 * exactly the same types, and a schema described in two places is a schema that
 * will disagree with itself by the third migration. This shim exists so the
 * fifty-odd `@/lib/supabase/types` imports in this app keep resolving.
 *
 * Regenerate with `pnpm db:types` from the repository root.
 */
export type { Database, Enums, Json, Row, View } from "@nbss/shared/db";
