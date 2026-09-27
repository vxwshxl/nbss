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
  quoted: "Your quotation is ready — the desk will walk you through it.",
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

export const SERVICE_OPTIONS = services.map((s) => ({ value: s.slug, label: s.name }));

export function serviceName(slug: string): string {
  return services.find((s) => s.slug === slug)?.name ?? slug;
}

export function withdrawable(status: string): boolean {
  return status === "new" || status === "reviewing" || status === "quoted";
}
