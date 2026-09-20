/**
 * The company's own details, for the handful of places both clients quote them.
 *
 * apps/web/src/content/site.ts remains the fuller source — it carries the address, the
 * office hours, the social profiles, the credentials, all of which only the website
 * renders. What lives here is the subset the Expo app also needs, so that a phone number
 * shown on a guard's duty screen is the same one printed in the website's footer.
 *
 * `site.ts` imports these rather than restating them, which is the point: the previous
 * arrangement had the app hardcoding a placeholder number, and the moment a real one is
 * quoted in two files it starts drifting.
 */

export const COMPANY = {
  name: "National Bodo Security Service",
  shortName: "NBSS",
  tagline: "Your Safety, Our Responsibility.",
  phone: "+91 70020 71628",
  /** IANA zone for every date and clock either client formats. */
  timeZone: "Asia/Kolkata",
  city: "Kokrajhar",
  region: "Bodoland Territorial Council (BTC)",
  state: "Assam",
  /** The deployment desk is staffed around the clock; the office is not. */
  deskHours: "24 × 7",
  officeHours: "Mon–Sat, 9:00 AM – 6:00 PM IST",
} as const;

/** Strips a phone number down to something a `tel:` link accepts. */
export function tel(value: string): string {
  return value.replace(/[\s\-()]/g, "");
}

/**
 * A clock time in IST, 12-hour, the way the client, the guards and the callers all say
 * it. The zone is printed rather than assumed.
 */
export function istTime(value: string | Date | number): string {
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: COMPANY.timeZone,
  });
}
