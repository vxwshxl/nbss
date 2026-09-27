"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { SOS_KIND_LABEL, isLive, type SosKind, type SosStatus } from "@nbss/shared/sos";

import { PhoneLink, istDateTime } from "@/components/console/preview-kit";
import { SosPreviewDialog } from "@/components/console/sos-preview";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";

export type SosRow = {
  id: string;
  status: SosStatus;
  kind: SosKind;
  raisedAt: string;
  acknowledgedAt: string | null;
  closedAt: string | null;
  insideFence: boolean | null;
  guardName: string;
  guardCode: string;
  guardPhone: string | null;
  siteName: string;
  district: string | null;
  responders: number;
};

export function sosPill(status: SosStatus) {
  return <StatusPill status={status === "active" ? "sos_active" : status} />;
}

/** The SOS log. A row opens the alert; `?alert=<id>` opens one directly. */
export function SosWorkspace({ rows }: { rows: SosRow[] }) {
  const params = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(params.get("alert"));

  const columns: Column<SosRow>[] = [
    {
      header: "Guard",
      cell: (r) => (
        <span className="block">
          <span className="block font-medium">{r.guardName}</span>
          <span className="block font-mono text-xs text-muted-foreground">{r.guardCode}</span>
        </span>
      ),
      sortValue: (r) => r.guardName,
      searchValue: (r) => `${r.guardName} ${r.guardCode}`,
      printCell: (r) => r.guardName,
    },
    {
      header: "Phone",
      cell: (r) => <PhoneLink phone={r.guardPhone} />,
      printCell: (r) => r.guardPhone ?? "—",
    },
    {
      header: "Site",
      cell: (r) => (
        <span className="block">
          <span className="block">{r.siteName}</span>
          {r.district && <span className="block text-xs text-muted-foreground">{r.district}</span>}
        </span>
      ),
      sortValue: (r) => r.siteName,
      searchValue: (r) => r.siteName,
      printCell: (r) => r.siteName,
    },
    {
      header: "Kind",
      cell: (r) => SOS_KIND_LABEL[r.kind],
      sortValue: (r) => r.kind,
    },
    {
      header: "Raised",
      cell: (r) => <span className="tabular-nums">{istDateTime(r.raisedAt)}</span>,
      sortValue: (r) => r.raisedAt,
      printCell: (r) => istDateTime(r.raisedAt),
    },
    {
      header: "Responders",
      className: "text-right",
      headClassName: "text-right",
      cell: (r) => <span className="tabular-nums">{r.responders}</span>,
      sortValue: (r) => r.responders,
    },
    {
      header: "State",
      className: "text-right",
      headClassName: "text-right",
      cell: (r) => sosPill(r.status),
      sortValue: (r) => (isLive(r.status) ? 0 : 1),
      printCell: (r) => r.status,
    },
  ];

  return (
    <Panel tone="rose" title={`${rows.length} alert${rows.length === 1 ? "" : "s"}`} icon={ShieldAlert} bodyClassName="p-3 sm:p-4">
      <DataTable
        columns={columns}
        data={rows}
        getRowKey={(r) => r.id}
        interactiveRows
        rowPreview={false}
        onRowClick={(r) => setOpenId(r.id)}
        printTitle="SOS alerts"
        searchPlaceholder="Search by guard, code or site…"
        emptyMessage="No SOS has ever been raised. Guards raise one from the app by holding the button for three seconds."
        rowClassName={(r) => (isLive(r.status) ? "bg-rose-50/70 dark:bg-rose-500/10" : undefined)}
      />
      <SosPreviewDialog id={openId} onClose={() => setOpenId(null)} />
    </Panel>
  );
}
