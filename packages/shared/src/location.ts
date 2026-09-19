/**
 * When to write a position, and when to stay quiet.
 *
 * The naive design — a fix every 30 seconds, forwarded to whoever is watching —
 * costs three things at 200 guards: battery on a ₹7,000 Android phone, roughly
 * 5.8 million rows a month, and a realtime message per row per viewer. The last
 * one is the expensive one, because it multiplies by the number of people with
 * a map open.
 *
 * So the policy is adaptive, and it is written here rather than in either client
 * because the phone and the console have to agree on what a gap in a trail
 * means. A guard standing at a gate for four hours genuinely has nothing to
 * report; a guard walking a perimeter has a lot. Distance decides, and a slow
 * heartbeat proves the app is still alive so that silence and death look
 * different on the map.
 *
 * Cost of this policy at 200 guards on 8-hour shifts: ~1.2M rows/month against
 * ~5.8M for a fixed 30s tick, and the same reduction in battery.
 */

export type TrackingMode = "on_duty" | "emergency";

export type PingPolicy = {
  /** Move at least this far and the position is worth writing. */
  minDistanceM: number;
  /** Write anyway after this long, so a stationary guard is not mistaken for a dead app. */
  heartbeatMs: number;
  /** Never write two positions closer together than this, whatever the movement. */
  minIntervalMs: number;
  /**
   * A fix looser than this is discarded rather than accepted as close enough.
   * A 500 m "position" on a live map is worse than no position, because it looks
   * like the guard wandered off site.
   */
  maxAccuracyM: number;
  /** What the OS is asked for. Lower numbers mean more radio and more battery. */
  desiredAccuracy: "balanced" | "high" | "best";
};

/**
 * Normal duty. 50 m is about the width of a compound — far enough that a phone
 * sitting still in a guard hut, jittering its GPS fix by 15 m, writes nothing at
 * all, and close enough that a patrol produces a trail you can follow.
 *
 * The two-minute heartbeat is the number that makes "no ping" readable: a map
 * that has heard nothing for five minutes is reporting a problem, not a pause.
 */
export const ON_DUTY_POLICY: PingPolicy = {
  minDistanceM: 50,
  heartbeatMs: 120_000,
  minIntervalMs: 20_000,
  maxAccuracyM: 200,
  desiredAccuracy: "balanced",
};

/**
 * An SOS is live at this guard's site.
 *
 * Everything inverts. Battery stops mattering — the shift is now at most the
 * few minutes until someone arrives — and what matters instead is that the
 * people responding can see where everyone is, second by second. So every
 * client at that site is switched to this until the alert is resolved.
 */
export const EMERGENCY_POLICY: PingPolicy = {
  minDistanceM: 10,
  heartbeatMs: 15_000,
  minIntervalMs: 5_000,
  maxAccuracyM: 500,
  desiredAccuracy: "best",
};

export function policyFor(mode: TrackingMode): PingPolicy {
  return mode === "emergency" ? EMERGENCY_POLICY : ON_DUTY_POLICY;
}

export type Fix = {
  lat: number;
  lng: number;
  accuracyM: number;
  /** Epoch milliseconds, from the device. Recorded, never trusted for ordering. */
  at: number;
};

export type PingDecision =
  | { send: true; reason: "moved" | "heartbeat" | "first" }
  | { send: false; reason: "too_soon" | "not_moved" | "inaccurate" };

/**
 * Should this fix be written?
 *
 * `previous` is the last fix actually sent, not the last one seen — otherwise a
 * guard drifting 40 m at a time would never trip the distance rule and never
 * appear to move at all.
 *
 * Pure, and takes `now` rather than reading the clock, so the Android foreground
 * service, the iOS significant-change callback and the browser's
 * `watchPosition` all reach the same verdict from the same inputs, and so this
 * can be tested without waiting two minutes.
 */
export function shouldSendPing(
  fix: Fix,
  previous: Fix | null,
  mode: TrackingMode,
  now: number,
  distanceMetres: (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => number,
): PingDecision {
  const policy = policyFor(mode);

  // Accuracy first. A useless fix should not reset the heartbeat clock, or a
  // phone with a poor sky view would go quiet and still look healthy.
  if (!Number.isFinite(fix.accuracyM) || fix.accuracyM > policy.maxAccuracyM) {
    return { send: false, reason: "inaccurate" };
  }

  if (!previous) return { send: true, reason: "first" };

  const elapsed = now - previous.at;

  // The floor. Protects against a burst of callbacks when a phone reacquires a
  // signal, which Android in particular likes to deliver all at once.
  if (elapsed < policy.minIntervalMs) return { send: false, reason: "too_soon" };

  if (distanceMetres(previous, fix) >= policy.minDistanceM) {
    return { send: true, reason: "moved" };
  }

  if (elapsed >= policy.heartbeatMs) return { send: true, reason: "heartbeat" };

  return { send: false, reason: "not_moved" };
}

/**
 * How long before a guard is shown as out of contact.
 *
 * Three missed heartbeats rather than one: a phone in a lift, a tunnel, or a
 * concrete stairwell drops a ping routinely, and an amber dot that cries wolf
 * every shift is a dot people learn to ignore.
 */
export const STALE_AFTER_MS = ON_DUTY_POLICY.heartbeatMs * 3;
export const OFFLINE_AFTER_MS = ON_DUTY_POLICY.heartbeatMs * 8;

export type Freshness = "live" | "stale" | "offline";

export function freshness(lastSeenAt: number, now: number): Freshness {
  const age = now - lastSeenAt;
  if (age <= STALE_AFTER_MS) return "live";
  if (age <= OFFLINE_AFTER_MS) return "stale";
  return "offline";
}

/**
 * How long a trail is kept at full resolution.
 *
 * Long enough to answer a client's "where was your man at 2am last Tuesday",
 * short enough that the table does not become the largest thing in the database.
 * Older rows are thinned to one position every ten minutes rather than deleted,
 * which keeps a year of shape for a fraction of the size.
 */
export const HISTORY_FULL_DAYS = 30;
export const HISTORY_DOWNSAMPLED_DAYS = 365;
