import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type SiteStat = { id: string; name: string; minutes: number; punches: number; guards: number; late: number };
export type Part = { label: string; value: number; tone: string };
export type LateGuard = { id: string; name: string; code: string; late: number; punches: number };

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

/** The busiest sites as a table: hours with a bar, punches, how many guards, how often late. */
export function BusiestSites({ rows }: { rows: SiteStat[] }) {
  if (!rows.length) return <p className="rounded-2xl border-2 border-dashed border-border px-4 py-10 text-center text-sm text-secondary-fg">No hours worked yet.</p>;
  const top = rows[0]!.minutes || 1;
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="text-left text-[11px] font-semibold tracking-wider text-secondary-fg uppercase">
            <th className="px-1 pb-2">Site</th>
            <th className="px-1 pb-2">Hours</th>
            <th className="px-1 pb-2 text-right">Punches</th>
            <th className="px-1 pb-2 text-right">Guards</th>
            <th className="px-1 pb-2 text-right">Late</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => {
            const late = pct(r.late, r.punches);
            return (
              <tr key={r.id} className="group">
                <td className="max-w-[220px] px-1 py-2.5">
                  <Link href={`/console/sites/${r.id}`} className="flex items-center gap-2 font-medium hover:underline">
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-[11px] font-bold tabular-nums text-secondary-fg">{i + 1}</span>
                    <span className="truncate">{r.name}</span>
                  </Link>
                </td>
                <td className="w-[34%] px-1 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#009164] to-[#14b8a6]" style={{ width: `${Math.max(4, (r.minutes / top) * 100)}%` }} />
                    </div>
                    <span className="w-14 text-right font-semibold tabular-nums">{Math.round(r.minutes / 60)} h</span>
                  </div>
                </td>
                <td className="px-1 py-2.5 text-right tabular-nums">{r.punches}</td>
                <td className="px-1 py-2.5 text-right tabular-nums">{r.guards}</td>
                <td className="px-1 py-2.5 text-right">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", late >= 30 ? "bg-red-100 text-red-700" : late >= 10 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700")}>
                    {late}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** A labelled breakdown: a stacked bar, then each part with its count and share. */
export function Breakdown({ title, parts, href }: { title: string; parts: Part[]; href?: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold">{title}</p>
        <p className="text-xs text-secondary-fg tabular-nums">{total} in all</p>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {parts.map((p) => (p.value ? <div key={p.label} className={p.tone} style={{ width: `${pct(p.value, total)}%` }} /> : null))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-sm">
            <span className={cn("size-2.5 shrink-0 rounded-full", p.tone)} />
            <span className="flex-1 text-secondary-fg">{p.label}</span>
            <span className="font-semibold tabular-nums">{p.value}</span>
            <span className="w-10 text-right text-xs text-secondary-fg tabular-nums">{pct(p.value, total)}%</span>
          </li>
        ))}
      </ul>
      {href && (
        <Link href={href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-ink hover:underline">
          Open attendance <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

/** Check-ins by the hour they happened (IST), as 24 columns. */
export function HourlyCheckins({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  const peak = counts.indexOf(Math.max(...counts));
  const label = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}`;
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]">
        {counts.map((n, h) => (
          <div key={h} className="group relative flex h-full flex-1 flex-col justify-end" title={`${label(h)}m: ${n} check-ins`}>
            <div className={cn("w-full rounded-t-[3px]", h === peak ? "bg-[#009164]" : "bg-[#009164]/35")} style={{ height: `${Math.max(n ? 6 : 2, (n / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-secondary-fg tabular-nums">
        {[0, 6, 12, 18, 23].map((h) => (
          <span key={h}>{label(h)}</span>
        ))}
      </div>
      <p className="mt-2 text-xs text-secondary-fg">
        Busiest hour: <span className="font-semibold text-foreground">{label(peak)}m</span>, {counts[peak]} check-ins in 30 days.
      </p>
    </div>
  );
}

/** The guards late most often in the last 30 days. */
export function LateGuards({ rows }: { rows: LateGuard[] }) {
  if (!rows.length) return <p className="rounded-2xl border-2 border-dashed border-border px-4 py-8 text-center text-sm text-secondary-fg">Nobody was late in 30 days.</p>;
  return (
    <ul className="divide-y divide-border">
      {rows.map((g) => (
        <li key={g.id} className="flex items-center gap-3 py-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
            {g.name
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <Link href={`/console/reports/guard/${g.id}`} className="block truncate text-sm font-medium hover:underline">
              {g.name}
            </Link>
            <span className="block text-xs text-secondary-fg">{g.code}</span>
          </span>
          <span className="text-right">
            <span className="block text-sm font-semibold tabular-nums text-amber-700">{g.late} late</span>
            <span className="block text-[11px] text-secondary-fg tabular-nums">of {g.punches} punches</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
