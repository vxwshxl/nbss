"use server";

import { revalidatePath } from "next/cache";

import { shiftTypeFor } from "@nbss/shared/shifts";

import { audit, requireRoleSession } from "@/lib/auth";
import { istDay, istInstant, parseTime } from "@/lib/roster";
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

/**
 * Posts a guard to a site. Weekly (no dates): the window on the chosen weekdays,
 * every week, and a guard has one such post, so saving again moves them. Dated:
 * the window on exactly the chosen dates; a guard may hold any number of these,
 * and `postingId` edits one in place.
 */
export async function savePosting(input: {
  guardId: string;
  siteId: string;
  starts: string;
  ends: string;
  days: number[];
  dates?: string[] | null;
  postingId?: string | null;
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
  const dated = Array.isArray(input.dates);
  const yesterday = istDay(-1);
  const dates = dated ? [...new Set(input.dates)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= yesterday).sort() : null;
  if (!input.guardId || !input.siteId) return { ok: false, error: "Choose a guard and a site." };
  if (!starts || !ends) return { ok: false, error: "Give the shift a start and an end time." };
  // Equal start and end is the 24-hour shift: it runs to the same time the next day.
  if (!dated && days.length === 0) return { ok: false, error: "Pick at least one day of the week." };
  if (dates && dates.length === 0) return { ok: false, error: "Pick at least one date from today on." };
  if (dates && dates.length > 366) return { ok: false, error: "A dated post can cover up to a year of dates." };

  const supabase = await supabaseServer();
  const { data: guard } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", input.guardId)
    .maybeSingle();
  if (!guard || guard.role !== "guard" || !guard.active) return { ok: false, error: "Only an active guard can be posted." };

  let existing: { id: string } | null = null;
  if (dates) {
    if (input.postingId) {
      const { data } = await supabase
        .from("site_postings")
        .select("id")
        .eq("id", input.postingId)
        .eq("active", true)
        .not("dates", "is", null)
        .maybeSingle();
      existing = data;
    }
  } else {
    const { data } = await supabase
      .from("site_postings")
      .select("id")
      .eq("guard_id", input.guardId)
      .eq("active", true)
      .is("dates", null)
      .maybeSingle();
    existing = data;
  }

  // One guard, one place at a time: the same guard at another site is fine at other
  // hours (A 8–12, B 1–4), never at overlapping ones.
  const { data: others } = await supabase
    .from("site_postings")
    .select("id, starts, ends, days, dates, sites(name)")
    .eq("guard_id", input.guardId)
    .eq("active", true);
  const clash = (others ?? [])
    .filter((o) => o.id !== existing?.id && o.id !== input.postingId)
    .find((o) => postingsOverlap({ starts, ends, days, dates }, { starts: o.starts, ends: o.ends, days: o.days, dates: o.dates }));
  if (clash) {
    const where = (Array.isArray(clash.sites) ? clash.sites[0] : clash.sites) as { name: string } | null;
    return {
      ok: false,
      error: `${guard.full_name} is already posted at ${where?.name ?? "another site"} ${clockLabel(clash.starts)}–${clockLabel(clash.ends)} at those times. Choose hours that do not overlap.`,
    };
  }

  const row = {
    site_id: input.siteId,
    guard_id: input.guardId,
    starts,
    ends,
    days: dates ? [1, 2, 3, 4, 5, 6, 7] : days,
    dates,
    shift_type: shiftTypeFor(starts, ends),
  };
  const { error } = existing
    ? await supabase.from("site_postings").update(row).eq("id", existing.id)
    : await supabase.from("site_postings").insert({ ...row, created_by: session.realProfile.id });
  if (error) return { ok: false, error: error.message };

  await audit({
    actor: session.realProfile,
    action: existing ? "posting_moved" : "posting_created",
    entity: "profiles",
    entityId: input.guardId,
    detail: { site_id: input.siteId, starts, ends, ...(dates ? { dates } : { days }) },
  });
  done();
  const what = dates ? `for ${dates.length} ${dates.length === 1 ? "date" : "dates"}` : existing ? "moved" : "posted";
  return { ok: true, note: `${guard.full_name} ${dates ? "posted " : ""}${what}` };
}

/** Ends one posting. Its future shifts are withdrawn; the guard's other posts stay. */
export async function endPosting(postingId: string): Promise<RosterResult> {
  let session;
  try {
    session = await staff();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("site_postings")
    .update({ active: false })
    .eq("id", postingId)
    .eq("active", true)
    .select("guard_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "That post has already ended." };
  await audit({ actor: session.realProfile, action: "posting_ended", entity: "profiles", entityId: data.guard_id, detail: { posting_id: postingId } });
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
    shift_type: shiftTypeFor(starts, ends),
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

/** "20:00:00" → "8:00 pm", for the overlap message. */
function clockLabel(t: string): string {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

type PostingTimes = { starts: string; ends: string; days: number[] | null; dates: string[] | null };

/**
 * Whether two postings put the guard in two places at once, on any day in the next
 * five weeks or up to the last dated day. Each is laid out as real intervals (an
 * overnight post runs into the next morning, a start equal to its end is 24 hours) and
 * any intersection is a clash.
 */
function postingsOverlap(a: PostingTimes, b: PostingTimes): boolean {
  const toMin = (t: string) => {
    const [h = 0, m = 0] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const today = new Date(`${istDay(0)}T00:00:00Z`);
  const last = [...(a.dates ?? []), ...(b.dates ?? [])].sort().pop();
  const horizon = Math.max(35, last ? Math.ceil((new Date(`${last}T00:00:00Z`).getTime() - today.getTime()) / 86_400_000) + 2 : 0);
  const intervals = (p: PostingTimes) => {
    const s = toMin(p.starts);
    let e = toMin(p.ends);
    if (e <= s) e += 1440;
    const out: [number, number][] = [];
    for (let d = -1; d <= horizon; d++) {
      const day = new Date(today.getTime() + d * 86_400_000);
      const iso = day.toISOString().slice(0, 10);
      const dow = ((day.getUTCDay() + 6) % 7) + 1; // 1 = Monday … 7 = Sunday
      const runs = p.dates ? p.dates.includes(iso) : (p.days ?? []).includes(dow);
      if (runs) out.push([d * 1440 + s, d * 1440 + e]);
    }
    return out;
  };
  const ia = intervals(a);
  const ib = intervals(b);
  return ia.some(([s1, e1]) => ib.some(([s2, e2]) => s1 < e2 && s2 < e1));
}
