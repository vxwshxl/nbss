
import { toRing } from "@nbss/shared/geo";

import { PageHeader } from "@/components/console/page-header";
import { RouteHistory, type RouteShift } from "@/components/tracking/route-history";
import { requireRole } from "@/lib/auth";
import { istInstant } from "@/lib/roster";
import { supabaseServer } from "@/lib/supabase/server";


type Person = { full_name: string; employee_code: string };
type SiteRow = { name: string; lat: number; lng: number; geofence_radius_m: number; polygon: unknown };
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** Two weeks back, read once per request. */
function since(): string {
  return new Date(Date.now() - 14 * 86_400_000).toISOString();
}

/**
 * Every shift's path, from check-in to check-out. `?attendance=` opens one
 * (Live tracking links here), `?guard=` and `?date=` narrow the list.
 */
export async function RoutesView({
  searchParams,
  siteId,
}: {
  searchParams: Promise<{ attendance?: string; guard?: string; date?: string }>;
  /** One site's workspace shows only that site's shifts. */
  siteId?: string;
}) {
  await requireRole("admin", "supervisor");
  const { attendance, guard, date } = await searchParams;
  const supabase = await supabaseServer();

  let q = supabase
    .from("attendance")
    .select(
      "id, guard_id, check_in_at, check_out_at, worked_minutes, status, device_flag, reviewed_at, profiles!attendance_guard_id_fkey(full_name, employee_code), sites(name, lat, lng, geofence_radius_m, polygon)",
    )
    .not("check_in_at", "is", null)
    .order("check_in_at", { ascending: false })
    .limit(200);
  if (guard) q = q.eq("guard_id", guard);
  if (siteId) q = q.eq("site_id", siteId);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const from = istInstant(date, "00:00");
    q = q.gte("check_in_at", new Date(from.getTime() - 86_400_000).toISOString()).lt("check_in_at", new Date(from.getTime() + 86_400_000).toISOString());
  } else if (!attendance) {
    q = q.gte("check_in_at", since());
  }

  const [rows, guards, picked] = await Promise.all([
    q,
    supabase.from("profiles").select("id, full_name").eq("role", "guard").order("full_name"),
    attendance
      ? supabase
          .from("attendance")
          .select("id, guard_id, check_in_at, check_out_at, worked_minutes, status, device_flag, reviewed_at, profiles!attendance_guard_id_fkey(full_name, employee_code), sites(name, lat, lng, geofence_radius_m, polygon)")
          .eq("id", attendance)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const list = [...(rows.data ?? [])];
  if (picked.data && !list.some((r) => r.id === picked.data!.id)) list.unshift(picked.data);

  const shifts: RouteShift[] = list
    // A date filter is applied in IST: the query above is a day either side.
    .filter((a) => !date || new Date(a.check_in_at!).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === date || a.id === attendance)
    .map((a) => {
      const p = one(a.profiles as unknown as Person | null);
      const s = one(a.sites as unknown as SiteRow | null);
      return {
        attendanceId: a.id,
        guardId: a.guard_id,
        guardName: p?.full_name ?? "A guard",
        guardCode: p?.employee_code ?? "",
        siteName: s?.name ?? "A site",
        site: {
          name: s?.name ?? "",
          lat: s?.lat ?? 0,
          lng: s?.lng ?? 0,
          radiusM: s?.geofence_radius_m ?? 150,
          ring: (toRing(s?.polygon) as [number, number][] | null) ?? null,
        },
        checkInAt: a.check_in_at!,
        checkOutAt: a.check_out_at,
        workedMinutes: a.worked_minutes,
        status: a.status,
        // Accepted by a supervisor: no longer flagged on the list.
        deviceFlag: a.reviewed_at ? null : a.device_flag,
      };
    });

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Location tracking" title="Route history" />
      <RouteHistory
        shifts={shifts}
        guards={(guards.data ?? []).map((g) => ({ id: g.id, name: g.full_name }))}
        initial={{ attendance: attendance ?? null, guard: guard ?? null, date: date ?? null }}
      />
    </div>
  );
}
