"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, List } from "lucide-react";

import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { PeriodBar } from "@/components/console/period-bar";
import { Legend, OUTCOME, RANK } from "@/components/console/attendance-key";
import type { Outcome } from "@/lib/attendance-register";
import { duration } from "@/lib/tracking";
import { cn } from "@/lib/utils";

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
export function GuardRegister({ guardName, from, to, today, rows }: { guardName: string; from: string; to: string; today: string; rows: RegisterRow[] }) {
  const [view, setView] = useState<"calendar" | "list">("calendar");
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
      <nav className="mx-auto flex w-fit gap-1.5 rounded-full border border-app-line bg-card p-1 shadow-e1" aria-label="Register view">
        {VIEWS.map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            aria-pressed={view === key}
            className={cn(
              "press inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              view === key ? "bg-[#009164] text-white shadow-[0_2px_0_#006b4a]" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </nav>
      {view === "calendar" ? (
        <RegisterCalendar from={from} to={to} today={today} rows={rows} />
      ) : (
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
      )}
    </div>
  );
}

const VIEWS = [
  ["calendar", "Calendar", CalendarDays],
  ["list", "List", List],
] as const;
const OFF_ROSTER = "Not on the roster";
const CAME: Outcome[] = ["present", "late", "on_duty", "review", "off_roster"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TINT: Partial<Record<Outcome, string>> = {
  present: "border-emerald-200 bg-emerald-50/60",
  late: "border-amber-200 bg-amber-50/60",
  absent: "border-rose-200 bg-rose-50/70",
  not_arrived: "border-rose-200 bg-rose-50/40",
  on_duty: "border-sky-200 bg-sky-50/60",
  review: "border-violet-200 bg-violet-50/60",
  off_roster: "border-teal-200 bg-teal-50/60",
};

/** A register row in the month grid's terms, so both pages share one key. */
function outcomeOf(r: RegisterRow): Outcome {
  if (r.shift === OFF_ROSTER && r.status !== "on_duty") return "off_roster";
  if (r.status === "pending_review" || r.status === "rejected") return "review";
  return r.status;
}

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * The period as calendar months, a tile per day: the day's mark in the month grid's colours,
 * where the guard was, when they came and left, and the hours worked. A day with more than
 * one duty shows the worst of them, but never Absent when the guard came that day.
 */
function RegisterCalendar({ from, to, today, rows }: { from: string; to: string; today: string; rows: RegisterRow[] }) {
  const byDay = new Map<string, RegisterRow[]>();
  for (const r of rows) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);
  const inPeriod = (d: string) => d >= from && d <= to;

  const months: string[] = [];
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); ) {
    months.push(m);
    const [y, mo] = m.split("-").map(Number) as [number, number];
    m = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
  }

  return (
    <div className="space-y-5">
      {months.map((month) => {
        const [y, mo] = month.split("-").map(Number) as [number, number];
        const first = `${month}-01`;
        const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
        const days = Array.from({ length: new Date(Date.UTC(y, mo, 0)).getUTCDate() }, (_, i) => addDays(first, i));
        const mine = rows.filter((r) => r.date.startsWith(month) && inPeriod(r.date));
        const came = new Set(mine.filter((r) => CAME.includes(outcomeOf(r))).map((r) => r.date));
        const late = new Set(mine.filter((r) => r.status === "late").map((r) => r.date)).size;
        const absent = new Set(mine.filter((r) => r.status === "absent" && !came.has(r.date)).map((r) => r.date)).size;
        const minutes = mine.reduce((n, r) => n + (r.workedMinutes ?? 0), 0);
        return (
          <section key={month} className="rounded-3xl border border-app-line bg-card p-4 shadow-e1 sm:p-5">
            <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-bold">{new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</h3>
              <div className="flex flex-wrap gap-1.5 text-xs font-semibold tabular-nums">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{came.size} present</span>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{late} late</span>
                <span className={cn("rounded-full px-2.5 py-1", absent ? "bg-rose-50 text-rose-700" : "bg-muted text-muted-foreground")}>{absent} absent</span>
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">{duration(minutes)}</span>
              </div>
            </header>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {WEEKDAYS.map((w) => (
                <span key={w} className="pb-1 text-center text-[10px] font-semibold tracking-wider text-muted-foreground uppercase sm:text-xs">
                  {w}
                </span>
              ))}
              {Array.from({ length: lead }, (_, i) => (
                <span key={`lead-${i}`} />
              ))}
              {days.map((d) => (
                <DayTile key={d} day={d} today={d === today} outside={!inPeriod(d)} list={inPeriod(d) ? (byDay.get(d) ?? []) : []} />
              ))}
            </div>
          </section>
        );
      })}
      <Legend />
    </div>
  );
}

function DayTile({ day, today, outside, list }: { day: string; today: boolean; outside: boolean; list: RegisterRow[] }) {
  const attended = list.filter((r) => CAME.includes(outcomeOf(r)));
  const pool = attended.length ? attended : list;
  const worst = pool.length ? RANK.find((o) => pool.some((r) => outcomeOf(r) === o))! : null;
  const sites = [...new Set(list.map((r) => r.site))];
  const firstIn = attended.find((r) => r.checkIn)?.checkIn ?? null;
  const lastOut = attended.at(-1)?.checkOut ?? null;
  const minutes = list.reduce((n, r) => n + (r.workedMinutes ?? 0), 0);
  const duty = list[0] && list[0].shift !== OFF_ROSTER ? list[0].shift : null;
  const detail = list.map((r) => `${r.site}: ${OUTCOME[outcomeOf(r)].label}${r.checkIn ? ` · in ${r.checkIn}` : ""}${r.checkOut ? ` · out ${r.checkOut}` : ""}${r.note ? ` · ${r.note}` : ""}`);

  return (
    <div
      title={detail.join("\n") || undefined}
      className={cn(
        "flex min-h-14 flex-col rounded-xl border p-1.5 sm:min-h-28 sm:p-2.5",
        outside ? "border-transparent bg-muted/20 opacity-50" : worst ? (TINT[worst] ?? "border-app-line-soft bg-card") : "border-app-line-soft bg-muted/30",
        today && "ring-2 ring-emerald-500 ring-offset-1 ring-offset-card",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span className={cn("text-xs font-bold tabular-nums sm:text-sm", today ? "text-emerald-700" : worst ? "text-foreground" : "text-muted-foreground")}>{Number(day.slice(8))}</span>
        {worst && <span className={cn("grid size-5 place-items-center rounded-md text-[10px] font-bold sm:size-6 sm:text-[11px]", OUTCOME[worst].cell)}>{OUTCOME[worst].letter}</span>}
      </div>
      {worst && (
        <div className="mt-auto hidden min-w-0 space-y-0.5 pt-1.5 text-[11px] leading-tight sm:block">
          <span className="block font-semibold">{OUTCOME[worst].label}</span>
          <span className="block truncate text-muted-foreground">{sites.join(", ")}</span>
          {firstIn ? (
            <span className="block truncate tabular-nums">
              {firstIn}
              {lastOut ? `–${lastOut}` : " · now"}
            </span>
          ) : (
            duty && <span className="block truncate text-muted-foreground tabular-nums">{duty}</span>
          )}
          {minutes > 0 && <span className="block font-semibold text-sky-700 tabular-nums">{duration(minutes)}</span>}
        </div>
      )}
    </div>
  );
}
