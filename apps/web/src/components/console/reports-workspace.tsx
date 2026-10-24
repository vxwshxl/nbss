"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { DataTable, type Column } from "@/components/ui/data-table";
import { duration } from "@/lib/tracking";

export type GuardReport = {
  id: string;
  name: string;
  code: string;
  days: number;
  shifts: number;
  workedMinutes: number;
  overtimeMinutes: number;
  late: number;
  missed: number;
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
  missed: number;
  sos: number;
};

const hours = (m: number) => (m / 60).toFixed(1);

/** The month at a glance, per guard and per site, ready for payroll and billing. */
export function ReportsWorkspace({ from, to, guards, sites }: { from: string; to: string; guards: GuardReport[]; sites: SiteReport[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (f: string, t: string) => router.replace(`${pathname}?from=${f}&to=${t}`);

  const g: Column<GuardReport>[] = [
    {
      header: "Guard",
      cell: (r) => (
        <span className="block">
          <Link href={`/console/reports/guard/${r.id}?from=${from}&to=${to}`} className="block font-medium text-primary-ink hover:underline">
            {r.name}
          </Link>
          <span className="block font-mono text-xs text-muted-foreground">{r.code}</span>
        </span>
      ),
      sortValue: (r) => r.name,
      searchValue: (r) => `${r.name} ${r.code}`,
      printCell: (r) => `${r.name} (${r.code})`,
    },
    { header: "Days worked", className: "tabular-nums", cell: (r) => r.days, sortValue: (r) => r.days, total: (rs) => rs.reduce((n, r) => n + r.days, 0) },
    { header: "Shifts", className: "tabular-nums", cell: (r) => r.shifts, sortValue: (r) => r.shifts },
    { header: "Hours", className: "tabular-nums", cell: (r) => duration(r.workedMinutes), printCell: (r) => hours(r.workedMinutes), sortValue: (r) => r.workedMinutes, total: (rs) => hours(rs.reduce((n, r) => n + r.workedMinutes, 0)) },
    { header: "Overtime", className: "tabular-nums", cell: (r) => (r.overtimeMinutes ? duration(r.overtimeMinutes) : "-"), printCell: (r) => hours(r.overtimeMinutes), sortValue: (r) => r.overtimeMinutes },
    { header: "Late", className: "tabular-nums", cell: (r) => r.late || "-", sortValue: (r) => r.late },
    { header: "Missed", className: "tabular-nums", cell: (r) => (r.missed ? <span className="font-semibold text-rose-600">{r.missed}</span> : "-"), printCell: (r) => r.missed, sortValue: (r) => r.missed },
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
          <span className="block font-medium">{r.name}</span>
          {r.district && <span className="block text-xs text-muted-foreground">{r.district}</span>}
        </span>
      ),
      sortValue: (r) => r.name,
      searchValue: (r) => r.name,
      printCell: (r) => r.name,
    },
    { header: "Guards needed", className: "tabular-nums", cell: (r) => r.required ?? "-", sortValue: (r) => r.required ?? 0 },
    { header: "Days staffed", className: "tabular-nums", cell: (r) => r.daysStaffed, sortValue: (r) => r.daysStaffed },
    { header: "Different guards", className: "tabular-nums", cell: (r) => r.guards, sortValue: (r) => r.guards },
    { header: "Guard-hours", className: "tabular-nums", cell: (r) => hours(r.workedMinutes), sortValue: (r) => r.workedMinutes, total: (rs) => hours(rs.reduce((n, r) => n + r.workedMinutes, 0)) },
    { header: "Missed shifts", className: "tabular-nums", cell: (r) => r.missed || "-", sortValue: (r) => r.missed },
    { header: "SOS", className: "tabular-nums", cell: (r) => r.sos || "-", sortValue: (r) => r.sos },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-app-line bg-card p-3">
        <span className="px-1 text-sm font-medium">Period</span>
        <input type="date" value={from} max={to} onChange={(e) => e.target.value && go(e.target.value, to)} className="h-9 rounded-full bg-muted/70 px-3 text-sm ring-1 ring-border/60 outline-none" aria-label="From" />
        <span className="text-muted-foreground">to</span>
        <input type="date" value={to} min={from} onChange={(e) => e.target.value && go(from, e.target.value)} className="h-9 rounded-full bg-muted/70 px-3 text-sm ring-1 ring-border/60 outline-none" aria-label="To" />
      </div>
      <DataTable title="By guard" columns={g} data={guards} getRowKey={(r) => r.id} printTitle={`Guards ${from} to ${to}`} searchPlaceholder="Search guards…" emptyMessage="No attendance in this period." />
      <DataTable title="By site" columns={s} data={sites} getRowKey={(r) => r.id} printTitle={`Sites ${from} to ${to}`} searchPlaceholder="Search sites…" emptyMessage="No sites." />
    </div>
  );
}
