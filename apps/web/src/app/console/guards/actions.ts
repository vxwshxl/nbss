"use server";

import { cookies, headers } from "next/headers";

import { DATA_MODE_COOKIE, parseMode } from "@/lib/mode/shared";
import { revalidatePath } from "next/cache";

import { fromRoleChoice, isAdmin, isValidEmail, isValidPhone, pinPassword, ROLE_CHOICES, type RoleChoice } from "@nbss/shared/identity";

import {
  audit,
  codeToEmail,
  createStaffAccount,
  requireRoleSession,
} from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

import type { GuardFormState, PinResetResult } from "./guard-state";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/** Four digits, never starting with a zero (some keypads eat a leading 0). */
function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Kept where the office can read it again: they tell the guard. */
async function rememberPin(profileId: string, pin: string, by: string): Promise<void> {
  await supabaseAdmin().from("staff_pins").upsert({ profile_id: profileId, pin, set_at: new Date().toISOString(), set_by: by });
}

export async function addGuard(_prev: GuardFormState, data: FormData): Promise<GuardFormState> {
  const session = await requireRoleSession("admin");

  // The office types the number; "NBSS-" is fixed.
  const number = String(data.get("employee_number") ?? "").replace(/\D/g, "");
  const employeeCode = number ? `NBSS-${Number(number)}` : "";
  const fullName = String(data.get("full_name") ?? "").trim();
  const phone = String(data.get("phone") ?? "").trim();
  const email = String(data.get("email") ?? "").trim().toLowerCase();
  // A choice, not a role: Housekeeper is the guard role with the housekeeping trade.
  const choice = String(data.get("role") ?? "guard") as RoleChoice;
  const supplied = String(data.get("pin") ?? "").trim();
  const sosEnabled = data.get("sos_enabled") !== "off";

  const values = { employee_code: number, full_name: fullName, phone, email, role: choice, pin: supplied };

  if (!ROLE_CHOICES.includes(choice)) return { ok: false, values, error: "Choose a role." };
  const { role, trade } = fromRoleChoice(choice);
  if (role === "developer" && session.realProfile.role !== "developer") {
    return { ok: false, values, error: "Only a developer can create another developer." };
  }
  if (!fullName) return { ok: false, values, error: "Enter the person's full name." };
  if (!number) return { ok: false, values, error: "Enter the employee number." };
  if (!isValidPhone(phone)) return { ok: false, values, error: "Enter a 10-digit phone number (an Indian mobile starts with 6–9)." };
  if (email && !isValidEmail(email)) return { ok: false, values, error: "That email address does not look right." };
  if (!/^\d{4}$/.test(supplied)) return { ok: false, values, error: "Set a 4-digit PIN for them." };

  // Everyone signs in with their employee code and the 4-digit PIN the office sets.
  const pin = supplied;

  const created = await createStaffAccount({
    employeeCode,
    pin,
    fullName,
    role,
    trade,
    sosEnabled,
    phone,
    email: email || undefined,
  });
  if ("error" in created) return { ok: false, values, error: created.error };

  await rememberPin(created.id, pin, session.realProfile.id);
  // Test or Live, as its creator sees: a developer by their header switch, anyone else
  // by their own side. (The service key creates it, so the database cannot tell.)
  const isTest =
    session.realProfile.role === "developer"
      ? parseMode((await cookies()).get(DATA_MODE_COOKIE)?.value) === "test"
      : Boolean((session.realProfile as { is_test?: boolean }).is_test);
  if (isTest) await supabaseAdmin().from("profiles").update({ is_test: true }).eq("id", created.id);

  await audit({
    actor: session.realProfile,
    action: "account_created",
    entity: "profiles",
    entityId: created.id,
    detail: { employee_code: employeeCode, role, trade, sos: sosEnabled, email: !!email },
    ip: await clientIp(),
  });

  revalidatePath("/console/guards");
  revalidatePath("/console/users");

  return { ok: true, values: null, created: { employeeCode, fullName, email: email || null, pin, generated: false } };
}

/**
 * Changes how someone is reached, and — for the email — how they sign in.
 *
 * The address is changed on the auth user, confirmed on the spot (the office
 * is vouching for it), and the trigger from 0009 copies it onto the profile.
 */
export async function updateContact(
  profileId: string,
  input: { email: string; phone: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireRoleSession("admin");
  const admin = supabaseAdmin();

  const { data: target } = await admin
    .from("profiles")
    .select("id, role, email, phone, employee_code")
    .eq("id", profileId)
    .maybeSingle();
  if (!target) return { ok: false, error: "That account no longer exists." };

  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  if (phone && !isValidPhone(phone)) return { ok: false, error: "Enter a 10-digit phone number (an Indian mobile starts with 6–9)." };

  if (email && !isValidEmail(email)) return { ok: false, error: "That email address does not look right." };
  // Email is optional: everyone signs in with their employee code and PIN.

  if (email !== (target.email ?? "")) {
    if (email) {
      const { data: taken } = await admin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .neq("id", profileId)
        .maybeSingle();
      if (taken) return { ok: false, error: `${email} already belongs to another account.` };
    }
    const { error } = await admin.auth.admin.updateUserById(profileId, {
      email: email || codeToEmail(target.employee_code),
      email_confirm: true,
    });
    if (error) return { ok: false, error: error.message };
  }

  if (phone !== (target.phone ?? "")) {
    const { error } = await admin.from("profiles").update({ phone: phone || null }).eq("id", profileId);
    if (error) return { ok: false, error: error.message };
  }

  await audit({
    actor: session.realProfile,
    action: "contact_updated",
    entity: "profiles",
    entityId: profileId,
    detail: { email_changed: email !== (target.email ?? ""), phone_changed: phone !== (target.phone ?? "") },
    ip: await clientIp(),
  });

  revalidatePath("/console/guards");
  revalidatePath("/console/users");
  return { ok: true };
}

/**
 * Issues a new PIN.
 *
 * There is no way to read the existing one — Supabase stores it bcrypt-hashed,
 * which is correct and not reversible. So "show me their PIN" is necessarily
 * "give them a new one and show me that". The value returned here has just
 * been set; it was never retrieved from anywhere.
 */
export async function resetPin(profileId: string): Promise<PinResetResult> {
  const session = await requireRoleSession("admin");
  const admin = supabaseAdmin();

  const { data: target } = await admin
    .from("profiles")
    .select("id, employee_code, full_name, role")
    .eq("id", profileId)
    .maybeSingle();

  if (!target) return { ok: false, error: "That account no longer exists." };

  const pin = generatePin();

  const { error } = await admin.auth.admin.updateUserById(profileId, { password: pinPassword(pin) });
  if (error) return { ok: false, error: error.message };
  await rememberPin(profileId, pin, session.realProfile.id);

  await admin
    .from("profiles")
    .update({
      must_change_pin: false,
      pin_reset_at: new Date().toISOString(),
      pin_reset_by: session.realProfile.id,
    })
    .eq("id", profileId);

  await audit({
    actor: session.realProfile,
    action: "pin_reset",
    entity: "profiles",
    entityId: profileId,
    detail: { employee_code: target.employee_code },
    ip: await clientIp(),
  });

  revalidatePath("/console/guards");
  revalidatePath("/console/users");

  return { ok: true, pin, employeeCode: target.employee_code, fullName: target.full_name };
}

/** Deactivating keeps every attendance row the person ever produced. */
export async function setAccountActive(profileId: string, active: boolean): Promise<void> {
  const session = await requireRoleSession("admin");

  if (profileId === session.realProfile.id && !active) {
    throw new Error("You cannot deactivate the account you are signed in with.");
  }

  const admin = supabaseAdmin();
  if (session.realProfile.role !== "developer") {
    const { data: target } = await admin.from("profiles").select("role").eq("id", profileId).maybeSingle();
    if (target?.role === "developer") throw new Error("Only a developer can deactivate a developer.");
  }
  const { error } = await admin.from("profiles").update({ active }).eq("id", profileId);
  if (error) throw new Error(error.message);

  await audit({
    actor: session.realProfile,
    action: active ? "account_reactivated" : "account_deactivated",
    entity: "profiles",
    entityId: profileId,
    ip: await clientIp(),
  });

  revalidatePath("/console/guards");
  revalidatePath("/console/users");
}

/** Switches someone's SOS button on or off (0052). */
export async function setPersonSos(profileId: string, enabled: boolean): Promise<void> {
  const session = await requireRoleSession("admin");
  const { error } = await supabaseAdmin().from("profiles").update({ sos_enabled: enabled }).eq("id", profileId);
  if (error) throw new Error(error.message);

  await audit({
    actor: session.realProfile,
    action: enabled ? "sos_switched_on" : "sos_switched_off",
    entity: "profiles",
    entityId: profileId,
    ip: await clientIp(),
  });

  revalidatePath("/console/guards");
  revalidatePath("/console/users");
}

export async function changeRole(profileId: string, choice: RoleChoice): Promise<void> {
  const session = await requireRoleSession("admin");
  const { role, trade } = fromRoleChoice(choice);

  if (profileId === session.realProfile.id && !isAdmin(role)) {
    throw new Error("You cannot remove your own administrator access.");
  }

  const admin = supabaseAdmin();

  // Granting or taking away the developer role is a developer's call alone.
  const { data: current } = await admin.from("profiles").select("role").eq("id", profileId).maybeSingle();
  if (
    session.realProfile.role !== "developer" &&
    (role === "developer" || current?.role === "developer")
  ) {
    throw new Error("Only a developer can grant or remove the developer role.");
  }
  const { error } = await admin.from("profiles").update({ role, trade }).eq("id", profileId);
  if (error) throw new Error(error.message);

  await audit({
    actor: session.realProfile,
    action: "role_changed",
    entity: "profiles",
    entityId: profileId,
    detail: { role, trade },
    ip: await clientIp(),
  });

  revalidatePath("/console/guards");
  revalidatePath("/console/users");
}

/**
 * What a hard delete would take with it.
 *
 * Read before the confirmation is shown, so the dialog can name real numbers instead of
 * a vague warning. `profiles.id` is the target of eight ON DELETE CASCADE foreign keys,
 * and `attendance` is one of them — which means deleting a guard destroys the record
 * that payroll and client billing are both computed from. An administrator is entitled
 * to do that; they are not entitled to do it without being told.
 */
export async function accountFootprint(profileId: string): Promise<{
  attendance: number;
  shifts: number;
  sosAlerts: number;
  positions: number;
  isLastAdmin: boolean;
}> {
  await requireRoleSession("admin");
  const admin = supabaseAdmin();

  // `head: true` with an exact count reads the count without transferring the rows.
  const [attendance, shifts, sos, positions, admins] = await Promise.all([
    admin.from("attendance").select("id", { count: "exact", head: true }).eq("guard_id", profileId),
    admin.from("shifts").select("id", { count: "exact", head: true }).eq("guard_id", profileId),
    admin.from("sos_alerts").select("id", { count: "exact", head: true }).eq("raised_by", profileId),
    admin
      .from("guard_location_history")
      .select("id", { count: "exact", head: true })
      .eq("guard_id", profileId),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("role", ["developer", "admin"])
      .eq("active", true),
  ]);

  return {
    attendance: attendance.count ?? 0,
    shifts: shifts.count ?? 0,
    sosAlerts: sos.count ?? 0,
    positions: positions.count ?? 0,
    isLastAdmin: (admins.count ?? 0) <= 1,
  };
}

/**
 * Deletes an account outright, and everything that cascades from it.
 *
 * Deactivating is almost always the right action — it stops the sign-in and keeps the
 * ledger — and it stays the default the UI offers. This exists for the cases
 * deactivating does not cover: a duplicate created by a typo, a test account, someone
 * entered who never actually joined. For those, an inactive row cluttering the roster
 * forever is the wrong answer.
 *
 * The auth user is deleted rather than the profile row. `profiles.id` references
 * `auth.users(id) ON DELETE CASCADE`, so removing the login removes the profile, and
 * removing the profile cascades onward. Deleting the profile directly would leave an
 * orphaned auth user that could still authenticate and then find no profile — which
 * `currentProfile` reads as "no access", so it would fail closed, but it would also
 * silently hold the email address and block the code being reused.
 *
 * Two refusals, and both are about not locking anybody out:
 * deleting your own account, and deleting the last active administrator.
 */
export async function deleteAccount(profileId: string): Promise<void> {
  const session = await requireRoleSession("admin");

  if (profileId === session.realProfile.id) {
    throw new Error("You cannot delete the account you are signed in with.");
  }

  const admin = supabaseAdmin();

  const { data: target } = await admin
    .from("profiles")
    .select("employee_code, full_name, role")
    .eq("id", profileId)
    .maybeSingle();

  if (!target) throw new Error("That account no longer exists.");

  if (target.role === "developer" && session.realProfile.role !== "developer") {
    throw new Error("Only a developer can delete a developer's account.");
  }

  if (isAdmin(target.role)) {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("role", ["developer", "admin"])
      .eq("active", true);

    // Deleting the only administrator leaves a system nobody can manage — no way to
    // add a guard, move a fence, or create another admin.
    if ((count ?? 0) <= 1) {
      throw new Error(
        "This is the last active administrator. Promote somebody else to administrator first.",
      );
    }
  }

  // Counted before the delete, because afterwards there is nothing left to count. This
  // is the only surviving record of what was destroyed: `audit_log.actor_id` is
  // ON DELETE SET NULL, so the log outlives the account, and `actor_code` is why the
  // entries this person made as an actor remain attributable.
  const footprint = await accountFootprint(profileId);

  await audit({
    actor: session.realProfile,
    action: "account_deleted",
    entity: "profiles",
    entityId: profileId,
    detail: {
      employee_code: target.employee_code,
      full_name: target.full_name,
      role: target.role,
      destroyed: {
        attendance: footprint.attendance,
        shifts: footprint.shifts,
        sos_alerts: footprint.sosAlerts,
        positions: footprint.positions,
      },
    },
    ip: await clientIp(),
  });

  const { error } = await admin.auth.admin.deleteUser(profileId);
  if (error) throw new Error(error.message);

  revalidatePath("/console/guards");
  revalidatePath("/console/users");
}
