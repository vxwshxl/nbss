"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth";
import { assertCanWrite } from "@/lib/impersonation";
import { supabaseServer } from "@/lib/supabase/server";

import type { PunchState } from "./punch-state";

/**
 * Check-in and check-out.
 *
 * Both are now one call each into `punch_in` / `punch_out` (0008_punch_rpc.sql).
 * Two reasons this is a thin wrapper rather than the implementation:
 *
 *   THE RULE HAS TO EXIST ONCE. The Expo app checks in too, and a guard at a gate
 *   must get the same verdict whichever thing is in their hand. A second copy of
 *   "is this fix accurate enough, is this inside the fence, is this late" would
 *   disagree with the first one within a month.
 *
 *   THE PREVIOUS VERSION DID NOT WORK. It inserted into `attendance` through
 *   `supabaseServer()` — the signed-in guard's session — and `attendance` carries
 *   only `attendance_staff_write (is_staff())`. Every guard check-in was refused
 *   with 42501. Switching to the admin client would have fixed it here and left the
 *   app with no route at all, so the write moved into a security-definer function
 *   instead, which both clients can reach and neither can bypass.
 *
 * What is left in this file is the part only a web request knows: the client IP and
 * user agent, read from the headers and passed down as forensic breadcrumbs.
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

async function requestMarkers(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  };
}

/**
 * The functions raise rather than return a failure, so that a refusal rolls back the
 * whole attempt. PostgREST surfaces the message; these are written to be read by a
 * guard at a gate, so they are passed through rather than replaced.
 */
function messageFor(error: { message: string; code?: string }): string {
  // A raise_exception or check_violation carries text meant for the person. Anything
  // else is a fault, and a Postgres internal is no use to anyone standing outside a
  // locked compound at midnight.
  if (error.code === "P0001" || error.code === "22023" || error.code === "42501") {
    return error.message;
  }
  return "Something went wrong recording that. Try once more, and tell your supervisor if it keeps failing.";
}

export async function checkIn(_prev: PunchState, data: FormData): Promise<PunchState> {
  const session = await requireSession();

  // A punch is evidence that a particular person stood at a particular gate. An
  // administrator viewing as a guard must never be able to manufacture one — and this
  // check has to stay here, because the database sees only the impersonated JWT and
  // cannot tell the difference.
  try {
    assertCanWrite(session, "attendance");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not permitted." };
  }

  const coords = readCoords(data);
  if (!coords) {
    return { ok: false, error: "Your location could not be read. Try again with GPS switched on." };
  }

  const siteId = String(data.get("site_id") ?? "");
  if (!siteId) return { ok: false, error: "Choose the site you are reporting to." };

  const { ip, userAgent } = await requestMarkers();
  const supabase = await supabaseServer();

  const { data: result, error } = await supabase.rpc("punch_in", {
    p_site_id: siteId,
    p_lat: coords.lat,
    p_lng: coords.lng,
    p_accuracy_m: coords.accuracy,
    p_device_reported_at: coords.deviceTime,
    p_ip: ip ?? undefined,
    p_user_agent: userAgent ?? undefined,
  });

  if (error) return { ok: false, error: messageFor(error) };

  const punch = (result ?? {}) as {
    site_name?: string;
    status?: string;
    distance_m?: number;
  };
  const distance = punch.distance_m ?? 0;

  revalidatePath("/console/duty");
  revalidatePath("/console");

  return {
    ok: true,
    distance,
    message:
      punch.status === "late"
        ? `Checked in at ${punch.site_name}, ${distance} m from the centre. Marked late.`
        : `Checked in at ${punch.site_name}, ${distance} m from the centre.`,
  };
}

export async function checkOut(_prev: PunchState, data: FormData): Promise<PunchState> {
  const session = await requireSession();

  try {
    assertCanWrite(session, "attendance");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not permitted." };
  }

  const coords = readCoords(data);
  if (!coords) {
    return { ok: false, error: "Your location could not be read. Try again with GPS switched on." };
  }

  const { ip } = await requestMarkers();
  const supabase = await supabaseServer();

  const { data: result, error } = await supabase.rpc("punch_out", {
    p_lat: coords.lat,
    p_lng: coords.lng,
    p_accuracy_m: coords.accuracy,
    p_device_reported_at: coords.deviceTime,
    p_ip: ip ?? undefined,
  });

  if (error) return { ok: false, error: messageFor(error) };

  const punch = (result ?? {}) as {
    site_name?: string;
    worked_minutes?: number;
    overtime_minutes?: number;
  };

  // worked_minutes and overtime_minutes are computed by the trigger on the update and
  // returned from it, so they are read rather than recalculated here.
  const worked = punch.worked_minutes ?? 0;
  const hours = Math.floor(worked / 60);
  const minutes = worked % 60;

  revalidatePath("/console/duty");
  revalidatePath("/console");

  return {
    ok: true,
    message: `Checked out of ${punch.site_name ?? "your site"}. ${hours}h ${String(minutes).padStart(2, "0")}m recorded${
      punch.overtime_minutes ? `, including ${punch.overtime_minutes} min overtime` : ""
    }.`,
  };
}
