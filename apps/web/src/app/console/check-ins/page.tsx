import type { Metadata } from "next";

import { CheckInsLog, type CheckInRow, type LogView } from "@/components/console/check-ins-log";
import { PageHeader } from "@/components/console/page-header";
import { requireRoleSession } from "@/lib/auth";
import { istDay, istInstant } from "@/lib/roster";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Check-in log" };
export const dynamic = "force-dynamic";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** The IST bounds of a day (YYYY-MM-DD), month (YYYY-MM) or year (YYYY). */
function bounds(view: LogView, at: string): { from: Date; to: Date } {
  if (view === "year") {
    const y = Number(at.slice(0, 4));
    return { from: istInstant(`${y}-01-01`, "00:00"), to: istInstant(`${y + 1}-01-01`, "00:00") };
  }
  if (view === "month") {
    const [y, m] = at.split("-").map(Number) as [number, number];
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    return { from: istInstant(`${y}-${String(m).padStart(2, "0")}-01`, "00:00"), to: istInstant(next, "00:00") };
  }
  const from = istInstant(at, "00:00");
  return { from, to: new Date(from.getTime() + 86_400_000) };
}

/**
 * Every check-in and check-out, as rows: who, where, when they came and went, and how
 * each happened (the guard in the app inside the fence, a supervisor, or the automatic
 * close at the end of a shift). A day by default; a month or a year to look back.
 */
export default async function CheckInsPage({ searchParams }: { searchParams: Promise<{ view?: string; at?: string }> }) {
  const session = await requireRoleSession("admin", "supervisor");
  const { view: v, at: a } = await searchParams;
  const view: LogView = v === "month" || v === "year" ? v : "day";
  const today = istDay(0);
  const at =
    view === "year"
      ? /^\d{4}$/.test(a ?? "") ? a! : today.slice(0, 4)
      : view === "month"
        ? /^\d{4}-\d{2}$/.test(a ?? "") ? a! : today.slice(0, 7)
        : /^\d{4}-\d{2}-\d{2}$/.test(a ?? "") ? a! : today;
  const { from, to } = bounds(view, at);

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("attendance")
    .select(
      "id, guard_id, check_in_at, check_out_at, check_in_method, check_out_method, check_in_distance_m, check_out_distance_m, worked_minutes, overtime_minutes, status, off_roster, device_flag, device_id, profiles!attendance_guard_id_fkey(full_name, employee_code), sites(name)",
    )
    .gte("check_in_at", from.toISOString())
    .lt("check_in_at", to.toISOString())
    .order("check_in_at", { ascending: false })
    .limit(5000);

  const list = data ?? [];
  const deviceIds = [...new Set(list.map((r) => r.device_id).filter((d): d is string => !!d))];
  const { data: phones } = deviceIds.length
    ? await supabase.from("guard_devices").select("profile_id, device_id, brand, model").in("device_id", deviceIds)
    : { data: [] };

  const rows: CheckInRow[] = list
    .filter((r) => r.check_in_at)
    .map((r) => {
      const g = one(r.profiles as unknown as { full_name: string; employee_code: string } | null);
      const phone =
        (phones ?? []).find((p) => p.device_id === r.device_id && p.profile_id === r.guard_id) ?? (phones ?? []).find((p) => p.device_id === r.device_id);
      return {
        id: r.id,
        guardName: g?.full_name ?? "A guard",
        guardCode: g?.employee_code ?? "",
        siteName: one(r.sites as unknown as { name: string } | null)?.name ?? "A site",
        checkInAt: r.check_in_at!,
        checkOutAt: r.check_out_at,
        inMethod: r.check_in_method,
        outMethod: r.check_out_method,
        inDistance: r.check_in_distance_m,
        outDistance: r.check_out_distance_m,
        workedMinutes: r.worked_minutes,
        overtimeMinutes: r.overtime_minutes,
        status: r.status,
        offRoster: r.off_roster,
        deviceFlag: r.device_flag,
        phone: phone ? [phone.brand, phone.model].filter(Boolean).join(" ") || "Unknown phone" : null,
      };
    });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Attendance" title="Check-in log" />
      <CheckInsLog view={view} at={at} today={today} rows={rows} canReview={!session.impersonating} capped={list.length >= 5000} />
    </div>
  );
}
