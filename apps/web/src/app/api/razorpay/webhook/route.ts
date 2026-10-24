import { NextResponse, type NextRequest } from "next/server";

import { markFeePaid } from "@/lib/billing/fee";
import { webhookSignatureValid } from "@/lib/billing/razorpay";

/**
 * Razorpay's webhook: records a software fee payment even when the browser closed
 * before the checkout could confirm it. Signed with RAZORPAY_WEBHOOK_SECRET; anything
 * not fully recorded answers 500 so Razorpay retries (recording is idempotent).
 * Configure in Razorpay → Settings → Webhooks: this URL, event payment.captured.
 */
export async function POST(req: NextRequest) {
  // One webhook (live keys) for both sides; the order's notes say which side it was.
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 });
  const raw = await req.text();
  if (!webhookSignatureValid(raw, req.headers.get("x-razorpay-signature") ?? "", secret)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  let event: { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; notes?: Record<string, string> } } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (event.event === "payment.captured") {
    const e = event.payload?.payment?.entity;
    if (e?.notes?.kind === "nbss_software_fee" && e.id && (e.notes.invoice_id || e.notes.period)) {
      const r = await markFeePaid({ invoiceId: e.notes.invoice_id, period: e.notes.period, test: e.notes.side === "test", orderId: e.order_id, paymentId: e.id });
      if (!r.ok) return NextResponse.json({ ok: false, retry: true }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
