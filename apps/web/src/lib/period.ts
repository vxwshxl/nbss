/**
 * The period a log page shows: a day (the default), a month or a year, in IST.
 * Read from `?period=day|month|year&at=YYYY-MM-DD|YYYY-MM|YYYY`, so a page can be
 * linked to and stepped back through. Shared by every log in the console.
 */

export type Period = "day" | "month" | "year";

const IST = "Asia/Kolkata";

/** Today in IST, as YYYY-MM-DD. */
export function istToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: IST });
}

/** The period's key for the one holding `today`: "2026-10-30", "2026-10" or "2026". */
export function currentAt(period: Period, today: string): string {
  return period === "year" ? today.slice(0, 4) : period === "month" ? today.slice(0, 7) : today;
}

/** The period asked for in the URL, or today. */
export function readPeriod(params: { period?: string; at?: string }, today: string): { period: Period; at: string } {
  const period: Period = params.period === "month" || params.period === "year" ? params.period : "day";
  const a = params.at ?? "";
  const ok = period === "year" ? /^\d{4}$/.test(a) : period === "month" ? /^\d{4}-\d{2}$/.test(a) : /^\d{4}-\d{2}-\d{2}$/.test(a);
  return { period, at: ok ? a : currentAt(period, today) };
}

/** The IST start and end (exclusive) of a period. */
export function periodBounds(period: Period, at: string): { from: Date; to: Date } {
  const start = (d: string) => new Date(`${d}T00:00:00+05:30`);
  if (period === "year") {
    const y = Number(at.slice(0, 4));
    return { from: start(`${y}-01-01`), to: start(`${y + 1}-01-01`) };
  }
  if (period === "month") {
    const [y, m] = at.split("-").map(Number) as [number, number];
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    return { from: start(`${at}-01`), to: start(`${next}-01`) };
  }
  const from = start(at);
  return { from, to: new Date(from.getTime() + 86_400_000) };
}

/** The period `by` steps before or after `at`. */
export function stepPeriod(period: Period, at: string, by: number): string {
  if (period === "year") return String(Number(at) + by);
  if (period === "month") {
    const [y, m] = at.split("-").map(Number) as [number, number];
    const d = new Date(Date.UTC(y, m - 1 + by, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return new Date(Date.parse(`${at}T12:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10);
}

/** `at` moved into another period kind: a day keeps its month and year, a year opens on this month or January. */
export function convertAt(to: Period, at: string, today: string): string {
  if (to === "year") return at.slice(0, 4);
  if (to === "month") return at.length >= 7 ? at.slice(0, 7) : at === today.slice(0, 4) ? today.slice(0, 7) : `${at}-01`;
  if (at.length === 10) return at;
  if (today.startsWith(at)) return today;
  return at.length === 7 ? `${at}-01` : `${at}-01-01`;
}

/** "Today · Friday, 30 October 2026", "October 2026", "2026". */
export function periodTitle(period: Period, at: string, today: string): string {
  if (period === "year") return at;
  if (period === "month") return new Date(`${at}-15T12:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: IST });
  const label = new Date(`${at}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: IST });
  if (at === today) return `Today · ${label}`;
  if (at === stepPeriod("day", today, -1)) return `Yesterday · ${label}`;
  return label;
}

/** "today", "in October 2026", "in 2026": for a sentence such as "No notes today". */
export function periodPhrase(period: Period, at: string, today: string): string {
  if (period === "day") return at === today ? "today" : `on ${periodTitle(period, at, today).replace(/^\w+ · /, "")}`;
  return `in ${periodTitle(period, at, today)}`;
}
