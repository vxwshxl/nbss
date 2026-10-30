import type { Metadata } from "next";
import { BellOff, BellRing, Siren, Timer } from "lucide-react";

import { PageHeader } from "@/components/console/page-header";
import { PeriodSwitch } from "@/components/console/period-switch";
import { SosWorkspace, type SosRow } from "@/components/console/sos-workspace";
import { StatCard } from "@/components/console/stat-card";
import { requireRole } from "@/lib/auth";
import { periodBounds, periodPhrase, readPeriod } from "@/lib/period";
import { istDay } from "@/lib/roster";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "SOS alerts" };
export const dynamic = "force-dynamic";

const SOS_SELECT =
  "id, status, kind, raised_at, acknowledged_at, closed_at, inside_fence, guard:profiles!sos_alerts_raised_by_fkey(full_name, employee_code, phone), sites(name, district), sos_acknowledgements(profile_id)";

/**
 * The SOS alerts raised in a day (the default), month or year; one still live is
 * listed whatever the period. The app is where an alert is
 * answered at 3am; this is where the desk sees it on a big screen, answers it
 * too, and looks back at how long help took to arrive.
 */
export default async function SosPage({ searchParams }: { searchParams: Promise<{ period?: string; at?: string }> }) {
  await requireRole("admin", "supervisor");
  const today = istDay(0);
  const { period, at } = readPeriod(await searchParams, today);
  const { from, to } = periodBounds(period, at);
  const supabase = await supabaseServer();

  const [inPeriod, open] = await Promise.all([
    supabase.from("sos_alerts").select(SOS_SELECT).gte("raised_at", from.toISOString()).lt("raised_at", to.toISOString()).order("raised_at", { ascending: false }).limit(2000),
    supabase.from("sos_alerts").select(SOS_SELECT).in("status", ["active", "acknowledged"]).order("raised_at", { ascending: false }),
  ]);
  const seen = new Set((inPeriod.data ?? []).map((a) => a.id));
  const data = [...(open.data ?? []).filter((a) => !seen.has(a.id)), ...(inPeriod.data ?? [])];

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const rows: SosRow[] = data.map((a) => {
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
      guardName: g?.full_name ?? "-",
      guardCode: g?.employee_code ?? "",
      guardPhone: g?.phone ?? null,
      siteName: s?.name ?? "-",
      district: s?.district ?? null,
      responders: (a.sos_acknowledgements as unknown as unknown[] | null)?.length ?? 0,
    };
  });

  const live = rows.filter((r) => r.status === "active" || r.status === "acknowledged").length;
  const month = rows.filter((r) => r.raisedAt >= from.toISOString() && r.raisedAt < to.toISOString());
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
      <PeriodSwitch period={period} at={at} today={today} />
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Live now"
          value={String(live)}
          hint={live ? "A guard is waiting for help" : "All quiet"}
          icon={Siren}
          tone={live ? "rose" : "emerald"}
        />
        <StatCard label="Alerts raised" value={String(month.length)} hint={periodPhrase(period, at, today)} icon={BellRing} tone="amber" />
        <StatCard
          label="First answer"
          value={avg === null ? "-" : `${avg} min`}
          hint={`Average, ${periodPhrase(period, at, today)}`}
          icon={Timer}
          tone="sky"
        />
        <StatCard
          label="False alarms"
          value={String(falseAlarms)}
          hint="Stood down, and that is fine"
          icon={BellOff}
          tone="slate"
        />
      </div>
      <SosWorkspace rows={rows} />
    </div>
  );
}
