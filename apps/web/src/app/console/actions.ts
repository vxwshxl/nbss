"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { audit, currentProfile, emailForCode, homeFor, isValidCode, normaliseCode } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

import type { SignInState } from "./sign-in-state";

/**
 * Failed attempts, per source address.
 *
 * In-process and therefore per-instance, which on a serverless host means a
 * determined attacker gets a fresh allowance on every cold start. That is a
 * real limit, and the reason this is a speed bump rather than the security
 * boundary — the boundary is that a PIN only ever unlocks one guard's own
 * dashboard, and that every privileged action is checked again server-side.
 * Moving this to Postgres is a Phase 2 job.
 */
const attempts = new Map<string, { count: number; first: number }>();

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function throttle(ip: string) {
  const now = Date.now();
  const record = attempts.get(ip);

  if (!record || now - record.first > WINDOW_MS) {
    return {
      blocked: false,
      record: () => attempts.set(ip, { count: 1, first: now }),
    };
  }

  return {
    blocked: record.count >= MAX_ATTEMPTS,
    record: () => attempts.set(ip, { count: record.count + 1, first: record.first }),
  };
}

export async function signIn(_prev: SignInState, data: FormData): Promise<SignInState> {
  const rawCode = String(data.get("code") ?? "");
  const code = normaliseCode(rawCode);

  // Read the secret straight off the FormData: trimming it would quietly make
  // it a different secret than the one that was set.
  const secret = typeof data.get("secret") === "string" ? String(data.get("secret")) : "";

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limit = throttle(ip);

  if (limit.blocked) {
    return {
      ok: false,
      code,
      error: "Too many attempts from this connection. Wait ten minutes and try again.",
    };
  }

  if (!code || !secret) {
    limit.record();
    return { ok: false, code, error: "Enter both your employee code and your PIN." };
  }

  if (!isValidCode(code)) {
    limit.record();
    return { ok: false, code, error: "That is not a valid employee code." };
  }

  const email = await emailForCode(code);

  // One message for an unknown code, a deactivated account and a wrong PIN
  // alike. Distinguishing them would turn this form into a way to discover
  // which employee codes exist.
  const refused = "Those details were not accepted.";

  if (!email) {
    limit.record();
    return { ok: false, code, error: refused };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password: secret });

  if (error) {
    limit.record();
    return { ok: false, code, error: refused };
  }

  attempts.delete(ip);

  const profile = await currentProfile();
  if (!profile) {
    // Signed in, but no usable profile — treat it as a failure rather than
    // dropping someone into a console with no role.
    await supabase.auth.signOut();
    return { ok: false, code, error: refused };
  }

  await audit({ actor: profile, action: "sign_in", ip });

  redirect(homeFor(profile.role));
}

export async function signOut(): Promise<void> {
  const profile = await currentProfile();
  const supabase = await supabaseServer();

  await audit({ actor: profile, action: "sign_out" });
  await supabase.auth.signOut();

  redirect("/console/login");
}
