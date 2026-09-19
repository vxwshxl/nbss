import type { Metadata } from "next";

import { GuardsWorkspace, type PersonRow } from "@/components/console/guards-workspace";
import { PageHeader } from "@/components/console/page-header";
import { requireRoleSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Guards" };
export const dynamic = "force-dynamic";

export default async function GuardsPage() {
  const session = await requireRoleSession("admin", "supervisor");
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("profiles")
    .select(
      "id, employee_code, full_name, role, phone, active, joined_at, created_at, must_change_pin, pin_reset_at, last_seen_at",
    )
    .order("employee_code");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="People" title="Guards & staff" />

      <GuardsWorkspace
        rows={(data ?? []) as PersonRow[]}
        // An admin viewing as someone else must not be able to create accounts
        // or reset PINs in that person's name.
        canManage={session.profile.role === "admin" && !session.impersonating}
        selfId={session.realProfile.id}
      />

      <p className="text-xs text-muted-foreground">
        A PIN is stored hashed and can never be read back — resetting issues a new
        one and shows it once. Deactivating an account keeps every shift and punch
        it ever produced.
      </p>
    </div>
  );
}
