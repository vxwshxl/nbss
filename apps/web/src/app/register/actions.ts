"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isValidEmail, isValidPhone } from "@nbss/shared/identity";

import { audit } from "@/lib/auth";
import { safeFrom } from "@/app/login/state";
import {
  THROTTLED,
  clearFailures,
  isThrottled,
  recordFailure,
  startClientSignup,
  verifyEmailCode,
} from "@/lib/sign-in";
import { supabaseServer } from "@/lib/supabase/server";

import type { RegisterState } from "./state";

/**
 * A new client, in two steps: who they are, then the code mailed to prove the
 * address. There is no password to invent — they sign in the same way next
 * time, by code, and the session lasts a year.
 */
export async function registerAction(_prev: RegisterState, data: FormData): Promise<RegisterState> {
  const intent = String(data.get("intent") ?? "send");
  const from = safeFrom(String(data.get("from") ?? "")) || "/console/book";
  const values = {
    fullName: String(data.get("fullName") ?? "").trim(),
    organisation: String(data.get("organisation") ?? "").trim(),
    phone: String(data.get("phone") ?? "").trim(),
    email: String(data.get("email") ?? "").trim().toLowerCase(),
  };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `reg:${values.email}`;
  if (isThrottled(ip, key)) return { step: "details", values, error: THROTTLED };

  if (intent === "verify") {
    const supabase = await supabaseServer();
    const result = await verifyEmailCode(values.email, String(data.get("code") ?? ""), supabase);
    if (!result.ok) {
      recordFailure(ip, key);
      return { step: "code", values, error: result.error };
    }
    clearFailures(ip, key);
    await audit({
      actor: null,
      action: "client_registered",
      entity: "profiles",
      entityId: result.userId,
      detail: { method: "email_code" },
      ip,
    });
    // An address that already belonged to staff signs them in as staff; the
    // booking page would only bounce them, so send them home instead.
    redirect(result.role === "client" ? from : "/console");
  }

  if (values.fullName.length < 2) return { step: "details", values, error: "Enter your name." };
  if (!isValidPhone(values.phone)) {
    return { step: "details", values, error: "Enter a 10-digit mobile number — it is how the deployment desk replies." };
  }
  if (!isValidEmail(values.email)) return { step: "details", values, error: "Enter a valid email address." };

  const supabase = await supabaseServer();
  const sent = await startClientSignup(values, supabase);
  if (!sent.ok) return { step: intent === "resend" ? "code" : "details", values, error: sent.error };

  return {
    step: "code",
    values,
    sentAt: Date.now(),
    notice: intent === "resend" ? "A new code is on its way." : undefined,
  };
}
