import { isAdmin } from "@nbss/shared/identity";

import { GuardsWorkspace, type PersonRow } from "@/components/console/guards-workspace";
import { PageHeader } from "@/components/console/page-header";
import { requireRoleSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export type PeopleKind = "guard" | "housekeeping" | "supervisor";

const TITLE: Record<PeopleKind, string> = {
  guard: "Guards",
  housekeeping: "Housekeepers",
  supervisor: "Supervisors",
};

/**
 * Guards, Housekeepers and Supervisors, each on a page of its own. A housekeeper is
 * the guard role with the housekeeping trade (0050), so the two are told apart by
 * trade; everyone else on the guard role is a security guard. Every account, of
 * every role, is still together on Users.
 */
export async function PeopleView({ kind }: { kind: PeopleKind }) {
  // The supervisors are the field officer's to manage; a supervisor sees the guards and
  // housekeepers of their own site (Postgres filters the rows, 0077), not each other.
  const session = kind === "supervisor" ? await requireRoleSession("admin", "field_officer") : await requireRoleSession("admin", "supervisor");
  const supabase = await supabaseServer();

  let q = supabase
    .from("profiles")
    .select("id, employee_code, full_name, role, trade, sos_enabled, phone, email, active, joined_at, created_at, last_seen_at")
    .order("employee_code");
  if (kind === "supervisor") q = q.eq("role", "supervisor");
  else if (kind === "housekeeping") q = q.eq("role", "guard").eq("trade", "housekeeping");
  else q = q.eq("role", "guard").neq("trade", "housekeeping");
  const { data } = await q;

  return (
    <div className="space-y-6">
      <PageHeader title={TITLE[kind]} />

      <GuardsWorkspace
        rows={(data ?? []) as PersonRow[]}
        // An admin viewing as someone else must not be able to create accounts
        // or reset PINs in that person's name.
        canManage={isAdmin(session.profile.role) && !session.impersonating}
        selfId={session.realProfile.id}
        isDeveloper={session.realProfile.role === "developer"}
        defaultRole={kind}
      />
    </div>
  );
}
