import type { Metadata } from "next";

import { GuardsWorkspace, type PersonRow } from "@/components/console/guards-workspace";
import { PageHeader } from "@/components/console/page-header";
import { requireRoleSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

/** Every account in the console — staff, guards and clients — split by role. */
export default async function UsersPage() {
  const session = await requireRoleSession("admin", "supervisor");
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("profiles")
    .select(
      "id, employee_code, full_name, role, phone, email, active, joined_at, created_at, must_change_pin, pin_reset_at, last_seen_at",
    )
    .order("full_name");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="People" title="Users" />
      <GuardsWorkspace
        rows={(data ?? []) as PersonRow[]}
        canManage={session.profile.role === "admin" && !session.impersonating}
        selfId={session.realProfile.id}
        showRoleTabs
        defaultRole="client"
      />
    </div>
  );
}
