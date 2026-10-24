"use client";

import { usePathname, useRouter } from "next/navigation";

import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { PeriodBar } from "@/components/console/period-bar";
import { duration } from "@/lib/tracking";

export type RegisterRow = {
  key: string;
  date: string;
  dateLabel: string;
  site: string;
  shift: string;
  status: "present" | "late" | "absent" | "replaced" | "upcoming" | "not_arrived" | "pending_review" | "rejected" | "on_duty";
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number | null;
  overtimeMinutes: number | null;
  note: string;
  attendanceId: string | null;
};

const LABEL: Record<RegisterRow["status"], string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  replaced: "Replaced",
  upcoming: "Upcoming",
  not_arrived: "Not arrived",
  pending_review: "Needs review",
  rejected: "Rejected",
  on_duty: "On duty",
};

/**
 * One guard's attendance, duty by duty: every rostered duty in the period with
 * what happened to it, plus any check-in that was not on the roster. A duty that
 * ended with no check-in is Absent; one handed to another guard is Replaced (not
 * held against this guard). The Excel button exports exactly these rows.
 */
export function GuardRegister({ guardName, from, to, rows }: { guardName: string; from: string; to: string; rows: RegisterRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (f: string, t: string) => router.replace(`${pathname}?from=${f}&to=${t}`);

  const columns: Column<RegisterRow>[] = [
    { header: "Date", cell: (r) => <span className="tabular-nums">{r.dateLabel}</span>, sortValue: (r) => r.date, printCell: (r) => r.date },
    { header: "Site", cell: (r) => r.site, sortValue: (r) => r.site, searchValue: (r) => `${r.site} ${r.note}` },
    { header: "Duty", cell: (r) => <span className="text-sm text-muted-foreground">{r.shift}</span>, printCell: (r) => r.shift },
    {
      header: "Status",
      cell: (r) => <StatusPill status={r.status === "not_arrived" ? "absent" : r.status === "on_duty" ? "on_duty" : r.status} label={LABEL[r.status]} />,
      sortValue: (r) => r.status,
      printCell: (r) => LABEL[r.status],
    },
    { header: "In", cell: (r) => <span className="tabular-nums">{r.checkIn ?? "-"}</span>, printCell: (r) => r.checkIn ?? "-" },
    { header: "Out", cell: (r) => <span className="tabular-nums">{r.checkOut ?? "-"}</span>, printCell: (r) => r.checkOut ?? "-" },
    {
      header: "Hours",
      className: "tabular-nums",
      cell: (r) => (r.workedMinutes != null ? duration(r.workedMinutes) : "-"),
      printCell: (r) => (r.workedMinutes != null ? (r.workedMinutes / 60).toFixed(2) : "-"),
      sortValue: (r) => r.workedMinutes ?? 0,
      total: (rs) => (rs.reduce((n, r) => n + (r.workedMinutes ?? 0), 0) / 60).toFixed(2),
    },
    {
      header: "Overtime",
      className: "tabular-nums",
      cell: (r) => (r.overtimeMinutes ? duration(r.overtimeMinutes) : "-"),
      printCell: (r) => (r.overtimeMinutes ? (r.overtimeMinutes / 60).toFixed(2) : "-"),
    },
    { header: "Note", cell: (r) => <span className="text-xs text-muted-foreground">{r.note || "-"}</span>, printCell: (r) => r.note },
  ];

  return (
    <div className="space-y-4">
      <PeriodBar from={from} to={to} onChange={go} />
      <DataTable
        title={`${rows.length} ${rows.length === 1 ? "entry" : "entries"}`}
        columns={columns}
        data={rows}
        getRowKey={(r) => r.key}
        printTitle={`${guardName} · attendance ${from} to ${to}`}
        searchPlaceholder="Search by site or note…"
        emptyMessage="No duties or check-ins in this period."
        rowClassName={(r) => (r.status === "absent" ? "bg-rose-50/70 dark:bg-rose-500/10" : undefined)}
      />
    </div>
  );
}
