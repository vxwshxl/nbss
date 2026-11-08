/**
 * The four shift types the agency works in, as the desk says them.
 *
 * The times are the defaults seeded by 0022_field_ops.sql into `shift_types`,
 * which is what the roster actually reads; these are here so a form can fill
 * its time fields the moment a type is picked, without a round trip.
 */
export type ShiftType = "morning" | "evening" | "night" | "full_day";

export const SHIFT_TYPES: { code: ShiftType; label: string; starts: string; ends: string; hours: number }[] = [
  { code: "morning", label: "Morning", starts: "06:00", ends: "14:00", hours: 8 },
  { code: "evening", label: "Evening", starts: "14:00", ends: "22:00", hours: 8 },
  { code: "night", label: "Night", starts: "22:00", ends: "06:00", hours: 8 },
  { code: "full_day", label: "24 Hours", starts: "06:00", ends: "06:00", hours: 24 },
];

export const SHIFT_LABEL: Record<ShiftType, string> = {
  morning: "Morning",
  evening: "Evening",
  night: "Night",
  full_day: "24 Hours",
};

export function isShiftType(v: unknown): v is ShiftType {
  return v === "morning" || v === "evening" || v === "night" || v === "full_day";
}

/** The type whose window these times are, or null for a custom window. */
export function shiftTypeFor(starts: string, ends: string): ShiftType | null {
  const s = starts.slice(0, 5);
  const e = ends.slice(0, 5);
  return SHIFT_TYPES.find((t) => t.starts === s && t.ends === e)?.code ?? null;
}

/** "Night · 10 pm – 6 am", for a list row. */
export function shiftTypeLabel(type: string | null | undefined): string | null {
  return isShiftType(type) ? SHIFT_LABEL[type] : null;
}

// ---------------------------------------------------------------- breaks
// A post's daily window may have breaks: 8 am – 8 pm with 12 – 1 off is two duties,
// 8 – 12 and 1 – 8 (site_postings.breaks, 0074). The website and the app check and
// describe them the same way from here; the database splits the day the same way.

/** "HH:MM" when it is one, else null. */
function hhmm(value: string | null | undefined): string | null {
  const s = String(value ?? "").trim().slice(0, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null;
}

/** "20:00" or "20:00:00" → "8:00 pm". */
function clock(value: string): string {
  const [h, m] = value.split(":");
  const hour = Number(h);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${(m ?? "00").slice(0, 2)} ${hour < 12 ? "am" : "pm"}`;
}

/** A time off inside a post's daily window, "HH:MM" both. */
export type Break = { starts: string; ends: string };

/** `site_postings.breaks` as stored (jsonb), read safely. */
export function readBreaks(value: unknown): Break[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((b) => {
    const s = hhmm((b as Break | null)?.starts);
    const e = hhmm((b as Break | null)?.ends);
    return s && e ? [{ starts: s, ends: e }] : [];
  });
}

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
/** Minutes after the window's start, round the clock. */
const offset = (start: string, t: string) => (minutes(t) - minutes(start) + 1440) % 1440;

/**
 * Breaks sorted into the order they fall in the window, or the reason they do not fit:
 * each must start after the window starts, end before it ends, and not overlap another.
 * The database writes one duty per part of the day between them.
 */
export function checkBreaks(starts: string, ends: string, breaks: Break[]): { ok: true; breaks: Break[] } | { ok: false; error: string } {
  const len = offset(starts, ends) || 1440;
  const sorted = [...breaks].sort((a, b) => offset(starts, a.starts) - offset(starts, b.starts));
  if (sorted.length > 6) return { ok: false, error: "A post can have up to six breaks." };
  let last = 0;
  for (const b of sorted) {
    const s = offset(starts, b.starts);
    const e = offset(starts, b.ends);
    const label = `${clock(b.starts)} – ${clock(b.ends)}`;
    if (s === 0 || e <= s || e >= len) return { ok: false, error: `The break ${label} must sit inside the shift's hours.` };
    if (s < last) return { ok: false, error: `The break ${label} overlaps another break.` };
    last = e;
  }
  return { ok: true, breaks: sorted };
}

/** The parts of the day a post covers: "8:00 am – 12:00 pm" and "1:00 pm – 8:00 pm" for one break. */
export function parts(starts: string, ends: string, breaks: Break[]): { starts: string; ends: string }[] {
  const s5 = starts.slice(0, 5);
  const e5 = ends.slice(0, 5);
  const checked = checkBreaks(s5, e5, breaks);
  const list = checked.ok ? checked.breaks : [];
  const out: { starts: string; ends: string }[] = [];
  let from = s5;
  for (const b of list) {
    out.push({ starts: from, ends: b.starts });
    from = b.ends;
  }
  out.push({ starts: from, ends: e5 });
  return out;
}

/** "8:00 am – 8:00 pm", or with breaks "8:00 am – 12:00 pm, 1:00 pm – 8:00 pm". */
export function hoursLabel(starts: string, ends: string, breaks: Break[] = []): string {
  if (breaks.length === 0) return `${clock(starts)} – ${clock(ends)}`;
  return parts(starts, ends, breaks)
    .map((p) => `${clock(p.starts)} – ${clock(p.ends)}`)
    .join(", ");
}

