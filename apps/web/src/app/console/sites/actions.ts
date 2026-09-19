"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { audit, requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

import type { SiteFormState } from "./site-form-state";

/**
 * Creates a site and the fence around it.
 *
 * Coordinates are validated here rather than trusted from the form: a site
 * saved at a wrong latitude is not a cosmetic error, it is a fence in the
 * wrong place, and every check-in against it afterwards is meaningless.
 */
export async function createSite(
  _prev: SiteFormState,
  data: FormData,
): Promise<SiteFormState> {
  const profile = await requireRole("admin");

  const name = String(data.get("name") ?? "").trim();
  const clientName = String(data.get("client_name") ?? "").trim();
  const address = String(data.get("address") ?? "").trim();
  const district = String(data.get("district") ?? "").trim();

  const lat = Number(data.get("lat"));
  const lng = Number(data.get("lng"));
  const radius = Number(data.get("geofence_radius_m"));
  const accuracy = Number(data.get("max_accuracy_m"));
  const grace = Number(data.get("grace_minutes"));
  const standard = Number(data.get("standard_shift_minutes"));

  const shiftStart = String(data.get("shift_start") ?? "").trim();
  const shiftEnd = String(data.get("shift_end") ?? "").trim();
  const rawPolygon = String(data.get("polygon") ?? "").trim();

  const values = {
    name,
    client_name: clientName,
    address,
    district,
    lat: data.get("lat") ? String(data.get("lat")) : "",
    lng: data.get("lng") ? String(data.get("lng")) : "",
    geofence_radius_m: String(radius || 150),
    max_accuracy_m: String(accuracy || 100),
    grace_minutes: String(Number.isFinite(grace) ? grace : 10),
    standard_shift_minutes: String(standard || 480),
    shift_start: shiftStart,
    shift_end: shiftEnd,
  };

  const fail = (error: string): SiteFormState => ({ ok: false, values, error });

  if (!name) return fail("Give the site a name.");

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return fail("Latitude must be a number between −90 and 90.");
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return fail("Longitude must be a number between −180 and 180.");
  }

  // 0,0 is in the Gulf of Guinea. It is what an empty form and a failed parse
  // both produce, so it is almost always a mistake rather than a site.
  if (lat === 0 && lng === 0) {
    return fail("Those coordinates are in the Atlantic Ocean. Check the pin.");
  }

  /**
   * A drawn boundary. Re-validated here rather than trusted from the form: it
   * arrives as a JSON string a client composed, and `point_in_ring` will be
   * asked to decide whether people are at work based on it.
   */
  let polygon: [number, number][] | null = null;

  if (rawPolygon) {
    try {
      const parsed: unknown = JSON.parse(rawPolygon);
      const ok =
        Array.isArray(parsed) &&
        parsed.length >= 3 &&
        parsed.length <= 500 &&
        parsed.every(
          (pt): pt is [number, number] =>
            Array.isArray(pt) &&
            pt.length === 2 &&
            Number.isFinite(pt[0]) &&
            Number.isFinite(pt[1]) &&
            (pt[0] as number) >= -180 &&
            (pt[0] as number) <= 180 &&
            (pt[1] as number) >= -90 &&
            (pt[1] as number) <= 90,
        );

      if (!ok) return fail("That boundary is not a usable shape. Redraw it with at least three points.");
      polygon = parsed as [number, number][];
    } catch {
      return fail("That boundary could not be read. Redraw it.");
    }
  }

  // The radius still has to be sane even when a polygon supersedes it: it is
  // what the record falls back to if the drawn shape is ever cleared.
  if (!Number.isFinite(radius) || radius < 25 || radius > 5000) {
    return fail("The fence radius must be between 25 m and 5000 m.");
  }
  if (!Number.isFinite(accuracy) || accuracy < 10 || accuracy > 1000) {
    return fail("Required GPS accuracy must be between 10 m and 1000 m.");
  }

  const supabase = await supabaseServer();

  const { data: created, error } = await supabase
    .from("sites")
    .insert({
      name,
      client_name: clientName || null,
      address: address || null,
      district: district || null,
      lat,
      lng,
      geofence_radius_m: Math.round(radius),
      polygon: polygon as never,
      max_accuracy_m: Math.round(accuracy),
      grace_minutes: Number.isFinite(grace) ? Math.round(grace) : 10,
      standard_shift_minutes: Number.isFinite(standard) ? Math.round(standard) : 480,
      shift_start: shiftStart || null,
      shift_end: shiftEnd || null,
    })
    .select("id")
    .single();

  if (error) return fail(error.message);

  const h = await headers();
  await audit({
    actor: profile,
    action: "site_created",
    entity: "sites",
    entityId: created.id,
    detail: { name, lat, lng, radius, shape: polygon ? `polygon:${polygon.length}` : "circle" },
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  revalidatePath("/console/sites");
  revalidatePath("/console");

  return { ok: true, values: null, created: name };
}

/** Takes a site out of service without deleting the attendance recorded at it. */
export async function setSiteActive(id: string, active: boolean): Promise<void> {
  const profile = await requireRole("admin");
  const supabase = await supabaseServer();

  const { error } = await supabase.from("sites").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);

  await audit({
    actor: profile,
    action: active ? "site_reactivated" : "site_deactivated",
    entity: "sites",
    entityId: id,
  });

  revalidatePath("/console/sites");
}
