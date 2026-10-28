import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, IndianRupee, Map as MapIcon, MapPinned, Mail } from "lucide-react";

import { PageHeader } from "@/components/console/page-header";
import { StatCard } from "@/components/console/stat-card";
import { requireRole } from "@/lib/auth";
import { istDate } from "@/lib/roster";
import { googleMapsUsage, MAPS_SERVICES, monitoringConfigured, type GoogleUsage } from "@/lib/gcp-monitoring";
import { UsageTable, type UsageRow } from "@/components/console/usage-table";
import { cn } from "@/lib/utils";
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
  hours: { hour: number; n: number }[];
  pages: { path: string; loads: number }[];
  people: { name: string; phone: string | null; loads: number }[];
};

type View = "day" | "month" | "year";

const LABEL: Record<string, string> = {
  "/console": "Dashboard",
  "/console/live": "Live tracking",
  "/console/routes": "Route history",
  "/console/sites": "Sites & geofences",
  "/console/sos": "SOS alerts",
  "/console/attendance": "Attendance",
  "/console/maps-usage": "Maps usage",
};
const SITE_PAGE = /^\/console\/sites\/([0-9a-f-]{36})/i;

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 9 → "9 am", 0 → "12 am". */
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "am" : "pm"}`;

/**
 * How much Google Maps the console used, for a day, a month or a year, counted as it
 * happens: every Google map drawn in a browser (billed as "Dynamic Maps") and every SOS
 * email map picture fetched from Google ("Static Maps"). The phones are not in it: the
 * Android app's maps are free, and iPhones use Apple Maps.
 */
export default async function MapsUsagePage({ searchParams }: { searchParams: Promise<{ view?: string; at?: string; month?: string }> }) {
  await requireRole("admin");
  const q = await searchParams;
  const today = istDate(new Date());
  const view: View = q.view === "day" || q.view === "year" ? q.view : "month";

  // The period on screen: one day, one month, or one year (IST).
  let at: string;
  if (view === "day") at = /^\d{4}-\d{2}-\d{2}$/.test(q.at ?? "") ? q.at! : today;
  else if (view === "year") at = /^\d{4}$/.test(q.at ?? "") ? q.at! : today.slice(0, 4);
  else at = /^\d{4}-\d{2}$/.test(q.at ?? q.month ?? "") ? (q.at ?? q.month)! : today.slice(0, 7);
  if (at > today.slice(0, at.length)) at = today.slice(0, at.length);

  const y = Number(at.slice(0, 4));
  const m = view === "year" ? 1 : Number(at.slice(5, 7));
  const daysIn = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const from = view === "day" ? at : view === "month" ? `${at}-01` : `${at}-01-01`;
  const to = view === "day" ? at : view === "month" ? `${at}-${pad(daysIn(y, m))}` : `${at}-12-31`;

  const step = (d: number): string => {
    if (view === "year") return String(y + d);
    if (view === "month") {
      const t = new Date(Date.UTC(y, m - 1 + d, 1));
      return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`;
    }
    const t = new Date(Date.UTC(y, m - 1, Number(at.slice(8, 10)) + d));
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  };
  const isNow = at === today.slice(0, at.length);
  const href = (v: View, a?: string) => `?view=${v}${a ? `&at=${a}` : ""}`;
  const title =
    view === "day"
      ? new Date(`${at}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
      : view === "month"
        ? new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })
        : String(y);

  const supabase = await supabaseServer();
  const [{ data }, { data: siteRows }] = await Promise.all([
    supabase.rpc("map_usage_report", { p_from: from, p_to: to }),
    supabase.from("sites").select("id, name"),
  ]);
  const r = (data ?? { days: [], hours: [], pages: [], people: [] }) as unknown as Report;
  const siteName = new Map((siteRows ?? []).map((x) => [x.id, x.name]));

  // Google's own count, when a monitoring key is set up; ours otherwise.
  let google: GoogleUsage | null = null;
  let googleError: string | null = null;
  if (monitoringConfigured()) {
    try {
      const startUtc = new Date(Date.parse(`${from}T00:00:00Z`) - 5.5 * 3_600_000);
      const endUtc = new Date(Math.min(nowMs(), Date.parse(`${to}T00:00:00Z`) + 86_400_000 - 5.5 * 3_600_000));
      google = await googleMapsUsage(startUtc, endUtc);
    } catch (e) {
      googleError = e instanceof Error ? e.message : "Cloud Monitoring could not be read.";
    }
  }

  const ownDyn = r.days.reduce((n, d) => n + Number(d.dynamic), 0);
  const ownSta = r.days.reduce((n, d) => n + Number(d.static), 0);
  const dyn = google ? (google.byService["maps-backend.googleapis.com"] ?? 0) : ownDyn;
  const sta = google ? (google.byService["static-maps-backend.googleapis.com"] ?? 0) : ownSta;
  const perDay = (day: string) => {
    if (google) return google.byDay[day] ?? 0;
    const d = r.days.find((x) => x.day === day);
    return Number(d?.dynamic ?? 0) + Number(d?.static ?? 0);
  };

  // The chart: hours of the day, days of the month, or months of the year.
  let bars: { key: string; label: string; tip: string; n: number }[];
  if (view === "day") {
    const byHour = new Map(r.hours.map((h) => [Number(h.hour), Number(h.n)]));
    bars = Array.from({ length: 24 }, (_, h) => ({ key: String(h), label: hourLabel(h), tip: `${hourLabel(h)}–${hourLabel((h + 1) % 24)}`, n: byHour.get(h) ?? 0 }));
  } else if (view === "month") {
    bars = Array.from({ length: daysIn(y, m) }, (_, i) => {
      const day = `${at}-${pad(i + 1)}`;
      return { key: day, label: String(i + 1), tip: `${i + 1} ${MONTHS[m - 1]}`, n: perDay(day) };
    });
  } else {
    bars = MONTHS.map((name, i) => {
      let n = 0;
      for (let d = 1; d <= daysIn(y, i + 1); d++) n += perDay(`${at}-${pad(i + 1)}-${pad(d)}`);
      return { key: name, label: name, tip: `${name} ${y}`, n };
    });
  }
  const peak = Math.max(1, ...bars.map((b) => b.n));
  const busiest = bars.reduce((best, b) => (b.n > best.n ? b : best), bars[0]!);

  // The bill is monthly (the free allowance resets each month): a year adds up its months.
  const usd =
    view === "year"
      ? bars.reduce((t, b) => t + dynamicCost(b.n), 0) + staticCost(sta / 12) * 12
      : dynamicCost(dyn) + staticCost(sta);
  const monthLast = daysIn(y, m);
  const dayOfMonth = Number(today.slice(8, 10));
  const projected = view === "month" && isNow ? Math.round((dyn / Math.max(1, dayOfMonth)) * monthLast) : dyn;

  // Where: each site's pages counted together, under the site's name.
  const where = new Map<string, { label: string; n: number }>();
  for (const p of r.pages) {
    const site = SITE_PAGE.exec(p.path)?.[1];
    const key = site ? `site:${site}` : p.path;
    const label = site
      ? `Site · ${siteName.get(site) ?? "a deleted site"}`
      : (LABEL[p.path] ?? (p.path.startsWith("/console/reports/guard") ? "Guard attendance" : p.path));
    const cur = where.get(key) ?? { label, n: 0 };
    cur.n += Number(p.loads);
    where.set(key, cur);
  }
  const whereRows: UsageRow[] = [...where.entries()].map(([key, v]) => ({ key, label: v.label, n: v.n }));
  const whoRows: UsageRow[] = r.people.map((p, i) => ({ key: `${p.name}-${i}`, label: p.name, sub: p.phone, n: Number(p.loads) }));
  const scope = view === "day" ? "this day" : view === "month" ? "this month" : "this year";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Location tracking"
        title="Maps usage"
        action={
          <a href={CLOUD} target="_blank" rel="noopener noreferrer" className="press inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
            Google Cloud <ExternalLink className="size-3.5" />
          </a>
        }
      />

      {/* The period: Day / Month / Year, and the one shown. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-full bg-muted/70 p-1 ring-1 ring-border/60">
          {(["day", "month", "year"] as const).map((v) => (
            <Link
              key={v}
              href={href(v)}
              aria-current={view === v ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold capitalize",
                view === v ? "bg-background shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
          <Link href={href(view, step(-1))} aria-label={`Previous ${view}`} className="grid size-8 place-items-center rounded-full hover:bg-muted">
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-44 text-center text-sm font-semibold">{title}</span>
          {isNow ? (
            <span className="grid size-8 place-items-center rounded-full opacity-30">
              <ChevronRight className="size-4" />
            </span>
          ) : (
            <Link href={href(view, step(1))} aria-label={`Next ${view}`} className="grid size-8 place-items-center rounded-full hover:bg-muted">
              <ChevronRight className="size-4" />
            </Link>
          )}
        </div>
        {!isNow && (
          <Link href={href(view)} className="text-sm font-medium text-primary hover:underline">
            {view === "day" ? "Today" : view === "month" ? "This month" : "This year"}
          </Link>
        )}
        <span className={cn("ml-auto rounded-full px-3 py-1 text-xs font-medium", google ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-amber-500/10 text-amber-800")}>
          {google ? "Google's own figures · refreshed every 10 min" : googleError ? `Google's figures unavailable: ${googleError}` : "NBSS's own count"}
        </span>
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Map loads"
          value={dyn.toLocaleString("en-IN")}
          hint={view === "month" ? `${Math.max(0, FREE.dynamic - dyn).toLocaleString("en-IN")} of 70,000 free left` : `website maps, ${scope}`}
          icon={MapIcon}
          tone="sky"
        />
        <StatCard label="SOS email maps" value={sta.toLocaleString("en-IN")} hint={`Google Static Maps, ${scope}`} icon={Mail} tone="rose" />
        {view === "month" ? (
          <StatCard
            label={isNow ? "At this pace" : "Month total"}
            value={projected.toLocaleString("en-IN")}
            hint={isNow ? `map loads by ${monthLast} ${MONTHS[m - 1]}` : "map loads"}
            icon={MapPinned}
            tone={projected > FREE.dynamic ? "amber" : "emerald"}
          />
        ) : (
          <StatCard
            label={view === "day" ? "Busiest hour" : "Busiest month"}
            value={busiest.n ? busiest.tip : "-"}
            hint={busiest.n ? `${busiest.n.toLocaleString("en-IN")} maps` : "No maps yet"}
            icon={MapPinned}
            tone="emerald"
          />
        )}
        <StatCard
          label={view === "year" ? "Estimated bill, year" : view === "day" ? "Estimated bill, month" : "Estimated bill"}
          value={usd === 0 ? "₹0" : `₹${Math.round(usd * USD_INR).toLocaleString("en-IN")}`}
          hint={usd === 0 ? "Inside Google's free allowance" : `$${usd.toFixed(2)} at list price`}
          icon={IndianRupee}
          tone={usd === 0 ? "emerald" : "amber"}
        />
      </div>

      <section className="rounded-2xl border border-app-line bg-card p-5 shadow-e1">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">{view === "day" ? "Hour by hour" : view === "month" ? "Day by day" : "Month by month"}</h2>
          <p className="text-xs text-muted-foreground">
            Map loads and SOS email maps together · busiest {busiest.n ? `${busiest.tip}, ${busiest.n.toLocaleString("en-IN")}` : "-"}
          </p>
        </div>
        <div className="relative">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-app-line-soft" />
          <span aria-hidden className="absolute -top-2.5 right-0 bg-card pl-1 text-[10px] tabular-nums text-muted-foreground">
            {peak.toLocaleString("en-IN")}
          </span>
          <div className="flex h-48 items-end gap-[3px] pt-3" role="img" aria-label={`Maps used, ${title}`}>
            {bars.map((b) => (
              <div key={b.key} className="group relative flex h-full flex-1 items-end">
                <div
                  className={cn("w-full rounded-t-[4px] transition-colors", b.n ? "bg-primary/75 group-hover:bg-primary" : "bg-muted")}
                  style={{ height: b.n ? `${Math.max(3, (b.n / peak) * 100)}%` : "2px" }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-[11px] font-medium whitespace-nowrap text-background opacity-0 shadow transition-opacity group-hover:opacity-100">
                  {b.tip}: {b.n.toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1.5 flex gap-[3px] text-[10px] text-muted-foreground tabular-nums">
          {bars.map((b, i) => (
            <span key={b.key} className="flex-1 text-center">
              {view === "year" || (view === "day" ? i % 3 === 0 : i === 0 || (i + 1) % 5 === 0) ? b.label : ""}
            </span>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <UsageTable title="Where maps were opened" rows={whereRows} empty={`No map loads ${scope}.`} />
        <UsageTable title="Who opened them" rows={whoRows} empty="Nobody yet." />
      </div>

      {google && (
        <section className="rounded-2xl border border-app-line bg-card shadow-e1">
          <h2 className="border-b border-app-line-soft px-5 py-3.5 font-semibold">By Google Maps API, {scope}</h2>
          <ul className="divide-y divide-app-line-soft">
            {Object.entries(MAPS_SERVICES)
              .sort(([a], [b]) => (google!.byService[b] ?? 0) - (google!.byService[a] ?? 0))
              .map(([service, label]) => (
                <li key={service} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="truncate">{label}</span>
                  <span className="font-semibold tabular-nums">{(google!.byService[service] ?? 0).toLocaleString("en-IN")}</span>
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
