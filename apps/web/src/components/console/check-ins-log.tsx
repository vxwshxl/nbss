"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LogIn, LogOut, Radio, Timer, TimerOff, UserCog } from "lucide-react";

import { AttendancePreviewDialog } from "@/components/console/attendance-preview";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";

export type LogView = "day" | "month" | "year";

export type CheckInRow = {
  id: string;
  guardName: string;
  guardCode: string;
  siteName: string;
  checkInAt: string;
  checkOutAt: string | null;
  inMethod: string;
  outMethod: string | null;
  inDistance: number | null;
  outDistance: number | null;
  workedMinutes: number | null;
  overtimeMinutes: number | null;
  status: string;
  offRoster: boolean;
  deviceFlag: string | null;
  phone: string | null;
};

const IST = "Asia/Kolkata";
const VIEWS: { key: LogView; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

/** How a check-in happened. */
const IN_HOW: Record<string, string> = {
  geofence: "Guard, in the app",
  supervisor_override: "By a supervisor",
  auto_close: "Automatic",
};

/** How a check-out happened, and its tone. */
function outHow(r: CheckInRow): { label: string; tone: string } {
  if (!r.checkOutAt) return { label: "Still on duty", tone: "text-emerald-700" };
  if (r.outMethod === "auto_close") return { label: "Automatic, end of shift", tone: "text-amber-700" };
  if (r.outMethod === "supervisor_override") return { label: "Closed by a supervisor", tone: "text-violet-700" };
  return { label: "Guard, in the app", tone: "text-muted-foreground" };
}

const STATUS_LABEL: Record<string, string> = { present: "Present", late: "Late", absent: "Absent", pending_review: "Needs review", rejected: "Rejected" };

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST });
}
function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: IST });
}
function hours(min: number | null): string {
  if (min == null) return "-";
  const h = Math.floor(min / 60);
  return h ? `${h}h ${String(min % 60).padStart(2, "0")}m` : `${min}m`;
}

/** The period before or after `at`, in the same view. */
function step(view: LogView, at: string, by: number): string {
  if (view === "year") return String(Number(at) + by);
  if (view === "month") {
    const [y, m] = at.split("-").map(Number) as [number, number];
    const d = new Date(Date.UTC(y, m - 1 + by, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return new Date(Date.parse(`${at}T12:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10);
}

function title(view: LogView, at: string, today: string): string {
  if (view === "year") return at;
  if (view === "month") return new Date(`${at}-15T12:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: IST });
  const label = new Date(`${at}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: IST });
  return at === today ? `Today · ${label}` : label;
}

/**
 * Every check-in and check-out in a day, month or year, one row each: who, where, when
 * they came and went, how each happened, the hours, and the phone. A row opens the punch.
 */
export function CheckInsLog({
  view,
  at,
  today,
  rows,
  canReview,
  capped,
}: {
  view: LogView;
  at: string;
  today: string;
  rows: CheckInRow[];
  canReview: boolean;
  /** The period held more rows than one page loads. */
  capped: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [openId, setOpenId] = useState<string | null>(null);
  const go = (v: LogView, a: string) => router.push(`${pathname}?view=${v}&at=${a}`);
  const current = view === "year" ? today.slice(0, 4) : view === "month" ? today.slice(0, 7) : today;
  const next = step(view, at, 1);

  const onDuty = rows.filter((r) => !r.checkOutAt).length;
  const byGuard = rows.filter((r) => r.checkOutAt && r.outMethod === "geofence").length;
  const auto = rows.filter((r) => r.outMethod === "auto_close").length;
  const bySupervisor = rows.filter((r) => r.outMethod === "supervisor_override" || r.inMethod === "supervisor_override").length;
  const late = rows.filter((r) => r.status === "late").length;

  const columns: Column<CheckInRow>[] = [
    {
      header: "Guard",
      cell: (r) => (
        <span className="block">
          <span className="block font-medium">{r.guardName}</span>
          <span className="block font-mono text-xs text-muted-foreground">{r.guardCode}</span>
        </span>
      ),
      sortValue: (r) => r.guardName,
      searchValue: (r) => `${r.guardName} ${r.guardCode} ${r.siteName} ${r.phone ?? ""}`,
    },
    { header: "Site", cell: (r) => r.siteName, sortValue: (r) => r.siteName },
    ...(view === "day" ? [] : [{ header: "Date", cell: (r: CheckInRow) => <span className="tabular-nums">{day(r.checkInAt)}</span>, sortValue: (r: CheckInRow) => r.checkInAt }]),
    {
      header: "Checked in",
      cell: (r) => (
        <span className="block">
          <span className="flex items-center gap-1.5 font-medium tabular-nums">
            <LogIn className="size-3.5 text-emerald-600" /> {clock(r.checkInAt)}
          </span>
          <span className="block text-xs text-muted-foreground">
            {IN_HOW[r.inMethod] ?? r.inMethod}
            {r.inDistance != null ? ` · ${Math.round(r.inDistance)} m from centre` : ""}
          </span>
        </span>
      ),
      sortValue: (r) => r.checkInAt,
      printCell: (r) => `${clock(r.checkInAt)} (${IN_HOW[r.inMethod] ?? r.inMethod})`,
    },
    {
      header: "Checked out",
      cell: (r) => {
        const how = outHow(r);
        return (
          <span className="block">
            <span className="flex items-center gap-1.5 font-medium tabular-nums">
              <LogOut className="size-3.5 text-slate-500" /> {r.checkOutAt ? clock(r.checkOutAt) : "-"}
            </span>
            <span className={cn("block text-xs", how.tone)}>{how.label}</span>
          </span>
        );
      },
      sortValue: (r) => r.checkOutAt ?? "9999",
      printCell: (r) => (r.checkOutAt ? `${clock(r.checkOutAt)} (${outHow(r).label})` : "Still on duty"),
    },
    {
      header: "Worked",
      cell: (r) => (
        <span className="block tabular-nums">
          {hours(r.workedMinutes)}
          {r.overtimeMinutes ? <span className="block text-xs text-violet-700">+{hours(r.overtimeMinutes)} overtime</span> : null}
        </span>
      ),
      sortValue: (r) => r.workedMinutes ?? -1,
    },
    {
      header: "Status",
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-1">
          <StatusPill status={r.status} label={STATUS_LABEL[r.status] ?? r.status} />
          {r.offRoster && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Off roster</span>}
          {r.deviceFlag && <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-700">{r.deviceFlag === "shared_device" ? "Another's phone" : "New phone"}</span>}
        </span>
      ),
      sortValue: (r) => r.status,
      printCell: (r) => STATUS_LABEL[r.status] ?? r.status,
    },
    { header: "Phone", cell: (r) => <span className="text-xs text-muted-foreground">{r.phone ?? "-"}</span>, sortValue: (r) => r.phone ?? "" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-app-line bg-card p-3 shadow-e1 sm:flex-row sm:items-center sm:justify-between">
        <div role="radiogroup" aria-label="Period" className="inline-flex self-start rounded-full bg-muted/70 p-1 ring-1 ring-border/60">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              role="radio"
              aria-checked={view === v.key}
              onClick={() => go(v.key, v.key === "year" ? at.slice(0, 4) : v.key === "month" ? (at.length >= 7 ? at.slice(0, 7) : `${at}-${today.slice(5, 7)}`) : at.length === 10 ? at : today)}
              className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition-colors", view === v.key ? "bg-background shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => go(view, step(view, at, -1))} aria-label="Earlier" className="grid size-9 place-items-center rounded-full ring-1 ring-border hover:bg-muted">
            <ChevronLeft className="size-4" />
          </button>
          <p className="min-w-0 text-center text-sm font-semibold sm:min-w-64">{title(view, at, today)}</p>
          <button
            type="button"
            onClick={() => go(view, next)}
            disabled={next > current}
            aria-label="Later"
            className="grid size-9 place-items-center rounded-full ring-1 ring-border hover:bg-muted disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
          {at !== current && (
            <button type="button" onClick={() => go(view, current)} className="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-muted">
              {view === "day" ? "Today" : view === "month" ? "This month" : "This year"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Count icon={LogIn} label="Check-ins" value={rows.length} tone="text-foreground" />
        <Count icon={Radio} label="Still on duty" value={onDuty} tone="text-emerald-700" />
        <Count icon={LogOut} label="Out in the app" value={byGuard} tone="text-slate-700" />
        <Count icon={TimerOff} label="Automatic out" value={auto} tone="text-amber-700" />
        <Count icon={UserCog} label="By a supervisor" value={bySupervisor} tone="text-violet-700" />
        <Count icon={Timer} label="Late" value={late} tone="text-rose-700" />
      </div>

      {capped && <p className="text-sm text-amber-800">This period has more check-ins than one page loads; the latest 5,000 are shown.</p>}

      <DataTable
        title={`${rows.length} check-in${rows.length === 1 ? "" : "s"}`}
        columns={columns}
        data={rows}
        getRowKey={(r) => r.id}
        printTitle={`Check-in log · ${title(view, at, today)}`}
        searchPlaceholder="Search by guard, code, site or phone…"
        emptyMessage="Nobody checked in during this period."
        onRowClick={(r) => setOpenId(r.id)}
        initialPageSize={25}
      />

      <AttendancePreviewDialog id={openId} onClose={() => setOpenId(null)} canReview={canReview} staff />
    </div>
  );
}

function Count({ icon: Icon, label, value, tone }: { icon: typeof LogIn; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-app-line bg-card p-3.5 shadow-e1">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone)}>{value}</p>
    </div>
  );
}
