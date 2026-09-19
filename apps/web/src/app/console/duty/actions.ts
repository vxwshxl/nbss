"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { audit, requireSession } from "@/lib/auth";
import { assertCanWrite } from "@/lib/impersonation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

import type { PunchState } from "./punch-state";

/**
 * Check-in and check-out.
 *
 * The single rule this whole system rests on: the SERVER decides whether a
 * guard is at their site. The browser reports a coordinate and an accuracy —
 * both attacker-controlled — and everything that follows is computed here from
 * the site's own record and the server's own clock.
 *
 * In particular:
 *
 *   · the distance is recomputed in Postgres by `site_fence_check`, never
 *     taken from the request;
 *   · the timestamp is `now()` in the database, never the device's clock,
 *     which is stored separately as evidence and otherwise ignored;
 *   · a fix too imprecise to place someone inside the fence is refused
 *     outright rather than accepted as close enough — a ±2 km reading that
 *     happens to centre on the gate proves nothing.
 */

type Coords = {
  lat: number;
  lng: number;
  accuracy: number;
  deviceTime?: string;
};

function readCoords(data: FormData): Coords | null {
  const lat = Number(data.get("lat"));
  const lng = Number(data.get("lng"));
  const accuracy = Number(data.get("accuracy"));

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  if (!Number.isFinite(accuracy) || accuracy < 0) return null;

  const deviceTime = data.get("device_time");
  return {
    lat,
    lng,
    accuracy,
    deviceTime: typeof deviceTime === "string" && deviceTime ? deviceTime : undefined,
  };
}

export async function checkIn(_prev: PunchState, data: FormData): Promise<PunchState> {
  const session = await requireSession();
  const profile = session.profile;

  // A punch is evidence that a particular person stood at a particular gate.
  // An administrator viewing as a guard must never be able to manufacture one.
  try {
    assertCanWrite(session, "attendance");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not permitted." };
  }

  if (profile.role !== "guard") {
    return { ok: false, error: "Only a guard checks in. Supervisors record attendance for others." };
  }

  const coords = readCoords(data);
  if (!coords) {
    return { ok: false, error: "Your location could not be read. Try again with GPS switched on." };
  }

  const siteId = String(data.get("site_id") ?? "");
  if (!siteId) return { ok: false, error: "Choose the site you are reporting to." };

  const supabase = await supabaseServer();

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id, name, geofence_radius_m, max_accuracy_m, grace_minutes, shift_start, active")
    .eq("id", siteId)
    .single();

  if (siteError || !site) return { ok: false, error: "That site is not on the register." };
  if (!site.active) return { ok: false, error: `${site.name} is not in service.` };

  // A reading whose error radius is larger than the site allows cannot place
  // anyone anywhere. Refused before the fence is even consulted.
  if (coords.accuracy > site.max_accuracy_m) {
    return {
      ok: false,
      error: `Your position is only accurate to ±${Math.round(coords.accuracy)} m, and ${site.name} needs ±${site.max_accuracy_m} m or better. Step into the open and wait a moment for a stronger fix.`,
    };
  }

  // The fence test itself, in the database, against the site's own record.
  const { data: fence, error: fenceError } = await supabase
    .rpc("site_fence_check", { p_site_id: siteId, p_lat: coords.lat, p_lng: coords.lng })
    .single();

  if (fenceError || !fence) return { ok: false, error: "The boundary check failed. Try again." };

  const distance = Math.round(fence.distance_m);

  if (!fence.inside) {
    // Refusals are logged too. A guard repeatedly punching from 3 km away is
    // something a supervisor should be able to see.
    await audit({
      actor: profile,
      action: "check_in_refused",
      entity: "sites",
      entityId: siteId,
      detail: { distance_m: distance, accuracy_m: Math.round(coords.accuracy) },
    });

    return {
      ok: false,
      error: `You are ${distance} m from ${site.name}, outside its ${site.geofence_radius_m} m boundary. Check in once you are at the gate.`,
      distance,
    };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  // Lateness is measured against the site's shift start plus its grace period.
  // Being late never blocks the punch — it marks it, because a guard who is
  // twenty minutes late is still on duty and still owed those hours.
  let status: "present" | "late" = "present";
  if (site.shift_start) {
    const [hh, mm] = site.shift_start.split(":").map(Number);
    if (Number.isFinite(hh) && Number.isFinite(mm)) {
      const now = new Date();
      const due = new Date(now);
      due.setHours(hh!, mm! + (site.grace_minutes ?? 0), 0, 0);
      if (now > due) status = "late";
    }
  }

  const { error: insertError } = await supabase.from("attendance").insert({
    guard_id: profile.id,
    site_id: siteId,
    check_in_at: new Date().toISOString(),
    check_in_lat: coords.lat,
    check_in_lng: coords.lng,
    check_in_accuracy_m: coords.accuracy,
    check_in_distance_m: fence.distance_m,
    check_in_method: "geofence",
    status,
    device_reported_at: coords.deviceTime ?? null,
    ip,
    user_agent: h.get("user-agent"),
  });

  if (insertError) {
    // The partial unique index on an open punch is what produces this. Saying
    // so plainly beats surfacing a constraint name.
    if (insertError.code === "23505") {
      return { ok: false, error: "You are already checked in. Check out before starting a new shift." };
    }
    return { ok: false, error: insertError.message };
  }

  await audit({
    actor: profile,
    action: "check_in",
    entity: "sites",
    entityId: siteId,
    detail: { distance_m: distance, accuracy_m: Math.round(coords.accuracy), status },
    ip,
  });

  revalidatePath("/console/duty");
  revalidatePath("/console");

  return {
    ok: true,
    distance,
    message:
      status === "late"
        ? `Checked in at ${site.name}, ${distance} m from the centre. Marked late.`
        : `Checked in at ${site.name}, ${distance} m from the centre.`,
  };
}

export async function checkOut(_prev: PunchState, data: FormData): Promise<PunchState> {
  const session = await requireSession();
  const profile = session.profile;

  try {
    assertCanWrite(session, "attendance");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not permitted." };
  }

  if (profile.role !== "guard") return { ok: false, error: "Only a guard checks out." };

  const coords = readCoords(data);
  if (!coords) {
    return { ok: false, error: "Your location could not be read. Try again with GPS switched on." };
  }

  const supabase = await supabaseServer();

  const { data: open } = await supabase
    .from("attendance")
    .select("id, site_id, sites(name)")
    .eq("guard_id", profile.id)
    .is("check_out_at", null)
    .maybeSingle();

  if (!open) return { ok: false, error: "You are not checked in." };

  const place = Array.isArray(open.sites) ? open.sites[0] : open.sites;

  // Distance is recorded on the way out too, but never used to refuse: a guard
  // whose shift has ended must always be able to close it. Leaving early shows
  // up as an unusual check-out distance for a supervisor to ask about, which
  // is the right way to handle it — a refusal would just strand them on shift.
  const { data: fence } = await supabase
    .rpc("site_fence_check", { p_site_id: open.site_id, p_lat: coords.lat, p_lng: coords.lng })
    .single();

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { error } = await supabase
    .from("attendance")
    .update({
      check_out_at: new Date().toISOString(),
      check_out_lat: coords.lat,
      check_out_lng: coords.lng,
      check_out_accuracy_m: coords.accuracy,
      check_out_distance_m: fence?.distance_m ?? null,
      check_out_method: "geofence",
    })
    .eq("id", open.id);

  if (error) return { ok: false, error: error.message };

  // worked_minutes and overtime_minutes are filled in by the database trigger
  // on this update, so they are read back rather than computed here.
  const { data: closed } = await supabaseAdmin()
    .from("attendance")
    .select("worked_minutes, overtime_minutes")
    .eq("id", open.id)
    .single();

  await audit({
    actor: profile,
    action: "check_out",
    entity: "sites",
    entityId: open.site_id,
    detail: {
      worked_minutes: closed?.worked_minutes ?? null,
      overtime_minutes: closed?.overtime_minutes ?? null,
    },
    ip,
  });

  revalidatePath("/console/duty");
  revalidatePath("/console");

  const worked = closed?.worked_minutes ?? 0;
  const h1 = Math.floor(worked / 60);
  const m1 = worked % 60;

  return {
    ok: true,
    message: `Checked out of ${place?.name ?? "your site"}. ${h1}h ${String(m1).padStart(2, "0")}m recorded${
      closed?.overtime_minutes ? `, including ${closed.overtime_minutes} min overtime` : ""
    }.`,
  };
}
