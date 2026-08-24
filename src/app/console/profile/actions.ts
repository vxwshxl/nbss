"use server";

import { revalidatePath } from "next/cache";

import { audit, isValidSecret, requireSession } from "@/lib/auth";
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

  const { error } = await supabaseAdmin()
    .from("profiles")
    .update({ full_name: fullName, phone: phone || null })
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
  return { ok: true, message: "Your details are saved." };
}

/**
 * Changing your own PIN.
 *
 * The current one is required even though an admin could set it without —
 * because this form is used by whoever is sitting at the device, and a phone
 * left unlocked on a table should not be enough to lock its owner out.
 */
export async function changeOwnPin(_prev: ProfileState, data: FormData): Promise<ProfileState> {
  const session = await requireSession();

  // An admin viewing as someone else must not be able to change that person's
  // PIN from inside their view — that is a credential, not a detail. The reset
  // flow on the People screen is the supported path, and it is audited.
  if (session.impersonating) {
    return { ok: false, error: "Stop viewing as this person before changing their PIN." };
  }

  const current = String(data.get("current") ?? "");
  const next = String(data.get("next") ?? "");
  const confirm = String(data.get("confirm") ?? "");

  if (!current) return { ok: false, error: "Enter your current PIN." };
  if (next !== confirm) return { ok: false, error: "The two new PINs do not match." };

  if (!isValidSecret(next, session.profile.role)) {
    return {
      ok: false,
      error:
        session.profile.role === "guard"
          ? "Your new PIN must be 6–12 digits."
          : "Your new passphrase must be at least 8 characters.",
    };
  }
  if (next === current) return { ok: false, error: "The new PIN must be different from the old one." };

  const admin = supabaseAdmin();

  // Verify the current secret by attempting a sign-in with it, which is the
  // only way to check a bcrypt hash we never see.
  const { data: user } = await admin.auth.admin.getUserById(session.profile.id);
  const email = user.user?.email;
  if (!email) return { ok: false, error: "That account has no sign-in address." };

  const { createClient } = await import("@supabase/supabase-js");
  const probe = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error: wrong } = await probe.auth.signInWithPassword({ email, password: current });
  if (wrong) return { ok: false, error: "That is not your current PIN." };

  const { error } = await admin.auth.admin.updateUserById(session.profile.id, { password: next });
  if (error) return { ok: false, error: error.message };

  await admin
    .from("profiles")
    .update({ must_change_pin: false, pin_reset_at: new Date().toISOString() })
    .eq("id", session.profile.id);

  await audit({ actor: session.realProfile, action: "own_pin_changed", entity: "profiles", entityId: session.profile.id });

  revalidatePath("/console/profile");
  return { ok: true, message: "Your PIN is changed. Use it the next time you sign in." };
}
