import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay, for the software fee only: create an order, check a checkout's signature,
 * check a webhook's signature. The keys live in the server's env (RAZORPAY_KEY_ID,
 * RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET); nothing secret reaches the browser.
 */

export function razorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function razorpayKeyId(): string {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID ?? "";
}

export async function createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<{ id: string } | { error: string }> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
    body: JSON.stringify({ amount: input.amountPaise, currency: "INR", receipt: input.receipt.slice(0, 40), notes: input.notes }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { description?: string } };
  return data.id ? { id: data.id } : { error: data.error?.description ?? "Razorpay could not create the order." };
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The checkout's own proof: HMAC-SHA256 of "order_id|payment_id" with the key secret. */
export function checkoutSignatureValid(orderId: string, paymentId: string, signature: string): boolean {
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "").update(`${orderId}|${paymentId}`).digest("hex");
  return same(expected, signature);
}

/** A webhook's proof: HMAC-SHA256 of the raw body with the webhook secret. */
export function webhookSignatureValid(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return same(expected, signature);
}
