"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Radio } from "lucide-react";

import { AttendancePreviewDialog } from "@/components/console/attendance-preview";
import type { MapSite } from "@/components/console/site-map";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";

export type AttendanceRow = {
  id: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_accuracy_m: number | null;
  check_in_distance_m: number | null;
  check_in_method: string;
  check_out_distance_m: number | null;
  check_out_method: string | null;
  worked_minutes: number | null;
  overtime_minutes: number | null;
  status: string;
  device_reported_at: string | null;
  ip: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  guard_name: string | null;
  guard_code: string | null;
  site_name: string | null;
  /** The fence this punch was judged against. The popup loads its own. */
  site?: MapSite | null;
};

const IST = "Asia/Kolkata";

function shortTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  });
}

function hours(minutes: number | null): string {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  pending_review: "Needs review",
  rejected: "Rejected",
};

/**
 * Attendance, with the evidence behind each punch one click away.
 *
 * The table shows what a supervisor scans for. The panel shows what a dispute
 * needs: where the guard actually stood, drawn against the fence they were
 * judged against, how precise the fix was, what their phone claimed the time
 * was, and who has changed the record since.
 *
 * A row opens the punch's popup (`AttendancePreviewDialog`); `?record=<id>` in
 * the address opens one directly, which is how other screens link to a punch.
 */
export function AttendanceWorkspace({
  rows,
  canReview,
}: {
  rows: AttendanceRow[];
  canReview: boolean;
}) {
  const params = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(params.get("record"));

  // A guard sees only their own punches, so the guard column is dropped for
  // them rather than repeating their own name on every row.
  const showGuard = rows.some((r) => r.guard_name);

  const columns: Column<AttendanceRow>[] = [
    ...(showGuard
      ? [
          {
            header: "Guard",
            cell: (r: AttendanceRow) => (
              <span className="block">
                <span className="block font-medium">{r.guard_name ?? "—"}</span>
                <span className="block font-mono text-xs text-muted-foreground">
                  {r.guard_code ?? ""}
                </span>
              </span>
            ),
            sortValue: (r: AttendanceRow) => r.guard_name ?? "",
            searchValue: (r: AttendanceRow) => `${r.guard_name ?? ""} ${r.guard_code ?? ""}`,
            printCell: (r: AttendanceRow) => r.guard_name ?? "—",
          },
        ]
      : []),
    {
      header: "Site",
      cell: (r) => r.site_name ?? "—",
      sortValue: (r) => r.site_name ?? "",
      searchValue: (r) => r.site_name ?? "",
    },
    {
      header: "In",
      cell: (r) => <span className="tabular-nums">{shortTime(r.check_in_at)}</span>,
      sortValue: (r) => r.check_in_at ?? "",
      printCell: (r) => shortTime(r.check_in_at),
    },
    {
      header: "Out",
      cell: (r) =>
        r.check_out_at ? (
          <span className="tabular-nums">{shortTime(r.check_out_at)}</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            <Radio className="size-3.5" strokeWidth={2.2} />
            On duty
          </span>
        ),
      sortValue: (r) => r.check_out_at ?? "",
      printCell: (r) => (r.check_out_at ? shortTime(r.check_out_at) : "On duty"),
    },
    {
      header: "Worked",
      className: "text-right",
      headClassName: "text-right",
      cell: (r) => <span className="tabular-nums">{hours(r.worked_minutes)}</span>,
      sortValue: (r) => r.worked_minutes ?? -1,
      printCell: (r) => hours(r.worked_minutes),
    },
    {
      header: "Overtime",
      className: "text-right",
      headClassName: "text-right",
      cell: (r) => <span className="tabular-nums">{hours(r.overtime_minutes)}</span>,
      sortValue: (r) => r.overtime_minutes ?? -1,
      printCell: (r) => hours(r.overtime_minutes),
    },
    {
      header: "Distance",
      className: "text-right",
      headClassName: "text-right",
      cell: (r) => (
        <span className="tabular-nums">
          {r.check_in_distance_m === null ? "—" : `${Math.round(r.check_in_distance_m)} m`}
        </span>
      ),
      sortValue: (r) => r.check_in_distance_m ?? -1,
      printCell: (r) =>
        r.check_in_distance_m === null ? "—" : `${Math.round(r.check_in_distance_m)} m`,
    },
    {
      header: "State",
      className: "text-right",
      headClassName: "text-right",
      cell: (r) => <StatusPill status={r.status} />,
      sortValue: (r) => r.status,
      searchValue: (r) => STATUS_LABEL[r.status] ?? r.status,
      printCell: (r) => STATUS_LABEL[r.status] ?? r.status,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        getRowKey={(r) => r.id}
        interactiveRows
        rowPreview={false}
        onRowClick={(r) => setOpenId(r.id)}
        printTitle={showGuard ? "Attendance" : "My attendance"}
        searchPlaceholder={
          showGuard ? "Search by guard, code or site…" : "Search by site or state…"
        }
        emptyMessage="No attendance recorded yet. Punches appear here as soon as a guard checks in."
        rowClassName={(r) =>
          r.status === "pending_review" ? "bg-amber-50/60 dark:bg-amber-500/8" : undefined
        }
      />

      <AttendancePreviewDialog
        id={openId}
        onClose={() => setOpenId(null)}
        canReview={canReview}
        staff={showGuard}
      />
    </>
  );
}
