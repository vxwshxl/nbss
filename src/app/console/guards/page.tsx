import type { Metadata } from "next";

import { GuardsWorkspace, type PersonRow } from "@/components/console/GuardsWorkspace";
import { Icon } from "@/components/Icon";
import { requireRoleSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "People" };
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
    <div className="cwrap">
      <div className="chead">
        <div>
          <h1 className="chead__h">People</h1>
          <p className="chead__lede">
            Everyone with a login. A guard signs in with the employee code shown here.
          </p>
        </div>
      </div>

      <GuardsWorkspace
        rows={(data ?? []) as PersonRow[]}
        canManage={session.profile.role === "admin" && !session.impersonating}
        selfId={session.realProfile.id}
      />

      <p className="admin-note">
        <Icon name="shield-alt" />
        <span>
          A PIN is stored hashed and can never be read back — resetting issues a new one and shows
          it once. Deactivating an account keeps every shift and punch it ever produced.
        </span>
      </p>
    </div>
  );
}
