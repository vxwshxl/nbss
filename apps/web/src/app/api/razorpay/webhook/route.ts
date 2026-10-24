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
  // Live and test mode each have their own webhook in Razorpay, each with its own secret.
  const secrets = [process.env.RAZORPAY_WEBHOOK_SECRET, process.env.RAZORPAY_TEST_WEBHOOK_SECRET].filter((x): x is string => !!x);
  if (secrets.length === 0) return NextResponse.json({ ok: false }, { status: 503 });
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!secrets.some((s) => webhookSignatureValid(raw, signature, s))) {
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
