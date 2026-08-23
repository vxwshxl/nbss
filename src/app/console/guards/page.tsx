import type { Metadata } from "next";

import { Icon } from "@/components/Icon";
import { PeopleTable } from "@/components/console/tables";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Guards" };
export const dynamic = "force-dynamic";

export default async function GuardsPage() {
  await requireRole("admin", "supervisor");
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("profiles")
    .select("id, employee_code, full_name, role, phone, active, joined_at")
    .order("employee_code");

  const people = data ?? [];

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

      <div className="cpanel cpanel--table">
        <div className="cpanel__head">
          <h2 className="cpanel__h">{people.length} account{people.length === 1 ? "" : "s"}</h2>
        </div>
        <div className="cpanel__body">
          <PeopleTable rows={people} />
        </div>
      </div>

      <p className="admin-note">
        <Icon name="shield-alt" />
        <span>
          Adding and deactivating people from this screen — along with PIN resets and the document
          vault — is Phase 2. For now accounts are created from the command line.
        </span>
      </p>
    </div>
  );
}
