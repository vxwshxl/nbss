"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { audit } from "@/lib/auth";
import {
  THROTTLED,
  cleanMobile,
  clearFailures,
  isThrottled,
  landingFor,
  recordFailure,
  signInWorker,
} from "@/lib/sign-in";
import { supabaseServer } from "@/lib/supabase/server";

import type { SignInState } from "./state";

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

/** The workers' door beside Google: name and mobile number, for every role but client. */
export async function signInAction(_prev: SignInState, data: FormData): Promise<SignInState> {
  const name = String(data.get("name") ?? "");
  const mobile = cleanMobile(String(data.get("mobile") ?? ""));
  const from = String(data.get("from") ?? "");
  const ip = await clientIp();
  const kept = { name, mobile: String(data.get("mobile") ?? "") };

  if (!name.trim()) return { ...kept, error: "Enter your name." };
  if (!mobile) return { ...kept, error: "Enter your 10-digit mobile number." };

  const idKey = `id:${mobile}`;
  if (isThrottled(ip, idKey)) return { ...kept, error: THROTTLED };

  const result = await signInWorker(name, mobile, await supabaseServer());
  if (!result.ok) {
    recordFailure(ip, idKey);
    return { ...kept, error: result.error };
  }

  clearFailures(ip, idKey);
  await audit({
    actor: null,
    action: "sign_in",
    entity: "profiles",
    entityId: result.userId,
    detail: { method: "name_mobile" },
    ip,
  });

  redirect(await landingFor(result.role, result.userId, from));
}
