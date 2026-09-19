"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { audit, homeFor, requireRoleSession, requireSession } from "@/lib/auth";
import { impersonationCookie } from "@/lib/impersonation";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Start viewing the console as someone else.
 *
 * Only an admin may do this, checked against the *real* signed-in account
 * rather than the effective one — so an admin already viewing as a guard
 * cannot chain into a third account.
 */
export async function startImpersonation(profileId: string): Promise<void> {
  const session = await requireRoleSession("admin");

  if (session.impersonating) {
    throw new Error("Stop viewing as the current person before switching to another.");
  }
  if (profileId === session.realProfile.id) return;

  const { data: target } = await supabaseAdmin()
    .from("profiles")
    .select("id, employee_code, full_name, role, active")
    .eq("id", profileId)
    .maybeSingle();

  if (!target) throw new Error("That account no longer exists.");
  if (!target.active) throw new Error("That account is deactivated.");

  const h = await headers();
  await audit({
    actor: session.realProfile,
    action: "impersonation_started",
    entity: "profiles",
    entityId: profileId,
    detail: { employee_code: target.employee_code, role: target.role },
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  (await cookies()).set(impersonationCookie.name, profileId, impersonationCookie);

  redirect(homeFor(target.role));
}

export async function stopImpersonation(): Promise<void> {
  const session = await requireSession();

  if (session.impersonating) {
    await audit({
      actor: session.realProfile,
      action: "impersonation_stopped",
      entity: "profiles",
      entityId: session.profile.id,
      detail: { employee_code: session.profile.employee_code },
    });
  }

  (await cookies()).delete({ name: impersonationCookie.name, path: impersonationCookie.path });

  revalidatePath("/console", "layout");
  redirect(homeFor(session.realProfile.role));
}
