import type { Metadata } from "next";
import { BellRing, ShieldAlert, ShieldOff, Timer } from "lucide-react";

import { PageHeader } from "@/components/console/page-header";
import { SosWorkspace, type SosRow } from "@/components/console/sos-workspace";
import { StatCard } from "@/components/console/stat-card";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "SOS alerts" };
export const dynamic = "force-dynamic";

function daysAgo(days: number): number {
  return Date.now() - days * 86_400_000;
}

/**
 * Every SOS ever raised, live ones first. The app is where an alert is
 * answered at 3am; this is where the desk sees it on a big screen, answers it
 * too, and looks back at how long help took to arrive.
 */
export default async function SosPage() {
  await requireRole("admin", "supervisor");
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("sos_alerts")
    .select(
      "id, status, kind, raised_at, acknowledged_at, closed_at, inside_fence, guard:profiles!sos_alerts_raised_by_fkey(full_name, employee_code, phone), sites(name, district), sos_acknowledgements(profile_id)",
    )
    .order("raised_at", { ascending: false })
    .limit(500);

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const rows: SosRow[] = (data ?? []).map((a) => {
    const g = one(a.guard as unknown as { full_name: string; employee_code: string; phone: string | null } | null);
    const s = one(a.sites as unknown as { name: string; district: string | null } | null);
    return {
      id: a.id,
      status: a.status,
      kind: a.kind,
      raisedAt: a.raised_at,
      acknowledgedAt: a.acknowledged_at,
      closedAt: a.closed_at,
      insideFence: a.inside_fence,
      guardName: g?.full_name ?? "—",
      guardCode: g?.employee_code ?? "",
      guardPhone: g?.phone ?? null,
      siteName: s?.name ?? "—",
      district: s?.district ?? null,
      responders: (a.sos_acknowledgements as unknown as unknown[] | null)?.length ?? 0,
    };
  });

  const live = rows.filter((r) => r.status === "active" || r.status === "acknowledged").length;
  const month = rows.filter((r) => new Date(r.raisedAt).getTime() >= daysAgo(30));
  const answered = month.filter((r) => r.acknowledgedAt);
  const avg = answered.length
    ? Math.round(
        answered.reduce((sum, r) => sum + (new Date(r.acknowledgedAt!).getTime() - new Date(r.raisedAt).getTime()), 0) /
          answered.length /
          60_000,
      )
    : null;
  const falseAlarms = month.filter((r) => r.status === "false_alarm").length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operations" title="SOS alerts" />
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Live now"
          value={String(live)}
          hint={live ? "A guard is waiting for help" : "All quiet"}
          icon={ShieldAlert}
          tone={live ? "rose" : "emerald"}
        />
        <StatCard label="Last 30 days" value={String(month.length)} hint="Alerts raised" icon={BellRing} tone="amber" />
        <StatCard
          label="First answer"
          value={avg === null ? "—" : `${avg} min`}
          hint="Average, last 30 days"
          icon={Timer}
          tone="sky"
        />
        <StatCard
          label="False alarms"
          value={String(falseAlarms)}
          hint="Stood down — and that is fine"
          icon={ShieldOff}
          tone="slate"
        />
      </div>
      <SosWorkspace rows={rows} />
    </div>
  );
}
