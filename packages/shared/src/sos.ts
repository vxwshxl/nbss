/**
 * The panic button.
 *
 * One guard on a site presses it, and everyone who could do something about it
 * finds out at once: the other guards standing on that site, every admin and
 * supervisor wherever they are, and the client who owns the site.
 *
 * Two things shape the design more than anything else.
 *
 * First, it has to work when the app is closed. A guard being attacked is not
 * going to have the console open on another guard's phone, so the delivery path
 * is a push notification with a high-priority channel — not a realtime
 * subscription, which only reaches an app that is already running.
 *
 * Second, a false alarm is expected, not exceptional. A phone in a pocket, a
 * misread screen at 3am. So raising one is easy, cancelling one is easy and
 * blameless, and the record distinguishes "resolved" from "false alarm" without
 * either being an accusation.
 */

export type SosStatus = "active" | "acknowledged" | "resolved" | "false_alarm";

export const SOS_STATUS_LABEL: Record<SosStatus, string> = {
  active: "Active",
  acknowledged: "Help on the way",
  resolved: "Resolved",
  false_alarm: "False alarm",
};

/** Whether the alarm is still ringing. Drives the siren and the dense tracking. */
export function isLive(status: SosStatus): boolean {
  return status === "active" || status === "acknowledged";
}

/** Why the guard pressed it. Kept short: this is chosen under stress, or not at all. */
export type SosKind = "intruder" | "medical" | "fire" | "assault" | "other";

export const SOS_KIND_LABEL: Record<SosKind, string> = {
  intruder: "Intruder",
  medical: "Medical",
  fire: "Fire",
  assault: "Assault",
  other: "Emergency",
};

/**
 * The default. A guard holding the button for three seconds and nothing else has
 * said everything that matters — that they need help, and where they are. Making
 * them pick a category first would be a form between a person and their help.
 */
export const DEFAULT_SOS_KIND: SosKind = "other";

/**
 * Hold, not tap.
 *
 * Three seconds is long enough that a pocket cannot do it and short enough that
 * someone frightened can. A confirmation dialog was the alternative and is worse:
 * it needs a second accurate tap at exactly the moment accuracy is gone.
 */
export const SOS_HOLD_MS = 3_000;

/**
 * How long an unacknowledged alert keeps re-notifying.
 *
 * A single notification at 3am loses to a phone on silent. It repeats until a
 * human acknowledges it, and then stops — the point is to reach someone, not to
 * punish the people who already answered.
 */
export const SOS_RENOTIFY_EVERY_MS = 60_000;
export const SOS_RENOTIFY_GIVE_UP_MS = 15 * 60_000;

/** Who a given alert reached, and therefore who the console shows as notified. */
export type SosAudience = "on_duty_guard" | "staff" | "client";

export const SOS_AUDIENCE_LABEL: Record<SosAudience, string> = {
  on_duty_guard: "Guards on site",
  staff: "Admins and supervisors",
  client: "Client",
};

/**
 * Everyone selected reaches the alert, with one caveat worth stating in code
 * rather than in a meeting: the client is told, and a false alarm therefore
 * becomes a conversation with the customer. `sites.notify_client_on_sos` exists
 * so a site can be opted out without a deploy.
 */
export const DEFAULT_AUDIENCES: readonly SosAudience[] = ["on_duty_guard", "staff", "client"];

/** What a responder is telling everyone else when they acknowledge. */
export type SosResponse = "responding" | "on_scene" | "cannot_respond";

export const SOS_RESPONSE_LABEL: Record<SosResponse, string> = {
  responding: "On the way",
  on_scene: "On scene",
  cannot_respond: "Cannot respond",
};
