import { fetchAll } from "@nbss/shared/paging";

import type { supabaseServer } from "@/lib/supabase/server";

/**
 * Who an attendance page is about: everyone who checks in, or only the guards, or
 * only the housekeepers. Read from `?people=guard|housekeeping`. A housekeeper is
 * the guard role with the housekeeping trade (0050), so the two are told apart by
 * trade. Supervisors do not check in (punch_in takes the guard role only), so they
 * have no attendance to show.
 */
export type People = "all" | "guard" | "housekeeping";

export function readPeople(v?: string | null): People {
  return v === "guard" || v === "housekeeping" ? v : "all";
}

/** "Guard" or "Housekeeper", from a guard-role account's trade. */
export function workerLabel(trade?: string | null, role?: string | null): string {
  // Supervisors and field officers check in too (0082).
  if (role === "supervisor") return "Supervisor";
  if (role === "field_officer") return "Field officer";
  return trade === "housekeeping" ? "Housekeeper" : "Guard";
}

/**
 * The accounts a filter keeps, or null for everyone. Meant for filtering rows already
 * read (`new Set(ids)`): a list of every guard's id in the request itself grows past
 * what a URL can carry as the company does (200 ids is already 7 KB). To filter in the
 * query, use `peopleScope` and `narrowTo`.
 */
export async function peopleIds(supabase: Awaited<ReturnType<typeof supabaseServer>>, people: People): Promise<string[] | null> {
  const scope = await peopleScope(supabase, people);
  return scope ? scope.keep : null;
}

/** Who a filter keeps and who it leaves out, so a query can name whichever is shorter. */
export async function peopleScope(supabase: Awaited<ReturnType<typeof supabaseServer>>, people: People): Promise<{ keep: string[]; skip: string[] } | null> {
  if (people === "all") return null;
  const { data } = await fetchAll(supabase.from("profiles").select("id, trade").eq("role", "guard"));
  const keep: string[] = [];
  const skip: string[] = [];
  for (const p of data) ((p.trade === "housekeeping") === (people === "housekeeping") ? keep : skip).push(p.id);
  return { keep, skip };
}

const NOBODY = "00000000-0000-0000-0000-000000000000";

/**
 * Narrows a query to the people a scope keeps, naming the shorter list: "only these 2
 * housekeepers", or "everyone but these 2" for guards, rather than 200 guards' ids.
 */
export function narrowTo<Q>(query: Q, scope: { keep: string[]; skip: string[] } | null, column = "guard_id"): Q {
  if (!scope) return query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = query as any;
  if (scope.keep.length <= scope.skip.length) return q.in(column, scope.keep.length ? scope.keep : [NOBODY]);
  return scope.skip.length ? q.not(column, "in", `(${scope.skip.join(",")})`) : query;
}
