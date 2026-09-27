"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { isValidPhone } from "@nbss/shared/identity";

import { audit, requireRoleSession } from "@/lib/auth";
import { SERVICE_OPTIONS } from "@/lib/bookings";
import { districtOptions } from "@/content/site";
import { supabaseServer } from "@/lib/supabase/server";

import type { BookingFormState } from "./state";

const SHIFTS = new Set(["24x7", "day", "night", "custom"]);

/**
 * A client asks for guards.
 *
 * Runs as the client, through `submit_service_request`, which takes the client
 * id from the session — never from this form — and applies its own flood
 * limit. What is checked here is only what makes a request answerable.
 */
export async function submitBooking(_prev: BookingFormState, data: FormData): Promise<BookingFormState> {
  const session = await requireRoleSession("client");
  if (session.impersonating) {
    return { ok: false, error: "You are viewing as this client — bookings can only be made by the client." };
  }

  const text = (k: string) => String(data.get(k) ?? "").trim();
  const service = text("service");
  const contactName = text("contact_name");
  const phone = text("phone");
  const district = text("district");
  const shift = text("shift_pattern");
  const guards = Number(text("guards_required") || 0);
  const start = text("start_date");
  const months = Number(text("duration_months") || 0);

  if (!SERVICE_OPTIONS.some((s) => s.value === service)) return { ok: false, error: "Choose which service you need." };
  if (!contactName) return { ok: false, error: "Enter a contact name." };
  if (!isValidPhone(phone)) return { ok: false, error: "Enter a 10-digit mobile number for the deployment desk." };
  if (!district || !districtOptions.includes(district)) return { ok: false, error: "Choose the district." };
  if (text("site_type").length < 2) return { ok: false, error: "Describe the site — for example “Rice mill, 4 acres”." };
  if (text("guards_required") && (!Number.isInteger(guards) || guards < 1 || guards > 2000)) {
    return { ok: false, error: "Guards needed should be a whole number between 1 and 2000." };
  }
  if (shift && !SHIFTS.has(shift)) return { ok: false, error: "Choose a shift pattern." };
  if (start && Number.isNaN(Date.parse(start))) return { ok: false, error: "That start date does not look right." };

  const supabase = await supabaseServer();
  const h = await headers();
  const { data: result, error } = await supabase.rpc("submit_service_request", {
    p_service_type: service,
    p_contact_name: contactName,
    p_phone: phone,
    p_email: session.profile.email ?? undefined,
    p_organisation: text("organisation") || undefined,
    p_site_type: text("site_type"),
    p_district: district,
    p_address: text("address") || undefined,
    p_guards_required: guards || undefined,
    p_shift_pattern: shift || undefined,
    p_start_date: start || undefined,
    p_duration_months: months > 0 ? months : undefined,
    p_notes: text("notes") || undefined,
    p_source: "web",
  });

  if (error) return { ok: false, error: error.message };

  const reference = (result as { reference?: string } | null)?.reference;
  await audit({
    actor: session.profile,
    action: "booking_requested",
    entity: "service_requests",
    entityId: (result as { id?: string } | null)?.id,
    detail: { reference, service },
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  revalidatePath("/console/book");
  return { ok: true, reference };
}

export async function withdrawBooking(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireRoleSession("client");
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("withdraw_service_request", { p_id: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/console/book");
  return { ok: true };
}
