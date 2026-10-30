"use server";

import { revalidatePath } from "next/cache";

import { audit, requireRoleSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Deciding about guards' phones. A phone is approved, held (pending), or
 * blocked; approving one never touches the punches already made from it —
 * those are reviewed on their own, below, so the record says who looked.
 */

export type DeviceResult = { ok: true } | { ok: false; error: string };

async function staff() {
  const session = await requireRoleSession("admin", "supervisor");
  if (session.impersonating) throw new Error("Stop viewing as someone else to change this.");
  return session;
}

function done() {
  for (const p of ["/console/devices", "/console/live", "/console/attendance"]) revalidatePath(p);
}

export async function setDeviceStatus(id: string, status: "approved" | "pending" | "blocked"): Promise<DeviceResult> {
  let session;
  try {
    session = await staff();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("guard_devices")
    .update({
      status,
      approved_by: status === "approved" ? session.realProfile.id : null,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("profile_id, brand, model")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "That phone is no longer on the list." };
  await audit({
    actor: session.realProfile,
    action: `device_${status}`,
    entity: "guard_devices",
    entityId: id,
    detail: { profile_id: data.profile_id, model: [data.brand, data.model].filter(Boolean).join(" ") },
  });
  done();
  return { ok: true };
}

/** Forgets a phone. The next sign-in on it registers it again, as new. */
export async function removeDevice(id: string): Promise<DeviceResult> {
  let session;
  try {
    session = await staff();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.from("guard_devices").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await audit({ actor: session.realProfile, action: "device_removed", entity: "guard_devices", entityId: id });
  done();
  return { ok: true };
}

/** A check-in held because of the phone, accepted as genuine (or not). */
export async function reviewFlaggedPunch(attendanceId: string, accept: boolean): Promise<DeviceResult> {
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
      status: accept ? "present" : "rejected",
      reviewed_by: session.realProfile.id,
      reviewed_at: new Date().toISOString(),
      review_note: accept ? "Phone checked and accepted by a supervisor." : "Rejected: not checked in from the guard's own phone.",
    })
    .eq("id", attendanceId)
    .not("device_flag", "is", null);
  if (error) return { ok: false, error: error.message };
  await audit({
    actor: session.realProfile,
    action: accept ? "device_punch_accepted" : "device_punch_rejected",
    entity: "attendance",
    entityId: attendanceId,
  });
  done();
  return { ok: true };
}
