import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, IndianRupee, Map as MapIcon, MapPinned, Mail } from "lucide-react";

import { PageHeader } from "@/components/console/page-header";
import { StatCard } from "@/components/console/stat-card";
import { requireRole } from "@/lib/auth";
import { istDate } from "@/lib/roster";
import { googleMapsUsage, MAPS_SERVICES, monitoringConfigured, type GoogleUsage } from "@/lib/gcp-monitoring";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Maps usage" };
export const dynamic = "force-dynamic";

/**
 * Google Maps Platform pricing for India (billing account and most usage in India),
 * per Google's India pricing page:
 *   Dynamic Maps (each map shown in a browser): 70,000 free a month, then $2.10 per
 *   1,000 up to 5 million, $0.53 per 1,000 beyond.
 *   Static Maps (the SOS email picture): the global allowance is assumed, 10,000 free
 *   then $2 per 1,000, until India's figure for it is confirmed.
 * An estimate only — the invoice is in Google Cloud Console.
 */
const FREE = { dynamic: 70_000, static: 10_000 };
const USD_INR = 84;

function dynamicCost(n: number): number {
  const paid = Math.max(0, n - FREE.dynamic);
  const tier1 = Math.min(paid, 5_000_000 - FREE.dynamic);
  const tier2 = Math.max(0, paid - tier1);
  return (tier1 / 1000) * 2.1 + (tier2 / 1000) * 0.53;
}
/** The request's clock (read once, outside rendering). */
function nowMs(): number {
  return Date.now();
}

const staticCost = (n: number) => (Math.max(0, n - FREE.static) / 1000) * 2;
const CLOUD = "https://console.cloud.google.com/google/maps-apis/metrics";

type Report = {
  days: { day: string; dynamic: number; static: number }[];
  pages: { path: string; loads: number }[];
  people: { name: string; loads: number }[];
};

const LABEL: Record<string, string> = {
  "/console/live": "Live tracking",
  "/console/routes": "Route history",
  "/console/sites": "Sites & geofences",
  "/console/sos": "SOS alerts",
};
const pageName = (p: string) => LABEL[p] ?? (p.startsWith("/console/reports/guard") ? "Guard attendance" : p.startsWith("/console/sites") ? "Site detail" : p);


/**
 * How much Google Maps the console used this month, counted as it happens: every
 * Google map drawn in a browser (billed as "Dynamic Maps") and every SOS email map
 * picture fetched from Google ("Static Maps"). The phones are not in it: the Android
 * app's maps are free, and iPhones use Apple Maps.
 */
export default async function MapsUsagePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireRole("admin");
  const q = await searchParams;
  const today = istDate(new Date());
  const month = /^\d{4}-\d{2}$/.test(q.month ?? "") ? q.month! : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = `${month}-01`;
  const to = `${month}-${String(last).padStart(2, "0")}`;
  const shift = (d: number) => {
    const t = new Date(Date.UTC(y, m - 1 + d, 1));
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("map_usage_report", { p_from: from, p_to: to });
  const r = (data ?? { days: [], pages: [], people: [] }) as unknown as Report;

  // Google's own count, when a monitoring key is set up; ours otherwise.
  let google: GoogleUsage | null = null;
  let googleError: string | null = null;
  if (monitoringConfigured()) {
    try {
      const startUtc = new Date(Date.UTC(y, m - 1, 1) - 5.5 * 3_600_000);
      const endUtc = new Date(Math.min(nowMs(), Date.UTC(y, m, 1) - 5.5 * 3_600_000));
      google = await googleMapsUsage(startUtc, endUtc);
    } catch (e) {
      googleError = e instanceof Error ? e.message : "Cloud Monitoring could not be read.";
    }
  }

  const ownDyn = r.days.reduce((n, d) => n + Number(d.dynamic), 0);
  const ownSta = r.days.reduce((n, d) => n + Number(d.static), 0);
  const dyn = google ? (google.byService["maps-backend.googleapis.com"] ?? 0) : ownDyn;
  const sta = google ? (google.byService["static-maps-backend.googleapis.com"] ?? 0) : ownSta;
  const usd = dynamicCost(dyn) + staticCost(sta);
  const isNow = month === today.slice(0, 7);
  const dayOfMonth = isNow ? Number(today.slice(8, 10)) : last;
  const projected = isNow && dayOfMonth > 0 ? Math.round((dyn / dayOfMonth) * last) : dyn;
  const source = google ? "Google Cloud Monitoring" : "NBSS's own count";

  const byDay = new Map(r.days.map((d) => [d.day, d]));
  const series = Array.from({ length: last }, (_, i) => {
    const day = `${month}-${String(i + 1).padStart(2, "0")}`;
    const d = byDay.get(day);
    return { day, n: google ? (google.byDay[day] ?? 0) : Number(d?.dynamic ?? 0) + Number(d?.static ?? 0) };
  });
  const peak = Math.max(1, ...series.map((s) => s.n));
  const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Location tracking"
        title="Maps usage"
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
              <Link href={`?month=${shift(-1)}`} aria-label="Previous month" className="grid size-8 place-items-center rounded-full hover:bg-muted">
                <ChevronLeft className="size-4" />
              </Link>
              <span className="min-w-32 text-center text-sm font-semibold">{monthName}</span>
              {isNow ? (
                <span className="grid size-8 place-items-center rounded-full opacity-30">
                  <ChevronRight className="size-4" />
                </span>
              ) : (
                <Link href={`?month=${shift(1)}`} aria-label="Next month" className="grid size-8 place-items-center rounded-full hover:bg-muted">
                  <ChevronRight className="size-4" />
                </Link>
              )}
            </div>
            <a href={CLOUD} target="_blank" rel="noopener noreferrer" className="press inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
              Google Cloud <ExternalLink className="size-3.5" />
            </a>
          </div>
        }
      />

      <div
        className={
          google
            ? "flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 text-sm"
            : "flex flex-wrap items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm"
        }
      >
        <span className="font-semibold">Figures from: {source}</span>
        <span className="text-muted-foreground">
          {google
            ? "the same numbers as Google Cloud Console → Google Maps Platform → Metrics (refreshed every 10 minutes)."
            : googleError
              ? `Google's numbers could not be read: ${googleError}`
              : "counted as maps open. Connect Google Cloud Monitoring (below) to show Google's exact figures here."}
        </span>
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Map loads" value={dyn.toLocaleString("en-IN")} hint={`${Math.max(0, FREE.dynamic - dyn).toLocaleString("en-IN")} of 70,000 free left`} icon={MapIcon} tone="sky" />
        <StatCard label="SOS email maps" value={sta.toLocaleString("en-IN")} hint="Google Static Maps · 10,000 free" icon={Mail} tone="rose" />
        <StatCard
          label={isNow ? "At this pace" : "Month total"}
          value={projected.toLocaleString("en-IN")}
          hint={isNow ? `map loads by ${last} ${monthName.split(" ")[0]}` : "map loads"}
          icon={MapPinned}
          tone={projected > FREE.dynamic ? "amber" : "emerald"}
        />
        <StatCard
          label="Estimated bill"
          value={usd === 0 ? "₹0" : `₹${Math.round(usd * USD_INR).toLocaleString("en-IN")}`}
          hint={usd === 0 ? "Inside Google's free allowance" : `$${usd.toFixed(2)} at list price`}
          icon={IndianRupee}
          tone={usd === 0 ? "emerald" : "amber"}
        />
      </div>

      <section className="rounded-2xl border border-app-line bg-card p-5 shadow-e1">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">Day by day</h2>
          <p className="text-xs text-muted-foreground">Map loads and SOS email maps together</p>
        </div>
        <div className="flex h-40 items-end gap-[3px]" role="img" aria-label={`Map loads per day in ${monthName}`}>
          {series.map((s) => (
            <div key={s.day} className="group relative flex h-full flex-1 items-end" title={`${s.day}: ${s.n}`}>
              <div className="w-full rounded-t-[3px] bg-primary/80 transition-colors group-hover:bg-primary" style={{ height: `${s.n ? Math.max(4, (s.n / peak) * 100) : 0}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>1</span>
          <span>{Math.ceil(last / 2)}</span>
          <span>{last}</span>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-app-line bg-card shadow-e1">
          <h2 className="border-b border-app-line-soft px-5 py-3.5 font-semibold">Where maps were opened</h2>
          <ul className="divide-y divide-app-line-soft">
            {r.pages.length === 0 && <li className="px-5 py-4 text-sm text-muted-foreground">No map loads this month.</li>}
            {r.pages.map((p) => (
              <li key={p.path} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="truncate">{pageName(p.path)}</span>
                <span className="font-semibold tabular-nums">{Number(p.loads).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-app-line bg-card shadow-e1">
          <h2 className="border-b border-app-line-soft px-5 py-3.5 font-semibold">Who opened them</h2>
          <ul className="divide-y divide-app-line-soft">
            {r.people.length === 0 && <li className="px-5 py-4 text-sm text-muted-foreground">Nobody yet.</li>}
            {r.people.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="truncate">{p.name}</span>
                <span className="font-semibold tabular-nums">{Number(p.loads).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {google && (
        <section className="rounded-2xl border border-app-line bg-card shadow-e1">
          <h2 className="border-b border-app-line-soft px-5 py-3.5 font-semibold">By Google Maps API, this month</h2>
          <ul className="divide-y divide-app-line-soft">
            {Object.entries(MAPS_SERVICES).map(([service, label]) => (
              <li key={service} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="truncate">{label}</span>
                <span className="font-semibold tabular-nums">{(google.byService[service] ?? 0).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!google && (
        <section className="rounded-2xl border border-app-line bg-card p-5 text-sm shadow-e1">
          <h2 className="font-semibold">Show Google&apos;s exact figures here</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Google Cloud Console → the project that owns the Maps key → IAM &amp; Admin → Service accounts → Create service account (name it “nbss-maps-usage”).</li>
            <li>Give it one role: <span className="font-medium text-foreground">Monitoring Viewer</span>. It can only read usage, nothing else.</li>
            <li>Open it → Keys → Add key → JSON. A file downloads.</li>
            <li>Send that file to your developer to add to the server as GOOGLE_CLOUD_MONITORING_KEY. Do not email or post it anywhere public.</li>
          </ol>
        </section>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        India pricing: 70,000 free map loads a month, then $2.10 per 1,000 (up to 5 million) and $0.53 per 1,000 beyond; SOS email maps assume
        10,000 free then $2 per 1,000. Rupees at {USD_INR} per dollar. An estimate, not the invoice. The phone app costs nothing: Android&apos;s maps are
        free and iPhones use Apple Maps. Invoice and exact figures:{" "}
        <a href={CLOUD} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
          Google Cloud Console → Google Maps Platform → Metrics
        </a>
        .
      </p>
    </div>
  );
}
