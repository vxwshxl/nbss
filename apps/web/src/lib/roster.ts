/**
 * The roster's vocabulary, shared by the console screens and their actions.
 * Times are wall-clock IST, as the desk thinks about them.
 */

export const IST = "Asia/Kolkata";

/** ISO weekdays, Monday first, as `site_postings.days` stores them. */
export const WEEKDAYS = [
  { value: 1, short: "Mon" },
  { value: 2, short: "Tue" },
  { value: 3, short: "Wed" },
  { value: 4, short: "Thu" },
  { value: 5, short: "Fri" },
  { value: 6, short: "Sat" },
  { value: 7, short: "Sun" },
] as const;

/** "20:00:00" → "8:00 pm". */
export function clock(value: string | null | undefined): string {
  if (!value) return "—";
  const [h, m] = value.split(":");
  const hour = Number(h);
  if (!Number.isFinite(hour)) return value;
  return `${hour % 12 === 0 ? 12 : hour % 12}:${(m ?? "00").slice(0, 2)} ${hour < 12 ? "am" : "pm"}`;
}

/** "8:00 pm – 8:00 am". */
export function windowLabel(starts: string, ends: string): string {
  return `${clock(starts)} – ${clock(ends)}`;
}

/** "Every day", "Mon–Fri", or "Mon, Wed, Sat". */
export function daysLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return "Every day";
  if (sorted.join() === "1,2,3,4,5") return "Mon–Fri";
  if (sorted.join() === "1,2,3,4,5,6") return "Mon–Sat";
  return sorted.map((d) => WEEKDAYS[d - 1]?.short ?? d).join(", ");
}

/** An IST calendar date, "2026-09-28". */
export function istDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: IST });
}

/** The IST calendar date `n` days from today. */
export function istDay(n: number): string {
  return istDate(new Date(Date.now() + n * 86_400_000));
}

/** "Mon 28" for a column heading. */
export function dayHeading(date: string): { weekday: string; day: string } {
  const d = new Date(`${date}T12:00:00+05:30`);
  return {
    weekday: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: IST }),
    day: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: IST }),
  };
}

/** "20:00" + "2026-09-28" → the instant, in IST. */
export function istInstant(date: string, time: string): Date {
  return new Date(`${date}T${time.slice(0, 5)}:00+05:30`);
}

/** A time field's value, "HH:MM", or null when it is not one. */
export function parseTime(value: FormDataEntryValue | string | null): string | null {
  const s = String(value ?? "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null;
}
