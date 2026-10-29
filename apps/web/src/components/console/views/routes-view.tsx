
import { toRing } from "@nbss/shared/geo";

import { PageHeader } from "@/components/console/page-header";
import { RouteHistory, type RouteShift } from "@/components/tracking/route-history";
import { requireRole } from "@/lib/auth";
import { istToday } from "@/lib/format";
import { istInstant } from "@/lib/roster";
import type { LivePosition } from "@nbss/shared/realtime";
import { supabaseServer } from "@/lib/supabase/server";


type Person = { full_name: string; employee_code: string; phone: string | null };
type SiteRow = { name: string; lat: number; lng: number; geofence_radius_m: number; polygon: unknown; shift_start: string | null; shift_end: string | null };
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** Two weeks back, read once per request. */
function since(): string {
  return new Date(Date.now() - 14 * 86_400_000).toISOString();
}

/**
 * Every shift's path, from check-in to check-out. `?attendance=` opens one
 * (Live tracking links here), `?guard=` and `?date=` narrow the list. With no
 * date the list is today's (IST); `?date=any` is the last two weeks.
 */
export async function RoutesView({
  searchParams,
  siteId,
}: {
  searchParams: Promise<{ attendance?: string; guard?: string; date?: string; site?: string }>;
  /** One site's workspace shows only that site's shifts. */
  siteId?: string;
}) {
  await requireRole("admin", "supervisor");
  const { attendance, guard, date: asked, site } = await searchParams;
  // Today by default; "any" lifts the day. A shift opened by link is shown on any day.
  const date = asked === "any" ? undefined : asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : attendance ? undefined : istToday();
  // A site's own workspace is fixed to it; otherwise the page's site picker.
  const onlySite = siteId ?? (site && /^[0-9a-f-]{36}$/i.test(site) ? site : undefined);
  const supabase = await supabaseServer();

  let q = supabase
    .from("attendance")
    .select(
      "id, guard_id, site_id, device_id, check_in_at, check_out_at, worked_minutes, status, device_flag, reviewed_at, profiles!attendance_guard_id_fkey(full_name, employee_code, phone), sites(name, lat, lng, geofence_radius_m, polygon, shift_start, shift_end), shifts!attendance_shift_id_fkey(starts_at, ends_at)",
    )
    .not("check_in_at", "is", null)
    .order("check_in_at", { ascending: false })
    .limit(200);
  if (guard) q = q.eq("guard_id", guard);
  if (onlySite) q = q.eq("site_id", onlySite);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const from = istInstant(date, "00:00");
    q = q.gte("check_in_at", new Date(from.getTime() - 86_400_000).toISOString()).lt("check_in_at", new Date(from.getTime() + 86_400_000).toISOString());
  } else if (!attendance) {
    q = q.gte("check_in_at", since());
  }

  const [rows, guards, sites, picked] = await Promise.all([
    q,
    supabase.from("profiles").select("id, full_name").eq("role", "guard").order("full_name"),
    supabase.from("sites").select("id, name").eq("active", true).order("name"),
    attendance
      ? supabase
          .from("attendance")
          .select("id, guard_id, site_id, device_id, check_in_at, check_out_at, worked_minutes, status, device_flag, reviewed_at, profiles!attendance_guard_id_fkey(full_name, employee_code, phone), sites(name, lat, lng, geofence_radius_m, polygon, shift_start, shift_end), shifts!attendance_shift_id_fkey(starts_at, ends_at)")
          .eq("id", attendance)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const list = [...(rows.data ?? [])];
  if (picked.data && !list.some((r) => r.id === picked.data!.id)) list.unshift(picked.data);

  // The phone each punch came from, for the summary; and, for shifts still open, what it says now.
  const guardIds = [...new Set(list.map((a) => a.guard_id))];
  const openGuards = [...new Set(list.filter((a) => !a.check_out_at).map((a) => a.guard_id))];
  const [{ data: phones }, { data: positionRows }] = await Promise.all([
    guardIds.length
      ? supabase.from("guard_devices").select("profile_id, device_id, brand, model, app_version").in("profile_id", guardIds).order("last_seen_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    openGuards.length ? supabase.from("guard_positions").select("*").in("guard_id", openGuards) : Promise.resolve({ data: [] }),
  ]);
  const positions = new Map(((positionRows ?? []) as unknown as LivePosition[]).map((p) => [p.guard_id, p]));

  const shifts: RouteShift[] = list
    // A date filter is applied in IST: the query above is a day either side.
    .filter((a) => !date || new Date(a.check_in_at!).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === date || a.id === attendance)
    .map((a) => {
      const p = one(a.profiles as unknown as Person | null);
      const s = one(a.sites as unknown as SiteRow | null);
      const shift = one(a.shifts as unknown as { starts_at: string; ends_at: string } | null);
      const d =
        (phones ?? []).find((x) => x.profile_id === a.guard_id && x.device_id === a.device_id) ??
        (phones ?? []).find((x) => x.profile_id === a.guard_id) ??
        null;
      return {
        attendanceId: a.id,
        guardId: a.guard_id,
        guardName: p?.full_name ?? "A guard",
        guardCode: p?.employee_code ?? "",
        phone: p?.phone ?? null,
        siteId: a.site_id,
        siteName: s?.name ?? "A site",
        // The rostered shift this punch answered, else the site's daily window.
        duty: shift
          ? { kind: "shift" as const, start: shift.starts_at, end: shift.ends_at }
          : s?.shift_start && s.shift_end
            ? { kind: "site" as const, start: s.shift_start, end: s.shift_end }
            : null,
        device: d ? { label: [d.brand, d.model].filter(Boolean).join(" ") || "Unknown phone", appVersion: d.app_version } : null,
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
        position: a.check_out_at ? null : (positions.get(a.guard_id) ?? null),
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
        sites={siteId ? [] : (sites.data ?? [])}
        initial={{ attendance: attendance ?? null, guard: guard ?? null, date: date ?? null, site: onlySite ?? null }}
      />
    </div>
  );
}
