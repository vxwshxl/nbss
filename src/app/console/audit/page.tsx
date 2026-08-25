import type { Metadata } from "next";

import { AuditWorkspace, type AuditRow } from "@/components/console/AuditWorkspace";
import { Icon } from "@/components/Icon";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireRole("admin");
  const supabase = await supabaseServer();

  // Bounded because this table only grows. Once it outgrows a page the date
  // range reaches further back, and the filtering moves into the query.
  const { data } = await supabase
    .from("audit_log")
    .select("id, actor_code, action, entity, entity_id, detail, ip, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  return (
    <div className="cwrap">
      <div className="chead">
        <div>
          <h1 className="chead__h">Audit log</h1>
          <p className="chead__lede">
            Every privileged action, in the order it happened. Select an entry to see what it
            recorded.
          </p>
        </div>
      </div>

      <div className="cpanel cpanel--table">
        <div className="cpanel__body">
          <AuditWorkspace rows={(data ?? []) as AuditRow[]} />
        </div>
      </div>

      <p className="admin-note">
        <Icon name="key" />
        <span>Append-only and retained indefinitely. Treat it as a business record.</span>
      </p>
    </div>
  );
}
