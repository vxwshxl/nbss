"use server";

import { revalidatePath } from "next/cache";

import { audit, requireRoleSession } from "@/lib/auth";
import { istInstant, parseTime } from "@/lib/roster";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * The roster's writes. Admins and supervisors both run the roster — it is the
 * supervisor's daily job — but nobody does it while viewing as someone else.
 */

export type RosterResult = { ok: true; note?: string } | { ok: false; error: string };

async function staff() {
  const session = await requireRoleSession("admin", "supervisor");
  if (session.impersonating) throw new Error("Stop viewing as someone else to change the roster.");
  return session;
}

function done(paths: string[] = []) {
  for (const p of ["/console/roster", "/console", "/console/sites", ...paths]) revalidatePath(p);
}

/** Posts a guard to a site (or moves them). One post per guard. */
export async function savePosting(input: {
  guardId: string;
  siteId: string;
  starts: string;
  ends: string;
  days: number[];
}): Promise<RosterResult> {
  let session;
  try {
    session = await staff();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const starts = parseTime(input.starts);
  const ends = parseTime(input.ends);
  const days = [...new Set(input.days)].filter((d) => d >= 1 && d <= 7);
  if (!input.guardId || !input.siteId) return { ok: false, error: "Choose a guard and a site." };
  if (!starts || !ends) return { ok: false, error: "Give the shift a start and an end time." };
  if (starts === ends) return { ok: false, error: "The shift has to be longer than no time at all." };
  if (days.length === 0) return { ok: false, error: "Pick at least one day of the week." };

  const supabase = await supabaseServer();
  const { data: guard } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", input.guardId)
    .maybeSingle();
  if (!guard || guard.role !== "guard" || !guard.active) return { ok: false, error: "Only an active guard can be posted." };

  const { data: existing } = await supabase
    .from("site_postings")
    .select("id")
    .eq("guard_id", input.guardId)
    .eq("active", true)
    .maybeSingle();

  const row = { site_id: input.siteId, starts, ends, days };
  const { error } = existing
    ? await supabase.from("site_postings").update(row).eq("id", existing.id)
    : await supabase
        .from("site_postings")
        .insert({ ...row, guard_id: input.guardId, created_by: session.realProfile.id });
  if (error) return { ok: false, error: error.message };

  await audit({
    actor: session.realProfile,
    action: existing ? "posting_moved" : "posting_created",
    entity: "profiles",
    entityId: input.guardId,
    detail: { site_id: input.siteId, starts, ends, days },
  });
  done();
  return { ok: true, note: `${guard.full_name} ${existing ? "moved" : "posted"}` };
}

/** Takes a guard off their post. Their future posted shifts are withdrawn. */
export async function endPosting(guardId: string): Promise<RosterResult> {
  let session;
  try {
    session = await staff();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.from("site_postings").update({ active: false }).eq("guard_id", guardId).eq("active", true);
  if (error) return { ok: false, error: error.message };
  await audit({ actor: session.realProfile, action: "posting_ended", entity: "profiles", entityId: guardId });
  done();
  return { ok: true };
}

/** How many guards a site needs on duty at once. */
export async function setHeadcount(siteId: string, required: number | null): Promise<RosterResult> {
  let session;
  try {
    session = await staff();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (required !== null && (!Number.isInteger(required) || required < 1 || required > 500)) {
    return { ok: false, error: "A site needs between 1 and 500 guards." };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.from("sites").update({ guards_required: required }).eq("id", siteId);
  if (error) return { ok: false, error: error.message };
  await audit({ actor: session.realProfile, action: "headcount_set", entity: "sites", entityId: siteId, detail: { required } });
  done();
  return { ok: true };
}

/** A one-off shift — cover for someone off sick, an extra guard for an event. */
export async function addShift(input: {
  guardId: string;
  siteId: string;
  date: string;
  starts: string;
  ends: string;
}): Promise<RosterResult> {
  let session;
  try {
    session = await staff();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const starts = parseTime(input.starts);
  const ends = parseTime(input.ends);
  if (!input.guardId || !input.siteId || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !starts || !ends) {
    return { ok: false, error: "Choose a guard, a site, a date and the times." };
  }
  const from = istInstant(input.date, starts);
  let to = istInstant(input.date, ends);
  if (to <= from) to = new Date(to.getTime() + 86_400_000);

  const supabase = await supabaseServer();
  const { error } = await supabase.from("shifts").insert({
    guard_id: input.guardId,
    site_id: input.siteId,
    starts_at: from.toISOString(),
    ends_at: to.toISOString(),
    notes: "Cover shift",
    created_by: session.realProfile.id,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("shifts_no_overlap")
        ? "That guard already has a shift in those hours."
        : error.message,
    };
  }
  await audit({
    actor: session.realProfile,
    action: "shift_added",
    entity: "sites",
    entityId: input.siteId,
    detail: { guard_id: input.guardId, starts_at: from.toISOString(), ends_at: to.toISOString() },
  });
  done();
  return { ok: true };
}

export async function cancelShift(shiftId: string): Promise<RosterResult> {
  let session;
  try {
    session = await staff();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("shifts")
    .update({ status: "cancelled" })
    .eq("id", shiftId)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Only a shift that has not started can be cancelled." };
  await audit({ actor: session.realProfile, action: "shift_cancelled", entity: "shifts", entityId: shiftId });
  done();
  return { ok: true };
}

/** Approves an off-roster check-in as the swap it was. */
export async function approveOffRoster(attendanceId: string): Promise<RosterResult> {
  let session;
  try {
    session = await staff();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("attendance")
    .update({
      status: "present",
      reviewed_by: session.realProfile.id,
      reviewed_at: new Date().toISOString(),
      review_note: "Off-roster check-in approved as a cover.",
    })
    .eq("id", attendanceId)
    .eq("off_roster", true);
  if (error) return { ok: false, error: error.message };
  await audit({ actor: session.realProfile, action: "off_roster_approved", entity: "attendance", entityId: attendanceId });
  done(["/console/attendance"]);
  return { ok: true };
}
