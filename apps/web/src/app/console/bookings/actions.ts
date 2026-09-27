"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { audit, requireRoleSession } from "@/lib/auth";
import type { BookingStatus } from "@/lib/bookings";
import { supabaseServer } from "@/lib/supabase/server";

const STATUSES: BookingStatus[] = ["new", "reviewing", "quoted", "accepted", "declined", "converted"];

/**
 * The desk moves a booking along. Runs as the signed-in staff member, so the
 * `service_requests_staff_write` policy is what allows it. Marking a request
 * "guards deployed" links it to a site and hands that site to the client —
 * which is the moment their My site page starts showing who is on the gate.
 */
export async function updateBooking(
  id: string,
  input: { status: BookingStatus; quoteRupees?: string; quoteNote?: string; siteId?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireRoleSession("admin", "supervisor");
  if (!STATUSES.includes(input.status)) return { ok: false, error: "Unknown status." };

  const supabase = await supabaseServer();
  const { data: row } = await supabase
    .from("service_requests")
    .select("id, reference, client_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "That booking no longer exists." };

  const patch: Record<string, unknown> = {
    status: input.status,
    handled_by: session.realProfile.id,
    handled_at: new Date().toISOString(),
  };

  if (input.status === "quoted") {
    const rupees = Number((input.quoteRupees ?? "").replace(/[,\s₹]/g, ""));
    if (!Number.isFinite(rupees) || rupees <= 0) return { ok: false, error: "Enter the monthly quotation in rupees." };
    patch.quoted_amount_paise = Math.round(rupees * 100);
    patch.quote_note = input.quoteNote?.trim() || null;
  }

  if (input.status === "converted") {
    if (!input.siteId) return { ok: false, error: "Choose the site the guards are deployed to." };
    if (session.profile.role !== "admin") {
      return { ok: false, error: "Only an administrator can hand a site to a client." };
    }
    patch.site_id = input.siteId;
    if (row.client_id) {
      const { error } = await supabase.from("sites").update({ client_id: row.client_id }).eq("id", input.siteId);
      if (error) return { ok: false, error: error.message };
    }
  }

  const { error } = await supabase.from("service_requests").update(patch as never).eq("id", id);
  if (error) return { ok: false, error: error.message };

  const h = await headers();
  await audit({
    actor: session.realProfile,
    action: "booking_updated",
    entity: "service_requests",
    entityId: id,
    detail: { reference: row.reference, from: row.status, to: input.status },
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  revalidatePath("/console/bookings");
  return { ok: true };
}
