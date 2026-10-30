import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Eye, User, Users } from "lucide-react";

import { PageHeader } from "@/components/console/page-header";
import { StatCard } from "@/components/console/stat-card";
import { requireRole } from "@/lib/auth";
import { istDay } from "@/lib/roster";
import { supabaseServer } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Impressions" };
export const dynamic = "force-dynamic";

const RANGES = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "all", label: "All time", days: 0 },
] as const;

const fmt = (n: number) => n.toLocaleString("en-IN");

/**
 * Page impressions (migration 0071), as okhrang shows them: every page's views in the range,
 * real users and bots apart, website and console alike. Browsers are counted from the page,
 * bots by the middleware (lib/visits.ts). Page views and visitors are the all-time totals
 * the public footer counts from.
 */
export default async function ImpressionsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireRole("admin");
  const { range = "7d" } = await searchParams;
  const r = RANGES.find((x) => x.key === range) ?? RANGES[1];

  const supabase = await supabaseServer();
  let q = supabase.from("page_visits").select("page_name, user_count, bot_count").limit(10000);
  if (r.days) q = q.gte("visit_date", istDay(-(r.days - 1)));
  const [{ data }, { data: counters }] = await Promise.all([q, supabase.from("site_counters").select("key, value")]);

  const byPage = new Map<string, { users: number; bots: number }>();
  for (const v of data ?? []) {
    const cur = byPage.get(v.page_name) ?? { users: 0, bots: 0 };
    cur.users += v.user_count;
    cur.bots += v.bot_count;
    byPage.set(v.page_name, cur);
  }
  const pages = [...byPage]
    .map(([name, c]) => ({ name, ...c, total: c.users + c.bots }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const users = pages.reduce((a, p) => a + p.users, 0);
  const bots = pages.reduce((a, p) => a + p.bots, 0);
  const counter = (key: string) => Number((counters ?? []).find((c) => c.key === key)?.value ?? 0);
  const top = Math.max(1, ...pages.map((p) => p.total));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Website" title="Impressions" />

      <div className="flex rounded-full bg-muted/70 p-1 ring-1 ring-border/60 w-fit">
        {RANGES.map((x) => (
          <Link
            key={x.key}
            href={`?range=${x.key}`}
            aria-current={r.key === x.key ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold",
              r.key === x.key ? "bg-background shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {x.label}
          </Link>
        ))}
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Impressions" value={fmt(users + bots)} hint={`${r.label.toLowerCase()}, users and bots`} icon={Eye} tone="sky" />
        <StatCard label="Real users" value={fmt(users)} hint="browsers" icon={User} tone="emerald" />
        <StatCard label="Bots" value={fmt(bots)} hint="crawlers and link previews" icon={Bot} tone="amber" />
        <StatCard label="Page views, all time" value={fmt(counter("views"))} hint={`${fmt(counter("visitors"))} visitors, each browser once`} icon={Users} tone="rose" />
      </div>

      <section className="rounded-2xl border border-app-line bg-card shadow-e1">
        <div className="flex items-baseline justify-between gap-3 border-b border-app-line-soft px-5 py-3.5">
          <h2 className="font-semibold">By page</h2>
          <p className="text-xs text-muted-foreground">{pages.length} pages</p>
        </div>
        {pages.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No page views in this range yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-app-line-soft">
                  <th className="w-12 px-5 py-2.5 text-left font-medium">#</th>
                  <th className="px-2 py-2.5 text-left font-medium">Page</th>
                  <th className="px-3 py-2.5 text-right font-medium">Users</th>
                  <th className="px-3 py-2.5 text-right font-medium">Bots</th>
                  <th className="px-5 py-2.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-line-soft">
                {pages.map((p, i) => (
                  <tr key={p.name}>
                    <td className="px-5 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="min-w-48 px-2 py-3">
                      <p className="truncate font-medium" title={p.name}>
                        {p.name}
                      </p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${(p.total / top) * 100}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmt(p.users)}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">{fmt(p.bots)}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{fmt(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
