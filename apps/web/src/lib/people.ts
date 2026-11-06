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
export function workerLabel(trade?: string | null): string {
  return trade === "housekeeping" ? "Housekeeper" : "Guard";
}

/** The accounts a filter keeps, or null for everyone. */
export async function peopleIds(supabase: Awaited<ReturnType<typeof supabaseServer>>, people: People): Promise<string[] | null> {
  if (people === "all") return null;
  let q = supabase.from("profiles").select("id").eq("role", "guard");
  q = people === "housekeeping" ? q.eq("trade", "housekeeping") : q.neq("trade", "housekeeping");
  const { data } = await q;
  return (data ?? []).map((p) => p.id);
}
