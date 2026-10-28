"use server";

import { isValidPhone, normaliseName } from "@nbss/shared/identity";

import { revalidatePath } from "next/cache";

import { audit, requireSession } from "@/lib/auth";
import { assertCanWrite } from "@/lib/impersonation";
import { supabaseAdmin } from "@/lib/supabase/server";

import type { ProfileState } from "./profile-state";

/** Details a person may change about themselves. Role and code are not among them. */
export async function updateOwnProfile(_prev: ProfileState, data: FormData): Promise<ProfileState> {
  const session = await requireSession();
  assertCanWrite(session);

  const fullName = String(data.get("full_name") ?? "").trim();
  const phone = String(data.get("phone") ?? "").trim();

  if (!fullName) return { ok: false, error: "Your name cannot be blank." };
  const worker = session.profile.role !== "client";
  // Name and mobile are a worker's sign-in, so the mobile cannot be left blank.
  if (worker && !phone) return { ok: false, error: "Your mobile number is needed: you sign in with it." };
  if (phone && !isValidPhone(phone)) return { ok: false, error: "Enter a 10-digit phone number (an Indian mobile starts with 6–9)." };

  const admin = supabaseAdmin();
  if (worker) {
    const { data: sameNumber } = await admin
      .from("profiles")
      .select("full_name")
      .eq("active", true)
      .neq("role", "client")
      .neq("id", session.profile.id)
      .like("phone", `%${phone.replace(/\D/g, "").slice(-10)}`);
    if ((sameNumber ?? []).some((p) => normaliseName(p.full_name) === normaliseName(fullName))) {
      return { ok: false, error: "Someone else with this name has this mobile number, so you could not be told apart at sign-in." };
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({ full_name: fullName.replace(/\s+/g, " "), phone: phone || null })
    .eq("id", session.profile.id);

  if (error) return { ok: false, error: error.message };

  await audit({
    actor: session.realProfile,
    action: "profile_updated",
    entity: "profiles",
    entityId: session.profile.id,
    detail: session.impersonating ? { on_behalf_of: session.profile.employee_code } : undefined,
  });

  revalidatePath("/console/profile");
  return {
    ok: true,
    message: worker ? "Your details are saved. Sign in with this name and mobile from now on." : "Your details are saved.",
  };
}
