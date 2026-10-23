import type { Metadata } from "next";
import { AlertTriangle, MapPinOff, ShieldCheck, Smartphone } from "lucide-react";

import { PageHeader } from "@/components/console/page-header";
import { DevicesWorkspace, type DeviceRow, type FlaggedPunch } from "@/components/console/devices-workspace";
import { StatCard } from "@/components/console/stat-card";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Devices" };
export const dynamic = "force-dynamic";

type Person = { full_name: string; employee_code: string; role: string };
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** Which phone each guard uses, so a guard cannot be checked in from someone else's. */
export default async function DevicesPage() {
  await requireRole("admin", "supervisor");
  const supabase = await supabaseServer();

  const [devices, flagged] = await Promise.all([
    supabase
      .from("guard_devices")
      .select("id, profile_id, device_id, platform, brand, model, os_version, app_version, status, battery, charging, location_permission, gps_enabled, battery_optimized, first_seen_at, last_seen_at, profiles!guard_devices_profile_id_fkey(full_name, employee_code, role)")
      .order("last_seen_at", { ascending: false }),
    supabase
      .from("attendance")
      .select("id, check_in_at, device_flag, device_id, profiles!attendance_guard_id_fkey(full_name), sites(name)")
      .not("device_flag", "is", null)
      .eq("status", "pending_review")
      .order("check_in_at", { ascending: false })
      .limit(100),
  ]);

  const all = (devices.data ?? []).filter((d) => one(d.profiles as unknown as Person | null)?.role === "guard");
  const byDevice = new Map<string, string[]>();
  for (const d of all) {
    const name = one(d.profiles as unknown as Person | null)?.full_name ?? "A guard";
    byDevice.set(d.device_id, [...(byDevice.get(d.device_id) ?? []), name]);
  }

  const rows: DeviceRow[] = all.map((d) => {
    const p = one(d.profiles as unknown as Person | null);
    return {
      id: d.id,
      guardName: p?.full_name ?? "A guard",
      guardCode: p?.employee_code ?? "",
      phone: [d.brand, d.model].filter(Boolean).join(" ") || "Unknown phone",
      system: [d.platform === "ios" ? "iPhone" : d.platform === "android" ? "Android" : d.platform === "web" ? "Browser" : d.platform, d.os_version].filter(Boolean).join(" "),
      appVersion: d.app_version,
      status: d.status as DeviceRow["status"],
      battery: d.battery,
      charging: d.charging,
      permission: d.location_permission,
      gps: d.gps_enabled,
      batteryOptimized: d.battery_optimized,
      lastSeenAt: d.last_seen_at,
      firstSeenAt: d.first_seen_at,
      sharedWith: (byDevice.get(d.device_id) ?? []).filter((n) => n !== p?.full_name),
    };
  });

  const phoneOf = new Map(all.map((d) => [d.device_id, [d.brand, d.model].filter(Boolean).join(" ")]));
  const held: FlaggedPunch[] = (flagged.data ?? []).map((a) => ({
    id: a.id,
    guardName: one(a.profiles as unknown as { full_name: string } | null)?.full_name ?? "A guard",
    siteName: one(a.sites as unknown as { name: string } | null)?.name ?? "a site",
    checkInAt: a.check_in_at ?? "",
    flag: a.device_flag ?? "",
    phone: a.device_id ? (phoneOf.get(a.device_id) ?? null) : null,
  }));

  const pending = rows.filter((r) => r.status === "pending").length;
  const noBackground = rows.filter((r) => r.status === "approved" && (r.permission !== "always" || r.gps === false || r.batteryOptimized === true)).length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Security management" title="Devices" />
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Phones" value={String(rows.length)} hint="Registered by guards" icon={Smartphone} tone="sky" />
        <StatCard label="Waiting for approval" value={String(pending)} hint={pending ? "New or shared phones" : "Every phone is approved"} icon={ShieldCheck} tone={pending ? "amber" : "emerald"} />
        <StatCard label="Check-ins held" value={String(held.length)} hint={held.length ? "From a phone not approved for the guard" : "Nothing held"} icon={AlertTriangle} tone={held.length ? "rose" : "slate"} />
        <StatCard label="Tracking limited" value={String(noBackground)} hint={noBackground ? "Location or battery saver will stop tracking" : "All phones track in the background"} icon={MapPinOff} tone={noBackground ? "amber" : "emerald"} />
      </div>
      <DevicesWorkspace devices={rows} flagged={held} />
    </div>
  );
}
