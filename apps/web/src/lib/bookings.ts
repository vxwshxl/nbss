import { SHIFT_LABEL, type ShiftType } from "@nbss/shared/shifts";
import { services } from "@/content/services";

/**
 * The words a booking is described in, shared by the client's Book guards page
 * and the staff Bookings inbox so both sides read the same status the same way.
 */
export type BookingStatus =
  | "new"
  | "reviewing"
  | "quoted"
  | "accepted"
  | "declined"
  | "withdrawn"
  | "converted";

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  new: "Received",
  reviewing: "Site survey",
  quoted: "Quoted",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
  converted: "Guards deployed",
};

/** What each status means to the client, in one line. */
export const BOOKING_STATUS_NOTE: Record<BookingStatus, string> = {
  new: "The deployment desk has it and will call you.",
  reviewing: "A field officer is arranging a site survey.",
  quoted: "Your quotation is ready: the desk will walk you through it.",
  accepted: "Accepted. Guards are being assigned.",
  declined: "The desk could not take this one on.",
  withdrawn: "You withdrew this request.",
  converted: "Guards are on your site. See My site.",
};

export const SHIFT_PATTERNS = [
  { value: "24x7", label: "Round the clock (24 × 7)" },
  { value: "day", label: "Day shift" },
  { value: "night", label: "Night shift" },
  { value: "custom", label: "Something else" },
] as const;

/** "Night, 24 Hours · 10 days" — what a booking asks for, from the new fields or the old pattern. */
export function bookingWhen(r: {
  shift_types?: string[] | null;
  shift_pattern?: string | null;
  days_required?: number | null;
  duration_months?: number | null;
}): string {
  const shifts = r.shift_types?.length
    ? r.shift_types.map((t) => SHIFT_LABEL[t as ShiftType] ?? t).join(", ")
    : SHIFT_PATTERNS.find((p) => p.value === r.shift_pattern)?.label;
  const length = r.days_required
    ? `${r.days_required} ${r.days_required === 1 ? "day" : "days"}`
    : r.duration_months
      ? r.duration_months % 12 === 0
        ? `${r.duration_months / 12} ${r.duration_months === 12 ? "year" : "years"}`
        : `${r.duration_months} ${r.duration_months === 1 ? "month" : "months"}`
      : null;
  return [shifts, length].filter(Boolean).join(" · ");
}

/** A service not on the list: the client says what it is, and it is kept with the notes. */
export const OTHER_SERVICE = "other";

export const SERVICE_OPTIONS = [...services.map((s) => ({ value: s.slug, label: s.name })), { value: OTHER_SERVICE, label: "Other service" }];

export function serviceName(slug: string): string {
  if (slug === OTHER_SERVICE) return "Other service";
  return services.find((s) => s.slug === slug)?.name ?? slug;
}

/** How long a contract runs: days for an event, months or years for a posting. */
export const CONTRACT_UNITS = [
  { value: "days", label: "Days" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
] as const;

export function withdrawable(status: string): boolean {
  return status === "new" || status === "reviewing" || status === "quoted";
}
