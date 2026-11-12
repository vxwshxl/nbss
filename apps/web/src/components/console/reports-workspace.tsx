"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PeriodBar } from "@/components/console/period-bar";
import { DataTable, type Column } from "@/components/ui/data-table";
import { duration } from "@/lib/tracking";

export type GuardReport = {
  id: string;
  name: string;
  code: string;
  /** "Guard" or "Housekeeper". */
  role: string;
  days: number;
  shifts: number;
  workedMinutes: number;
  overtimeMinutes: number;
  late: number;
  /** Rostered days with no check-in that day: the Attendance page's A. */
  absent: number;
  replaced: number;
  covered: number;
  flagged: number;
  offRoster: number;
};

export type SiteReport = {
  id: string;
  name: string;
  district: string | null;
  required: number | null;
  daysStaffed: number;
  guards: number;
  workedMinutes: number;
  /** Guard-days present and absent at this site, and the attendance rate. */
  present: number;
  absent: number;
  rate: number | null;
  sos: number;
};

const hours = (m: number) => (m / 60).toFixed(1);

/** The month at a glance, per guard and per site, ready for payroll and billing. */
export function ReportsWorkspace({ from, to, guards, sites }: { from: string; to: string; guards: GuardReport[]; sites: SiteReport[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // The new period, keeping the page's other filters (Guards / Housekeepers).
  const go = (f: string, t: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("from", f);
    q.set("to", t);
    router.replace(`${pathname}?${q}`);
  };

  const g: Column<GuardReport>[] = [
    {
      header: "Person",
      cell: (r) => (
        <span className="block">
          <Link data-row-primary href={`/console/reports/guard/${r.id}?from=${from}&to=${to}`} className="block font-medium text-primary-ink hover:underline">
            {r.name}
          </Link>
          <span className="block text-xs text-muted-foreground">
            <span className="font-mono">{r.code}</span> · {r.role}
          </span>
        </span>
      ),
      sortValue: (r) => r.name,
      searchValue: (r) => `${r.name} ${r.code} ${r.role}`,
      printCell: (r) => `${r.name} (${r.code}, ${r.role})`,
    },
    { header: "Days worked", className: "tabular-nums", cell: (r) => r.days, sortValue: (r) => r.days, total: (rs) => rs.reduce((n, r) => n + r.days, 0) },
    { header: "Shifts", className: "tabular-nums", cell: (r) => r.shifts, sortValue: (r) => r.shifts },
    { header: "Hours", className: "tabular-nums", cell: (r) => duration(r.workedMinutes), printCell: (r) => hours(r.workedMinutes), sortValue: (r) => r.workedMinutes, total: (rs) => hours(rs.reduce((n, r) => n + r.workedMinutes, 0)) },
    { header: "Overtime", className: "tabular-nums", cell: (r) => (r.overtimeMinutes ? duration(r.overtimeMinutes) : "-"), printCell: (r) => hours(r.overtimeMinutes), sortValue: (r) => r.overtimeMinutes },
    { header: "Late", className: "tabular-nums", cell: (r) => r.late || "-", sortValue: (r) => r.late },
    { header: "Absent", className: "tabular-nums", cell: (r) => (r.absent ? <span className="font-semibold text-rose-600">{r.absent}</span> : "-"), printCell: (r) => r.absent, sortValue: (r) => r.absent, total: (rs) => rs.reduce((n, r) => n + r.absent, 0) },
    { header: "Replaced / covered", className: "tabular-nums", cell: (r) => `${r.replaced} / ${r.covered}`, sortValue: (r) => r.covered },
    {
      header: "Flagged",
      className: "tabular-nums",
      cell: (r) => (r.flagged || r.offRoster ? <span className="font-semibold text-amber-700">{r.flagged + r.offRoster}</span> : "-"),
      printCell: (r) => r.flagged + r.offRoster,
      sortValue: (r) => r.flagged + r.offRoster,
    },
  ];

  const s: Column<SiteReport>[] = [
    {
      header: "Site",
      cell: (r) => (
        <span className="block">
          <Link data-row-primary href={`/console/reports/site/${r.id}?from=${from}&to=${to}`} className="block font-medium text-primary-ink hover:underline">
            {r.name}
          </Link>
          {r.district && <span className="block text-xs text-muted-foreground">{r.district}</span>}
        </span>
      ),
      sortValue: (r) => r.name,
      searchValue: (r) => r.name,
      printCell: (r) => r.name,
    },
    { header: "Guards needed", className: "tabular-nums", cell: (r) => r.required ?? "-", sortValue: (r) => r.required ?? 0 },
    { header: "Days staffed", className: "tabular-nums", cell: (r) => r.daysStaffed, sortValue: (r) => r.daysStaffed },
    { header: "Different people", className: "tabular-nums", cell: (r) => r.guards, sortValue: (r) => r.guards },
    { header: "Hours worked", className: "tabular-nums", cell: (r) => hours(r.workedMinutes), sortValue: (r) => r.workedMinutes, total: (rs) => hours(rs.reduce((n, r) => n + r.workedMinutes, 0)) },
    { header: "Present", className: "tabular-nums", cell: (r) => r.present || "-", printCell: (r) => r.present, sortValue: (r) => r.present, total: (rs) => rs.reduce((n, r) => n + r.present, 0) },
    { header: "Absent", className: "tabular-nums", cell: (r) => (r.absent ? <span className="font-semibold text-rose-600">{r.absent}</span> : "-"), printCell: (r) => r.absent, sortValue: (r) => r.absent, total: (rs) => rs.reduce((n, r) => n + r.absent, 0) },
    { header: "Attendance", className: "tabular-nums", cell: (r) => (r.rate == null ? "-" : `${r.rate}%`), sortValue: (r) => r.rate ?? -1 },
    { header: "SOS", className: "tabular-nums", cell: (r) => r.sos || "-", sortValue: (r) => r.sos },
  ];

  return (
    <div className="space-y-6">
      <PeriodBar from={from} to={to} onChange={go} />
      <DataTable title="By person" columns={g} data={guards} getRowKey={(r) => r.id} printTitle={`People ${from} to ${to}`} searchPlaceholder="Search by name, code or role…" emptyMessage="No attendance in this period." />
      <DataTable title="By site" columns={s} data={sites} getRowKey={(r) => r.id} printTitle={`Sites ${from} to ${to}`} searchPlaceholder="Search sites…" emptyMessage="No sites." />
    </div>
  );
}
