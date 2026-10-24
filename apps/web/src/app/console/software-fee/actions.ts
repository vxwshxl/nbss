"use server";

import { revalidatePath } from "next/cache";

import { currentSession } from "@/lib/auth";
import { markFeePaid } from "@/lib/billing/fee";
import { checkoutSignatureValid, createOrder, razorpayConfigured, razorpayKeyId } from "@/lib/billing/razorpay";
import { supabaseAdmin } from "@/lib/supabase/server";

type Start =
  | { ok: true; orderId: string; keyId: string; amountPaise: number; number: string; prefill: { name: string; email: string; contact: string } }
  | { ok: false; error: string };

async function payer() {
  const session = await currentSession();
  const role = session?.realProfile.role;
  return session && (role === "admin" || role === "developer") ? session : null;
}

/** Opens a Razorpay order for one unpaid month. Admins and developers. */
export async function startFeePayment(invoiceId: string): Promise<Start> {
  const session = await payer();
  if (!session) return { ok: false, error: "Only an administrator can pay the software fee." };
  const db = supabaseAdmin();
  const { data: inv } = await db.from("software_fee_invoices").select("id, number, period, total_paise, status, is_test").eq("id", invoiceId).maybeSingle();
  if (!inv) return { ok: false, error: "That invoice was not found." };
  if (!razorpayConfigured()) {
    return { ok: false, error: "Online payment is not set up on the server yet." };
  }
  if (inv.status === "paid") return { ok: false, error: "This month is already paid." };
  if (inv.total_paise < 100) return { ok: false, error: "Nothing to pay for this month." };
  const order = await createOrder({
    amountPaise: inv.total_paise,
    receipt: inv.number,
    notes: { kind: "nbss_software_fee", invoice_id: inv.id, period: inv.period, side: inv.is_test ? "test" : "live" },
  });
  if ("error" in order) return { ok: false, error: order.error };
  await db.from("software_fee_invoices").update({ razorpay_order_id: order.id }).eq("id", inv.id);
  const p = session.realProfile;
  return {
    ok: true,
    orderId: order.id,
    keyId: razorpayKeyId(),
    amountPaise: inv.total_paise,
    number: inv.number,
    prefill: { name: p.full_name, email: p.email ?? "", contact: p.phone ?? "" },
  };
}

/** The checkout came back: check Razorpay's signature, then record the payment. */
export async function verifyFeePayment(input: { invoiceId: string; orderId: string; paymentId: string; signature: string }): Promise<{ ok: boolean; error?: string }> {
  const session = await payer();
  if (!session) return { ok: false, error: "Not allowed." };
  const { data: inv } = await supabaseAdmin().from("software_fee_invoices").select("is_test").eq("id", input.invoiceId).maybeSingle();
  if (!inv || !checkoutSignatureValid(input.orderId, input.paymentId, input.signature)) return { ok: false, error: "The payment could not be verified." };
  const r = await markFeePaid({ invoiceId: input.invoiceId, orderId: input.orderId, paymentId: input.paymentId, by: session.realProfile.id });
  revalidatePath("/console/software-fee");
  return r.ok ? { ok: true } : { ok: false, error: "Paid, but it could not be recorded yet. It will be picked up shortly." };
}

/** The rate and GST. Developers only; applies to this month if unpaid and every month after. */
export async function saveFeeSettings(input: { perGuardRupees: number; gstPercent: number }): Promise<{ ok: boolean; error?: string }> {
  const session = await currentSession();
  if (session?.realProfile.role !== "developer") return { ok: false, error: "Only a developer can change the fee." };
  const paise = Math.round(Number(input.perGuardRupees) * 100);
  const gst = Number(input.gstPercent);
  if (!Number.isFinite(paise) || paise < 0 || paise > 1_000_000) return { ok: false, error: "Enter a rate between ₹0 and ₹10,000." };
  if (!Number.isFinite(gst) || gst < 0 || gst > 50) return { ok: false, error: "GST must be between 0 and 50%." };
  const { error } = await supabaseAdmin()
    .from("software_fee_settings")
    .update({ per_guard_paise: paise, gst_percent: gst, updated_at: new Date().toISOString(), updated_by: session.realProfile.id })
    .eq("id", true);
  revalidatePath("/console/software-fee");
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Skip a month (a free or trial month), or bring a skipped one back. Developers only. */
export async function setFeeSkipped(invoiceId: string, skip: boolean, note?: string): Promise<{ ok: boolean; error?: string }> {
  const session = await currentSession();
  if (session?.realProfile.role !== "developer") return { ok: false, error: "Only a developer can skip a month." };
  const { error } = await supabaseAdmin()
    .from("software_fee_invoices")
    .update({ status: skip ? "skipped" : "unpaid", skip_note: skip ? (note?.trim() || "Free month") : null, updated_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .neq("status", "paid");
  revalidatePath("/console/software-fee");
  return error ? { ok: false, error: error.message } : { ok: true };
}
