import type { Metadata } from "next";

import { Icon } from "@/components/Icon";
import { AuditTable } from "@/components/console/tables";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireRole("admin");
  const supabase = await supabaseServer();

  // Bounded because this table only grows. Once it outgrows a single page the
  // date range is the tool for reaching further back, and the filtering moves
  // into the query.
  const { data } = await supabase
    .from("audit_log")
    .select("id, actor_code, action, entity, entity_id, ip, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  const rows = data ?? [];

  return (
    <div className="cwrap">
      <div className="chead">
        <div>
          <h1 className="chead__h">Audit log</h1>
          <p className="chead__lede">
            Every privileged action, in the order it happened. Append-only — nothing here can be
            edited or removed, including by an administrator.
          </p>
        </div>
      </div>

      <div className="cpanel cpanel--table">
        <div className="cpanel__body">
          <AuditTable rows={rows} />
        </div>
      </div>

      <p className="admin-note">
        <Icon name="key" />
        <span>Retained indefinitely. Treat it as a business record.</span>
      </p>
    </div>
  );
}
