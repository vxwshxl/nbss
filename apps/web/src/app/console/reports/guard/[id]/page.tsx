import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck, CalendarX2, Clock, Percent } from "lucide-react";

import { shiftTypeLabel } from "@nbss/shared/shifts";

import { GuardRegister, type RegisterRow } from "@/components/console/guard-register";
import { PageHeader } from "@/components/console/page-header";
import { StatCard } from "@/components/console/stat-card";
import { requireRole } from "@/lib/auth";
import { istDate, istInstant } from "@/lib/roster";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Guard attendance" };
export const dynamic = "force-dynamic";

const IST = "Asia/Kolkata";
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });

function nowMs(): number {
  return Date.now();
}

/**
 * One guard's attendance register for a period — the month so far by default.
 * Built from the roster, so a duty nobody turned up for is counted Absent rather
 * than simply missing from the list.
 */
export default async function GuardAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole("admin", "supervisor");
  const [{ id }, q] = await Promise.all([params, searchParams]);
  const today = istDate(new Date());
  const from = isDate(q.from) ? q.from! : `${today.slice(0, 8)}01`;
  const to = isDate(q.to) ? q.to! : today;
  const start = istInstant(from, "00:00").toISOString();
  const end = new Date(istInstant(to, "00:00").getTime() + 86_400_000).toISOString();

  const supabase = await supabaseServer();
  const { data: guard } = await supabase.from("profiles").select("id, full_name, employee_code, role").eq("id", id).maybeSingle();
  if (!guard) notFound();
  const { data: pinRow } = await supabase.from("staff_pins").select("pin").eq("profile_id", guard.id).maybeSingle();

  const [shifts, att] = await Promise.all([
    supabase
      .from("shifts")
      .select("id, starts_at, ends_at, status, shift_type, replaced_by_shift, replaces_shift, notes, sites(name)")
      .eq("guard_id", id)
      .gte("starts_at", start)
      .lt("starts_at", end)
      .or("status.neq.cancelled,replaced_by_shift.not.is.null")
      .order("starts_at"),
    supabase
      .from("attendance")
      .select("id, shift_id, check_in_at, check_out_at, worked_minutes, overtime_minutes, status, off_roster, device_flag, review_note, sites(name)")
      .eq("guard_id", id)
      .gte("check_in_at", start)
      .lt("check_in_at", end)
      .order("check_in_at"),
  ]);

  const now = nowMs();
  // A duty can be worked in more than one session (out for lunch and back): all of them.
  const byShift = new Map<string, NonNullable<typeof att.data>>();
  for (const a of att.data ?? []) if (a.shift_id) byShift.set(a.shift_id, [...(byShift.get(a.shift_id) ?? []), a]);
  const used = new Set<string>();

  const rows: RegisterRow[] = (shifts.data ?? []).map((s) => {
    const sessions = byShift.get(s.id) ?? [];
    for (const x of sessions) used.add(x.id);
    const first = sessions[0] ?? null;
    const open = sessions.some((x) => !x.check_out_at);
    const a = first
      ? {
          ...first,
          check_out_at: open ? null : (sessions.at(-1)!.check_out_at ?? null),
          worked_minutes: sessions.reduce((n, x) => n + (x.worked_minutes ?? 0), 0),
          overtime_minutes: sessions.reduce((n, x) => n + (x.overtime_minutes ?? 0), 0),
        }
      : null;
    const site = one(s.sites as unknown as { name: string } | null)?.name ?? "A site";
    const window = `${shiftTypeLabel(s.shift_type) ? `${shiftTypeLabel(s.shift_type)} · ` : ""}${clock(s.starts_at)}–${clock(s.ends_at)}`;
    let status: RegisterRow["status"];
    if (s.replaced_by_shift && !a) status = "replaced";
    else if (a) status = !a.check_out_at ? "on_duty" : (a.status as RegisterRow["status"]);
    else if (new Date(s.ends_at).getTime() < now) status = "absent";
    else if (new Date(s.starts_at).getTime() <= now) status = "not_arrived";
    else status = "upcoming";
    const notes = [
      s.replaces_shift ? (s.notes ?? "Covering a colleague") : null,
      s.replaced_by_shift && !a ? "Handed to another guard" : null,
      a?.device_flag ? (a.device_flag === "shared_device" ? "Another guard's phone" : "Unapproved phone") : null,
      a?.review_note && a.status !== "present" ? a.review_note : null,
      sessions.length > 1 ? `${sessions.length} sessions: ${sessions.map((x) => `${clock(x.check_in_at!)}–${x.check_out_at ? clock(x.check_out_at) : "now"}`).join(", ")}` : null,
    ].filter(Boolean);
    return {
      key: s.id,
      date: istDate(new Date(s.starts_at)),
      dateLabel: dayLabel(s.starts_at),
      site,
      shift: window,
      status,
      checkIn: a?.check_in_at ? clock(a.check_in_at) : null,
      checkOut: a?.check_out_at ? clock(a.check_out_at) : null,
      workedMinutes: a?.worked_minutes ?? null,
      overtimeMinutes: a?.overtime_minutes ?? null,
      note: notes.join(" · "),
      attendanceId: a?.id ?? null,
    };
  });

  // Check-ins that were not against a rostered duty (off-roster, or before a roster existed).
  for (const a of att.data ?? []) {
    if (used.has(a.id) || !a.check_in_at) continue;
    rows.push({
      key: a.id,
      date: istDate(new Date(a.check_in_at)),
      dateLabel: dayLabel(a.check_in_at),
      site: one(a.sites as unknown as { name: string } | null)?.name ?? "A site",
      shift: "Not on the roster",
      status: !a.check_out_at ? "on_duty" : (a.status as RegisterRow["status"]),
      checkIn: clock(a.check_in_at),
      checkOut: a.check_out_at ? clock(a.check_out_at) : null,
      workedMinutes: a.worked_minutes,
      overtimeMinutes: a.overtime_minutes,
      note: [a.off_roster ? "Off-roster check-in" : null, a.device_flag ? "Phone flagged" : null].filter(Boolean).join(" · "),
      attendanceId: a.id,
    });
  }
  rows.sort((x, y) => x.date.localeCompare(y.date) || (x.checkIn ?? "").localeCompare(y.checkIn ?? ""));

  const due = rows.filter((r) => r.status !== "upcoming" && r.status !== "replaced" && r.shift !== "Not on the roster");
  const present = rows.filter((r) => r.status === "present" || r.status === "late" || r.status === "on_duty" || r.status === "pending_review").length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const late = rows.filter((r) => r.status === "late").length;
  const minutes = rows.reduce((n, r) => n + (r.workedMinutes ?? 0), 0);
  const rate = due.length ? Math.round((due.filter((r) => r.status !== "absent" && r.status !== "not_arrived").length / due.length) * 100) : null;

  return (
    <div className="space-y-6">
      <Link href="/console/reports" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Reports
      </Link>
      <PageHeader
        eyebrow="Attendance"
        title={guard.full_name}
        action={
          <div className="flex gap-2">
            <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm">
              <span className="mr-2 text-[11px] font-bold tracking-widest text-emerald-700 uppercase">Code</span>
              <span className="font-mono font-bold">{guard.employee_code}</span>
            </span>
            <span className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm">
              <span className="mr-2 text-[11px] font-bold tracking-widest text-violet-700 uppercase">PIN</span>
              <span className="font-mono font-bold tracking-[0.25em]">{pinRow?.pin ?? "-"}</span>
            </span>
          </div>
        }
      />
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Present" value={String(present)} hint={`${late} late`} icon={CalendarCheck} tone="emerald" />
        <StatCard label="Absent" value={String(absent)} hint="Rostered, no check-in" icon={CalendarX2} tone={absent ? "rose" : "slate"} />
        <StatCard label="Hours" value={(minutes / 60).toFixed(1)} hint={`${from} to ${to}`} icon={Clock} tone="sky" />
        <StatCard label="Attendance" value={rate === null ? "-" : `${rate}%`} hint={`${due.length} duties due`} icon={Percent} tone="violet" />
      </div>
      <GuardRegister guardName={guard.full_name} from={from} to={to} rows={rows} />
    </div>
  );
}
