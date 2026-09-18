import type { Metadata } from "next";
import { ScrollText } from "lucide-react";

import { AuditWorkspace, type AuditRow } from "@/components/console/audit-workspace";
import { PageHeader } from "@/components/console/page-header";
import { Panel } from "@/components/ui/panel";
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
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Audit log" />

      <Panel
        tone="slate"
        title="Every privileged action, in the order it happened"
        icon={ScrollText}
        bodyClassName="p-3 sm:p-4"
      >
        <AuditWorkspace rows={(data ?? []) as AuditRow[]} />
      </Panel>

      <p className="text-xs text-muted-foreground">
        Append-only and retained indefinitely. Treat it as a business record.
      </p>
    </div>
  );
}
