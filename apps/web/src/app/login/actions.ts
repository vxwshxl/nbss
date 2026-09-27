"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { audit, homeFor, type Role } from "@/lib/auth";
import {
  REFUSED,
  THROTTLED,
  clearFailures,
  isThrottled,
  passwordSignIn,
  recordFailure,
  sendSignInCode,
  verifySignInCode,
  type SignInResult,
} from "@/lib/sign-in";
import { supabaseServer } from "@/lib/supabase/server";

import type { SignInState } from "./state";

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

/**
 * Where to go after signing in. A `from` inside the console is honoured — the
 * page there re-checks the role and sends anyone who does not belong back to
 * their own home — anything else lands on the role's dashboard.
 */
function destination(role: Role, from: string): string {
  if (from.startsWith("/console/") && !from.startsWith("//")) return from;
  return homeFor(role);
}

/**
 * Every step of the sign-in form, as one action.
 *
 *   send      identifier → mail a code (always "sent", see lib/sign-in)
 *   resend    the same again, from the code step
 *   verify    identifier + code → session
 *   password  identifier + password or PIN → session
 */
export async function signInAction(_prev: SignInState, data: FormData): Promise<SignInState> {
  const intent = String(data.get("intent") ?? "send");
  const identifier = String(data.get("identifier") ?? "").trim();
  const from = String(data.get("from") ?? "");
  const ip = await clientIp();
  const idKey = `id:${identifier.toLowerCase()}`;

  if (!identifier) {
    return { step: "identify", identifier, error: "Enter your email or employee code." };
  }

  if (isThrottled(ip, idKey)) {
    return { step: intent === "password" ? "password" : "identify", identifier, error: THROTTLED };
  }

  if (intent === "send" || intent === "resend") {
    const supabase = await supabaseServer();
    await sendSignInCode(identifier, supabase);
    return {
      step: "code",
      identifier,
      notice: intent === "resend" ? "A new code is on its way." : undefined,
      sentAt: Date.now(),
    };
  }

  let result: SignInResult;
  const supabase = await supabaseServer();

  if (intent === "verify") {
    result = await verifySignInCode(identifier, String(data.get("code") ?? ""), supabase);
    if (!result.ok) {
      recordFailure(ip, idKey);
      return { step: "code", identifier, error: result.error };
    }
  } else {
    // Read straight off the FormData: trimming a secret makes it a different one.
    const secret = typeof data.get("secret") === "string" ? String(data.get("secret")) : "";
    result = await passwordSignIn(identifier, secret, supabase);
    if (!result.ok) {
      recordFailure(ip, idKey);
      return { step: "password", identifier, error: REFUSED };
    }
  }

  clearFailures(ip, idKey);
  await audit({
    actor: null,
    action: "sign_in",
    entity: "profiles",
    entityId: result.userId,
    detail: { method: intent === "verify" ? "email_code" : "password" },
    ip,
  });

  redirect(destination(result.role, from));
}
