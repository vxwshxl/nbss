import Link from "next/link";
import { CalendarCheck, CalendarDays, CalendarX2, ChevronLeft, ChevronRight, Clock, Grid3x3, List, Percent, Users } from "lucide-react";

import { DayList, GuardCards, Legend, MonthGrid } from "@/components/console/attendance-views";
import { PageHeader } from "@/components/console/page-header";
import { StatCard } from "@/components/console/stat-card";
import { registerBetween, tallyRegister } from "@/lib/attendance-register";
import { istDate } from "@/lib/roster";
import { supabaseServer } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type View = "month" | "guards" | "day" | "punches";
const VIEWS: { key: View; label: string; icon: typeof Grid3x3 }[] = [
  { key: "month", label: "Month", icon: Grid3x3 },
  { key: "guards", label: "By guard", icon: Users },
  { key: "day", label: "By day", icon: CalendarDays },
  { key: "punches", label: "Punches", icon: List },
];

/** The request's clock, read once. */
function nowMs(): number {
  return Date.now();
}

export function ViewTabs({ view, keep = "" }: { view: View; keep?: string }) {
  return (
    <nav className="flex flex-wrap justify-center gap-1.5 rounded-full border border-app-line bg-card p-1 shadow-e1 sm:w-fit" aria-label="Attendance view">
      {VIEWS.map((v) => (
        <Link
          key={v.key}
          href={`/console/attendance?view=${v.key}${keep}`}
          className={cn(
            "press inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
            v.key === view ? "bg-[#009164] text-white shadow-[0_2px_0_#006b4a]" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <v.icon className="size-4" /> {v.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Attendance for the office, four ways: the month as a register grid (a row per guard,
 * a coloured letter per duty), each guard's month as a card, one day's duties, or every
 * punch. Built from the roster, so a duty nobody came to is Absent, not just missing.
 */
export async function AttendanceViews({ view: raw, month: m, date: d, siteId }: { view?: string; month?: string; date?: string; siteId?: string }) {
  const view: View = (["month", "guards", "day"] as const).find((v) => v === raw) ?? "month";
  const today = istDate(new Date());
  const month = /^\d{4}-\d{2}$/.test(m ?? "") ? m! : today.slice(0, 7);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d ?? "") ? d! : today;
  const [y, mo] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const days = Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const shift = (n: number) => {
    const t = new Date(Date.UTC(y, mo - 1 + n, 1));
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const dayShift = (n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const site = siteId ? `&site=${siteId}` : "";

  const supabase = await supabaseServer();
  const [from, to] = view === "day" ? [date, date] : [`${month}-01`, days.at(-1)!];
  const rows = await registerBetween(supabase, from, to, { siteId, now: nowMs() });
  const t = tallyRegister(rows);
  const monthName = new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  const dayName = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  const stepper =
    view === "day" ? (
      <Stepper prev={`?view=day&date=${dayShift(-1)}${site}`} next={date < today ? `?view=day&date=${dayShift(1)}${site}` : null} label={dayName} />
    ) : (
      <Stepper prev={`?view=${view}&month=${shift(-1)}${site}`} next={month < today.slice(0, 7) ? `?view=${view}&month=${shift(1)}${site}` : null} label={monthName} />
    );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operations" title="Attendance" />
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <ViewTabs view={view} keep={site} />
        {stepper}
      </div>
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Present" value={String(t.present)} hint={`${t.late} late`} icon={CalendarCheck} tone="emerald" />
        <StatCard label="Absent" value={String(t.absent)} hint="Rostered, no check-in" icon={CalendarX2} tone={t.absent ? "rose" : "slate"} />
        <StatCard label="Hours" value={(t.minutes / 60).toFixed(1)} hint={view === "day" ? dayName : monthName} icon={Clock} tone="sky" />
        <StatCard label="Attendance" value={t.rate == null ? "-" : `${t.rate}%`} hint={`${t.due} duties due`} icon={Percent} tone="violet" />
      </div>
      <section className="overflow-hidden rounded-2xl border border-app-line bg-card p-4 shadow-e1">
        {view === "month" && (
          <div className="space-y-4">
            <MonthGrid rows={rows} days={days} today={today} />
            <Legend />
          </div>
        )}
        {view === "guards" && <GuardCards rows={rows} />}
        {view === "day" && <DayList rows={rows} />}
      </section>
    </div>
  );
}

function Stepper({ prev, next, label }: { prev: string; next: string | null; label: string }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-app-line bg-card p-1 shadow-e1">
      <Link href={prev} aria-label="Earlier" className="grid size-8 place-items-center rounded-full hover:bg-muted">
        <ChevronLeft className="size-4" />
      </Link>
      <span className="min-w-40 text-center text-sm font-semibold">{label}</span>
      {next ? (
        <Link href={next} aria-label="Later" className="grid size-8 place-items-center rounded-full hover:bg-muted">
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className="grid size-8 place-items-center opacity-30">
          <ChevronRight className="size-4" />
        </span>
      )}
    </div>
  );
}
