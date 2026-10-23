"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { audit } from "@/lib/auth";
import {
  REFUSED,
  THROTTLED,
  clearFailures,
  isThrottled,
  landingFor,
  passwordSignIn,
  recordFailure,
} from "@/lib/sign-in";
import { supabaseServer } from "@/lib/supabase/server";

import type { SignInState } from "./state";

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

/**
 * The staff door beside Google: employee code (or email) and the password or
 * PIN they were issued. Guards' logins are synthesized addresses with no Google
 * account behind them, so this is how they get in.
 */
export async function signInAction(_prev: SignInState, data: FormData): Promise<SignInState> {
  const identifier = String(data.get("identifier") ?? "").trim();
  const from = String(data.get("from") ?? "");
  const ip = await clientIp();
  const idKey = `id:${identifier.toLowerCase()}`;

  if (!identifier) {
    return { identifier, error: "Enter your employee code or email." };
  }

  if (isThrottled(ip, idKey)) {
    return { identifier, error: THROTTLED };
  }

  // Read straight off the FormData: trimming a secret makes it a different one.
  const secret = typeof data.get("secret") === "string" ? String(data.get("secret")) : "";
  const result = await passwordSignIn(identifier, secret, await supabaseServer());
  if (!result.ok) {
    recordFailure(ip, idKey);
    return { identifier, error: REFUSED };
  }

  clearFailures(ip, idKey);
  await audit({
    actor: null,
    action: "sign_in",
    entity: "profiles",
    entityId: result.userId,
    detail: { method: "password" },
    ip,
  });

  redirect(await landingFor(result.role, result.userId, from));
}
