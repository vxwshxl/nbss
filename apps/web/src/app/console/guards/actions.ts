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
