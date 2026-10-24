import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, IndianRupee, Map as MapIcon, MapPinned, Mail } from "lucide-react";

import { PageHeader } from "@/components/console/page-header";
import { StatCard } from "@/components/console/stat-card";
import { requireRole } from "@/lib/auth";
import { istDate } from "@/lib/roster";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Maps usage" };
export const dynamic = "force-dynamic";

/**
 * Google's list price for the two things the console uses (Maps Platform, from
 * March 2025): each SKU has 10,000 free events a month, then a price per 1,000.
 * An estimate only — the invoice is in Google Cloud Console.
 */
const FREE = 10_000;
const PRICE = { dynamic: 7, static: 2 }; // USD per 1,000 above the free allowance
const USD_INR = 84;
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

function cost(n: number, perK: number): number {
  return (Math.max(0, n - FREE) / 1000) * perK;
}

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

  const dyn = r.days.reduce((n, d) => n + Number(d.dynamic), 0);
  const sta = r.days.reduce((n, d) => n + Number(d.static), 0);
  const usd = cost(dyn, PRICE.dynamic) + cost(sta, PRICE.static);
  const isNow = month === today.slice(0, 7);
  const dayOfMonth = isNow ? Number(today.slice(8, 10)) : last;
  const projected = isNow && dayOfMonth > 0 ? Math.round((dyn / dayOfMonth) * last) : dyn;

  const byDay = new Map(r.days.map((d) => [d.day, d]));
  const series = Array.from({ length: last }, (_, i) => {
    const day = `${month}-${String(i + 1).padStart(2, "0")}`;
    const d = byDay.get(day);
    return { day, n: Number(d?.dynamic ?? 0) + Number(d?.static ?? 0) };
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

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Map loads" value={dyn.toLocaleString("en-IN")} hint={`${Math.max(0, FREE - dyn).toLocaleString("en-IN")} of 10,000 free left`} icon={MapIcon} tone="sky" />
        <StatCard label="SOS email maps" value={sta.toLocaleString("en-IN")} hint="Google Static Maps · 10,000 free" icon={Mail} tone="rose" />
        <StatCard
          label={isNow ? "At this pace" : "Month total"}
          value={projected.toLocaleString("en-IN")}
          hint={isNow ? `map loads by ${last} ${monthName.split(" ")[0]}` : "map loads"}
          icon={MapPinned}
          tone={projected > FREE ? "amber" : "emerald"}
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

      <p className="text-xs leading-relaxed text-muted-foreground">
        Counted by NBSS as maps are opened, so it is close to Google&apos;s figure but not the invoice. Google gives 10,000 free map loads and 10,000 free
        static maps every month; beyond that the list price is about $7 per 1,000 map loads and $2 per 1,000 static maps (₹ at {USD_INR}/$). The phone
        app is not counted: Android&apos;s maps are free and iPhones use Apple Maps. Exact figures:{" "}
        <a href={CLOUD} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
          Google Cloud Console → Google Maps Platform → Metrics
        </a>
        .
      </p>
    </div>
  );
}
