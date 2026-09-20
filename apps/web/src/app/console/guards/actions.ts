"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  audit,
  createStaffAccount,
  isValidSecret,
  normaliseCode,
  requireRoleSession,
  type Role,
} from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

import type { GuardFormState, PinResetResult } from "./guard-state";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/** Digits only, and never starting with a zero — some keypads eat a leading 0. */
function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function addGuard(_prev: GuardFormState, data: FormData): Promise<GuardFormState> {
  const session = await requireRoleSession("admin");

  const employeeCode = normaliseCode(String(data.get("employee_code") ?? ""));
  const fullName = String(data.get("full_name") ?? "").trim();
  const phone = String(data.get("phone") ?? "").trim();
  const role = String(data.get("role") ?? "guard") as Role;
  const supplied = String(data.get("pin") ?? "").trim();

  const values = { employee_code: employeeCode, full_name: fullName, phone, role, pin: "" };

  if (!["admin", "supervisor", "guard", "client"].includes(role)) {
    return { ok: false, values, error: "Choose a role." };
  }
  if (!fullName) return { ok: false, values, error: "Enter the person's full name." };

  // An admin creating a guard usually has no PIN in mind; one is generated and
  // shown once. A supplied value still has to satisfy the rule for the role.
  const secret = supplied || (role === "guard" ? generatePin() : "");

  if (!secret) {
    return { ok: false, values, error: "Set a passphrase of at least 8 characters for this role." };
  }
  if (!isValidSecret(secret, role)) {
    return {
      ok: false,
      values,
      error:
        role === "guard"
          ? "A guard's PIN must be 6–12 digits."
          : "A staff passphrase must be at least 8 characters.",
    };
  }

  const created = await createStaffAccount({
    employeeCode,
    pin: secret,
    fullName,
    role,
    phone: phone || undefined,
  });

  if ("error" in created) return { ok: false, values, error: created.error };

  // Anyone given a secret they did not choose is asked to replace it.
  if (!supplied) {
    await supabaseAdmin().from("profiles").update({ must_change_pin: true }).eq("id", created.id);
  }

  await audit({
    actor: session.realProfile,
    action: "account_created",
    entity: "profiles",
    entityId: created.id,
    detail: { employee_code: employeeCode, role, generated_pin: !supplied },
    ip: await clientIp(),
  });

  revalidatePath("/console/guards");

  return {
    ok: true,
    values: null,
    created: { employeeCode, fullName, pin: secret, generated: !supplied },
  };
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

  const pin = target.role === "guard" ? generatePin() : `nbss-${generatePin()}`;

  const { error } = await admin.auth.admin.updateUserById(profileId, { password: pin });
  if (error) return { ok: false, error: error.message };

  await admin
    .from("profiles")
    .update({
      must_change_pin: true,
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

  return { ok: true, pin, employeeCode: target.employee_code, fullName: target.full_name };
}

/** Deactivating keeps every attendance row the person ever produced. */
export async function setAccountActive(profileId: string, active: boolean): Promise<void> {
  const session = await requireRoleSession("admin");

  if (profileId === session.realProfile.id && !active) {
    throw new Error("You cannot deactivate the account you are signed in with.");
  }

  const admin = supabaseAdmin();
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
}

export async function changeRole(profileId: string, role: Role): Promise<void> {
  const session = await requireRoleSession("admin");

  if (profileId === session.realProfile.id && role !== "admin") {
    throw new Error("You cannot remove your own administrator access.");
  }

  const admin = supabaseAdmin();
  const { error } = await admin.from("profiles").update({ role }).eq("id", profileId);
  if (error) throw new Error(error.message);

  await audit({
    actor: session.realProfile,
    action: "role_changed",
    entity: "profiles",
    entityId: profileId,
    detail: { role },
    ip: await clientIp(),
  });

  revalidatePath("/console/guards");
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
      .eq("role", "admin")
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

  if (target.role === "admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
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
}
