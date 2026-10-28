import Link from "next/link";

import type { RegisterEntry } from "@/lib/attendance-register";
import { CAME, tallyRegister } from "@/lib/attendance-register";
import { cn } from "@/lib/utils";

import { Legend, OUTCOME, RANK } from "./attendance-key";

export { Legend };

const hours = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}m` : ""}`;

/** The register as a grid: a row per guard, a column per day, a coloured letter per duty. */
export function MonthGrid({ rows, days, today }: { rows: RegisterEntry[]; days: string[]; today: string }) {
  const guards = [...new Map(rows.map((r) => [r.guardId, { id: r.guardId, name: r.guardName, code: r.guardCode }])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const cell = new Map<string, RegisterEntry[]>();
  for (const r of rows) cell.set(`${r.guardId}|${r.day}`, [...(cell.get(`${r.guardId}|${r.day}`) ?? []), r]);
  if (guards.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No duties in this month.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-semibold text-muted-foreground">Guard</th>
            {days.map((d) => (
              <th key={d} className={cn("px-0.5 py-2 text-center font-medium tabular-nums", d === today ? "text-emerald-700" : "text-muted-foreground")}>
                <span className="block text-[9px] uppercase">{new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "narrow", timeZone: "UTC" })}</span>
                {Number(d.slice(8))}
              </th>
            ))}
            <th className="px-2 py-2 text-right font-semibold text-muted-foreground">P</th>
            <th className="px-2 py-2 text-right font-semibold text-muted-foreground">A</th>
            <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Hours</th>
          </tr>
        </thead>
        <tbody>
          {guards.map((g) => {
            const mine = rows.filter((r) => r.guardId === g.id);
            const t = tallyRegister(mine);
            return (
              <tr key={g.id} className="group">
                <td className="sticky left-0 z-10 border-t border-app-line-soft bg-card px-3 py-1.5 group-hover:bg-muted/60">
                  <Link href={`/console/reports/guard/${g.id}`} className="block max-w-44 truncate font-semibold hover:text-primary hover:underline">
                    {g.name}
                  </Link>
                  <span className="font-mono text-[10px] text-muted-foreground">{g.code}</span>
                </td>
                {days.map((d) => {
                  const list = cell.get(`${g.id}|${d}`) ?? [];
                  // A day the guard came is never shown as absent: the mark is the worst of the
                  // check-ins that day, and only a day with none shows a missed duty.
                  const attended = list.filter((r) => CAME.includes(r.outcome));
                  const pool = attended.length ? attended : list;
                  const worst = pool.length ? RANK.find((o) => pool.some((r) => r.outcome === o))! : null;
                  return (
                    <td key={d} className="border-t border-app-line-soft px-0.5 py-1.5 text-center">
                      {worst ? (
                        <span
                          title={list.map((r) => `${r.siteName}: ${OUTCOME[r.outcome].label}${r.workedMinutes ? ` · ${hours(r.workedMinutes)}` : ""}`).join("\n")}
                          className={cn("mx-auto grid size-6 place-items-center rounded-md text-[10px] font-bold", OUTCOME[worst].cell)}
                        >
                          {OUTCOME[worst].letter}
                        </span>
                      ) : (
                        <span className="mx-auto block size-6 rounded-md bg-muted/40" />
                      )}
                    </td>
                  );
                })}
                <td className="border-t border-app-line-soft px-2 text-right font-semibold text-emerald-700 tabular-nums">{t.present}</td>
                <td className={cn("border-t border-app-line-soft px-2 text-right font-semibold tabular-nums", t.absent ? "text-rose-600" : "text-muted-foreground")}>{t.absent}</td>
                <td className="border-t border-app-line-soft px-3 text-right tabular-nums">{hours(t.minutes)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Each guard's month in figures, coloured by attendance rate; a card opens their register. */
export function GuardCards({ rows }: { rows: RegisterEntry[] }) {
  const guards = [...new Map(rows.map((r) => [r.guardId, { id: r.guardId, name: r.guardName, code: r.guardCode }])).values()];
  const cards = guards
    .map((g) => ({ ...g, t: tallyRegister(rows.filter((r) => r.guardId === g.id)) }))
    .sort((a, b) => (a.t.rate ?? 101) - (b.t.rate ?? 101) || a.name.localeCompare(b.name));
  if (cards.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No duties in this month.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((c) => {
        const rate = c.t.rate;
        const tone = rate == null ? "slate" : rate >= 95 ? "emerald" : rate >= 80 ? "amber" : "rose";
        const bar = { slate: "bg-slate-300", emerald: "bg-emerald-500", amber: "bg-amber-400", rose: "bg-rose-500" }[tone];
        const ring = { slate: "border-slate-200", emerald: "border-emerald-200", amber: "border-amber-200", rose: "border-rose-200" }[tone];
        return (
          <Link key={c.id} href={`/console/reports/guard/${c.id}`} className={cn("press block rounded-2xl border bg-card p-4 shadow-e1 transition-colors hover:bg-muted/40", ring)}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-semibold">{c.name}</span>
              <span className="text-lg font-extrabold tabular-nums">{rate == null ? "-" : `${rate}%`}</span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">{c.code}</span>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", bar)} style={{ width: `${rate ?? 0}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1 text-center text-xs">
              <Fig v={c.t.present} l="present" c="text-emerald-700" />
              <Fig v={c.t.late} l="late" c="text-amber-700" />
              <Fig v={c.t.absent} l="absent" c={c.t.absent ? "text-rose-600" : "text-muted-foreground"} />
              <Fig v={hours(c.t.minutes)} l="hours" c="text-sky-700" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function Fig({ v, l, c }: { v: number | string; l: string; c: string }) {
  return (
    <span className="rounded-lg bg-muted/50 py-1.5">
      <span className={cn("block text-sm font-bold tabular-nums", c)}>{v}</span>
      <span className="text-muted-foreground">{l}</span>
    </span>
  );
}

/** One day: every duty with its outcome, worst first. */
export function DayList({ rows }: { rows: RegisterEntry[] }) {
  const sorted = [...rows].sort((a, b) => RANK.indexOf(a.outcome) - RANK.indexOf(b.outcome) || a.startsAt.localeCompare(b.startsAt));
  const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }) : "-");
  if (sorted.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No duties on this day.</p>;
  return (
    <ul className="divide-y divide-app-line-soft">
      {sorted.map((r) => (
        <li key={r.key} className="flex flex-wrap items-center gap-3 px-1 py-2.5">
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold", OUTCOME[r.outcome].cell)}>{OUTCOME[r.outcome].letter}</span>
          <span className="min-w-0 flex-1">
            <Link href={`/console/reports/guard/${r.guardId}`} className="block truncate font-semibold hover:underline">
              {r.guardName}
            </Link>
            <span className="block truncate text-xs text-muted-foreground">
              {r.siteName} · {clock(r.startsAt)}
              {r.endsAt ? `–${clock(r.endsAt)}` : ""}
            </span>
          </span>
          <span className="text-right text-xs">
            <span className="block font-semibold">{OUTCOME[r.outcome].label}</span>
            <span className="text-muted-foreground tabular-nums">
              {r.checkIn ? `In ${clock(r.checkIn)}${r.checkOut ? ` · Out ${clock(r.checkOut)}` : ""}` : "No check-in"}
              {r.sessions > 1 ? ` · ${r.sessions} sessions` : ""}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
