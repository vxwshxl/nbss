import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The signature on an SOS map link, so the picture of where a guard was can be
 * fetched only from the email it was sent in, not by guessing ids. The worker
 * (scripts/email-templates.mjs) signs with the same secret and formula.
 */
export function sosMapSig(alertId: string): string {
  const secret = process.env.SUPABASE_SECRET_KEY ?? "";
  return createHmac("sha256", secret).update(`sos-map:${alertId}`).digest("hex").slice(0, 24);
}

export function validSosMapSig(alertId: string, sig: string | null): boolean {
  if (!sig || sig.length !== 24) return false;
  const want = Buffer.from(sosMapSig(alertId));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
