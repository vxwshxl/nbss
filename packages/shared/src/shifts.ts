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
