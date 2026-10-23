"use server";

import { revalidatePath } from "next/cache";

import { audit, requireRoleSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export type ReplacementResult = { ok: true; count?: number } | { ok: false; error: string };

async function staff() {
  const session = await requireRoleSession("admin", "supervisor");
  if (session.impersonating) throw new Error("Stop viewing as someone else to change the roster.");
  return session;
}

function done() {
  for (const p of ["/console/replacements", "/console/roster", "/console", "/console/live"]) revalidatePath(p);
}

/**
 * Hands shifts to another guard through `assign_replacement` (0022), run as the
 * signed-in supervisor so the database records who did it and refuses anyone
 * who is not staff. The original shifts are cancelled and linked, the
 * replacement's are created, and the replacement is told by push and email.
 */
export async function assignReplacement(input: {
  shiftIds: string[];
  guardId: string;
  reason?: string;
  requestId?: string | null;
}): Promise<ReplacementResult> {
  try {
    await staff();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (input.shiftIds.length === 0) return { ok: false, error: "Pick at least one duty to hand over." };
  if (!input.guardId) return { ok: false, error: "Pick the guard who will cover." };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("assign_replacement", {
    p_shift_ids: input.shiftIds,
    p_guard: input.guardId,
    p_reason: input.reason?.trim() || undefined,
    p_request_id: input.requestId ?? undefined,
  });
  if (error) return { ok: false, error: error.message };
  done();
  return { ok: true, count: (data as { count?: number } | null)?.count ?? input.shiftIds.length };
}

/** Says no to a guard's request: they keep the duty. */
export async function declineRequest(id: string): Promise<ReplacementResult> {
  let session;
  try {
    session = await staff();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("replacement_requests")
    .update({ status: "declined", handled_by: session.realProfile.id, handled_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "open")
    .select("guard_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "That request has already been dealt with." };
  await audit({ actor: session.realProfile, action: "replacement_declined", entity: "replacement_requests", entityId: id });
  done();
  return { ok: true };
}
