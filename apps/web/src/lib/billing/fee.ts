import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";

/** Marks an invoice paid. Idempotent: a payment already recorded is not recorded twice. */
export async function markFeePaid(input: { invoiceId?: string; period?: string; orderId?: string | null; paymentId: string; by?: string | null }): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  const { data: done } = await db.from("software_fee_invoices").select("id").eq("razorpay_payment_id", input.paymentId).maybeSingle();
  if (done) return { ok: true };
  let q = db
    .from("software_fee_invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_by: input.by ?? null,
      razorpay_payment_id: input.paymentId,
      ...(input.orderId ? { razorpay_order_id: input.orderId } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("status", "unpaid");
  q = input.invoiceId ? q.eq("id", input.invoiceId) : q.eq("period", input.period!);
  const { error } = await q;
  return { ok: !error };
}
