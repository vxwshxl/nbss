import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay, for the software fee only: create an order, check a checkout's signature,
 * check a webhook's signature. The keys live in the server's env (RAZORPAY_KEY_ID,
 * RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET); nothing secret reaches the browser.
 */

/**
 * Two key pairs: live (RAZORPAY_KEY_ID / _SECRET, real money) for live invoices, and
 * Razorpay's test keys (RAZORPAY_TEST_KEY_ID / _SECRET, no money moves) for invoices on
 * the Test side. A test invoice is never paid with live keys.
 */
function keys(test: boolean): { id: string; secret: string } {
  return test
    ? { id: process.env.RAZORPAY_TEST_KEY_ID ?? "", secret: process.env.RAZORPAY_TEST_KEY_SECRET ?? "" }
    : { id: process.env.RAZORPAY_KEY_ID ?? "", secret: process.env.RAZORPAY_KEY_SECRET ?? "" };
}

export function razorpayConfigured(test = false): boolean {
  const k = keys(test);
  return Boolean(k.id && k.secret);
}

export function razorpayKeyId(test = false): string {
  return keys(test).id;
}

export async function createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string>; test?: boolean }): Promise<{ id: string } | { error: string }> {
  const k = keys(!!input.test);
  const auth = Buffer.from(`${k.id}:${k.secret}`).toString("base64");
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
export function checkoutSignatureValid(orderId: string, paymentId: string, signature: string, test = false): boolean {
  const expected = createHmac("sha256", keys(test).secret).update(`${orderId}|${paymentId}`).digest("hex");
  return same(expected, signature);
}

/** A webhook's proof: HMAC-SHA256 of the raw body with the webhook secret. */
export function webhookSignatureValid(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return same(expected, signature);
}
