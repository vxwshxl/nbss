"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { audit, requireRoleSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/types";

/**
 * Reviewing a punch.
 *
 * Attendance is what payroll and a client invoice are both derived from, so a
 * correction here is a financial act. Three rules follow from that, and all
 * three are enforced below rather than left to the interface:
 *
 *   · a reason is required — a silently altered row is worthless as evidence;
 *   · the original coordinates, accuracy and distance are never overwritten,
 *     only the verdict on them changes;
 *   · every decision names the reviewer and lands in the audit log.
 */

type Verdict = Extract<Enums["attendance_status"], "present" | "late" | "absent" | "rejected">;

export type ReviewResult = { ok: true } | { ok: false; error: string };

export async function reviewAttendance(
  id: string,
  verdict: Verdict,
  note: string,
): Promise<ReviewResult> {
  const session = await requireRoleSession("admin", "supervisor");

  const reason = note.trim();
  if (reason.length < 4) {
    return { ok: false, error: "Give a reason for the change — it is kept with the record." };
  }

  const admin = supabaseAdmin();

  const { data: row } = await admin
    .from("attendance")
    .select("id, guard_id, site_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!row) return { ok: false, error: "That punch no longer exists." };

  const { error } = await admin
    .from("attendance")
    .update({
      status: verdict,
      reviewed_by: session.realProfile.id,
      review_note: reason,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  const h = await headers();
  await audit({
    actor: session.realProfile,
    action: "attendance_reviewed",
    entity: "attendance",
    entityId: id,
    detail: { from: row.status, to: verdict, note: reason },
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  revalidatePath("/console/attendance");
  revalidatePath("/console");

  return { ok: true };
}

/**
 * Closes a punch somebody forgot to close.
 *
 * Capped at the site's standard shift rather than run to the present moment: a
 * guard who forgot to check out on Friday should not be paid for the weekend,
 * and the cap is the honest reading of what they were rostered to work. It
 * lands as `pending_review` so a human still confirms it.
 */
export async function forceCheckOut(id: string, note: string): Promise<ReviewResult> {
  const session = await requireRoleSession("admin", "supervisor");

  const reason = note.trim();
  if (reason.length < 4) return { ok: false, error: "Give a reason for closing this shift." };

  const admin = supabaseAdmin();

  const { data: row } = await admin
    .from("attendance")
    .select("id, check_in_at, check_out_at, site_id, sites(standard_shift_minutes)")
    .eq("id", id)
    .maybeSingle();

  if (!row) return { ok: false, error: "That punch no longer exists." };
  if (row.check_out_at) return { ok: false, error: "That shift is already closed." };
  if (!row.check_in_at) return { ok: false, error: "That punch has no check-in time." };

  const site = Array.isArray(row.sites) ? row.sites[0] : row.sites;
  const cap = site?.standard_shift_minutes ?? 480;

  const closeAt = new Date(new Date(row.check_in_at).getTime() + cap * 60_000);
  // Never invent time that has not happened yet.
  const bounded = closeAt > new Date() ? new Date() : closeAt;

  const { error } = await admin
    .from("attendance")
    .update({
      check_out_at: bounded.toISOString(),
      check_out_method: "auto_close",
      status: "pending_review",
      reviewed_by: session.realProfile.id,
      review_note: reason,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  await audit({
    actor: session.realProfile,
    action: "attendance_force_closed",
    entity: "attendance",
    entityId: id,
    detail: { capped_minutes: cap, note: reason },
  });

  revalidatePath("/console/attendance");
  revalidatePath("/console");

  return { ok: true };
}
