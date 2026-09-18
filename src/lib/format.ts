const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Format an amount stored in paise as Indian Rupees. */
export function formatINR(paise: number): string {
  return inr.format(paise / 100);
}

const num = new Intl.NumberFormat("en-IN");
export function formatNumber(n: number): string {
  return num.format(n);
}

/** Human-readable byte size: 0 B, 12.3 KB, 4.5 MB, 1.2 GB. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  const digits = value >= 100 || i === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[i]}`;
}

const IST = "Asia/Kolkata";

// The platform-wide date format (super-admin configurable). One value, applied
// everywhere via formatDate / formatISODate. It's a module variable so the sync
// formatters can read it; the root layout hydrates it on the server, and
// DateFormatSync mirrors it on the client.
export type DateFormatKey =
  | "dd-mmm-yyyy"
  | "d-mmm-yyyy"
  | "dd/mm/yyyy"
  | "yyyy-mm-dd"
  | "mmm-d-yyyy";

const FORMAT_OPTS: Record<DateFormatKey, Intl.DateTimeFormatOptions> = {
  "dd-mmm-yyyy": { day: "2-digit", month: "short", year: "numeric" },
  "d-mmm-yyyy": { day: "numeric", month: "short", year: "numeric" },
  "dd/mm/yyyy": { day: "2-digit", month: "2-digit", year: "numeric" },
  "yyyy-mm-dd": { year: "numeric", month: "2-digit", day: "2-digit" },
  "mmm-d-yyyy": { month: "short", day: "numeric", year: "numeric" },
};
const FORMAT_LOCALE: Record<DateFormatKey, string> = {
  "dd-mmm-yyyy": "en-GB",
  "d-mmm-yyyy": "en-GB",
  "dd/mm/yyyy": "en-GB",
  "yyyy-mm-dd": "en-CA",
  "mmm-d-yyyy": "en-US",
};

export const DATE_FORMAT_OPTIONS: { value: DateFormatKey; label: string }[] = [
  { value: "dd-mmm-yyyy", label: "01 May 2026" },
  { value: "d-mmm-yyyy", label: "1 May 2026" },
  { value: "dd/mm/yyyy", label: "01/05/2026" },
  { value: "yyyy-mm-dd", label: "2026-05-01" },
  { value: "mmm-d-yyyy", label: "May 1, 2026" },
];

let currentFormat: DateFormatKey = "dd-mmm-yyyy";
export function setDateFormat(key: DateFormatKey): void {
  if (FORMAT_OPTS[key]) currentFormat = key;
}
export function getDateFormatKey(): DateFormatKey {
  return currentFormat;
}

function render(date: Date): string {
  const key = currentFormat;
  return date.toLocaleDateString(FORMAT_LOCALE[key], { ...FORMAT_OPTS[key], timeZone: IST });
}

/** Global date format (IST), honoring the configured platform format. */
export function formatDate(value: string | Date): string {
  return render(new Date(value));
}

/** Global date + time format in IST, e.g. "01 Jun 2026, 3:45 pm". */
export function formatDateTime(value: string | Date): string {
  return `${render(new Date(value))}, ${new Date(value).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  })}`;
}

/**
 * Format a "HH:MM" / "HH:MM:SS" clock string as 12-hour time, e.g.
 * "09:00" -> "9:00 AM", "13:45:00" -> "1:45 PM". Returns "" when null/blank so
 * callers can inline it directly. Used by the timetable & daily-periods grids.
 */
export function formatTime12(t: string | null | undefined): string {
  if (!t) return "";
  const [hRaw, mRaw = "0"] = t.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Today's date as YYYY-MM-DD in IST (the canonical "current day" for the app). */
export function istToday(): string {
  // en-CA renders ISO-style YYYY-MM-DD; the IST timezone pins the day boundary.
  return new Date().toLocaleDateString("en-CA", { timeZone: IST });
}

/** A YYYY-MM-DD string formatted in the configured format, without TZ drift. */
export function formatISODate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  // Noon UTC keeps the calendar day stable when rendered in IST.
  return render(new Date(Date.UTC(y, m - 1, d, 12)));
}
