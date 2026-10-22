/**
 * Nibo's sense of timing: when he may speak, and how that adapts to the person.
 *
 * A mascot that talks every few seconds is noise; one that never talks is
 * furniture. The rule here: he speaks only when it's likely to help, and he
 * learns how often that is from what the person does with what he says.
 *
 *  - A level the person picks (quiet / normal / chatty / off) sets the base gap
 *    between tips and a daily cap.
 *  - Closing a tip, or letting it time out, stretches the gap (×1.6 / ×1.25);
 *    acting on one shrinks it (×0.8). The multiplier drifts back to 1 over a
 *    few days, so one bad afternoon isn't permanent.
 *  - A tip someone closed or acted on isn't repeated for a week. A data nudge
 *    ("3 bookings waiting") comes back when its count changes, at most every 4 h.
 *  - "Not today" snoozes until local midnight.
 *
 * Stored per person (and per device) in localStorage; nothing leaves the
 * browser. Every read/write tolerates storage being unavailable.
 */

export type NiboLevel = "quiet" | "normal" | "chatty" | "off";
export type Outcome = "acted" | "closed" | "ignored";

type Memory = {
  level: NiboLevel;
  /** Multiplier on the base gap; >1 = talk less. */
  pace: number;
  paceAt: number;
  snoozeUntil: number;
  lastSpokeAt: number;
  /** Tips spoken today: [yyyy-mm-dd, count]. */
  today: [string, number];
  /** tip id → when it was last shown and what happened. */
  tips: Record<string, { at: number; outcome?: Outcome }>;
};

const BASE_GAP: Record<Exclude<NiboLevel, "off">, number> = {
  quiet: 6 * 60_000,
  normal: 150_000,
  chatty: 60_000,
};
const DAILY_CAP: Record<Exclude<NiboLevel, "off">, number> = { quiet: 3, normal: 8, chatty: 20 };
const REPEAT_AFTER = 7 * 24 * 3_600_000;
const NUDGE_REPEAT_AFTER = 4 * 3_600_000;
/** Help with a form error is asked-for help: only a short breath between them. */
const HELP_GAP = 6_000;

const day = (t = Date.now()) => new Date(t).toLocaleDateString("en-CA");

function blank(): Memory {
  return { level: "normal", pace: 1, paceAt: Date.now(), snoozeUntil: 0, lastSpokeAt: 0, today: [day(), 0], tips: {} };
}

export class NiboBrain {
  private key: string;
  private m: Memory;

  constructor(person: string, defaults: { level?: NiboLevel } = {}) {
    this.key = `nibo-brain-v1:${person}`;
    this.m = blank();
    if (defaults.level) this.m.level = defaults.level;
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) this.m = { ...this.m, ...(JSON.parse(raw) as Partial<Memory>) };
    } catch {}
    // Drift the pace back toward 1: a tenth of the way per day since last set.
    const days = (Date.now() - this.m.paceAt) / 86_400_000;
    if (days > 0.5) {
      this.m.pace = 1 + (this.m.pace - 1) * Math.pow(0.9, days);
      this.m.paceAt = Date.now();
    }
    if (this.m.today[0] !== day()) this.m.today = [day(), 0];
  }

  private save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.m));
    } catch {}
  }

  get level(): NiboLevel {
    return this.m.level;
  }

  setLevel(level: NiboLevel) {
    this.m.level = level;
    if (level !== "off") this.m.snoozeUntil = 0;
    this.m.pace = 1;
    this.m.paceAt = Date.now();
    this.save();
  }

  /** "Not today": quiet until local midnight. */
  snoozeToday() {
    const end = new Date();
    end.setHours(24, 0, 0, 0);
    this.m.snoozeUntil = end.getTime();
    this.save();
  }

  get snoozed(): boolean {
    return Date.now() < this.m.snoozeUntil;
  }

  /** Milliseconds until a regular tip may be spoken (0 = now). */
  wait(): number {
    if (this.m.level === "off" || this.snoozed) return Infinity;
    if (this.m.today[0] === day() && this.m.today[1] >= DAILY_CAP[this.m.level]) return Infinity;
    const gap = BASE_GAP[this.m.level] * this.m.pace;
    return Math.max(0, this.m.lastSpokeAt + gap - Date.now());
  }

  /**
   * May this tip be shown? `kind`: "help" (a form error , the person is stuck
   * right now), "nudge" (live data), "tip" (a page hint).
   */
  may(id: string, kind: "help" | "nudge" | "tip"): boolean {
    if (this.m.level === "off" || this.snoozed) return false;
    const seen = this.m.tips[id];
    if (kind === "help") return Date.now() - this.m.lastSpokeAt > HELP_GAP;
    if (seen) {
      const age = Date.now() - seen.at;
      if (kind === "nudge" && age < NUDGE_REPEAT_AFTER) return false;
      if (kind === "tip" && seen.outcome && seen.outcome !== "ignored" && age < REPEAT_AFTER) return false;
      if (kind === "tip" && seen.outcome === "ignored" && age < 2 * 86_400_000) return false;
    }
    return this.wait() === 0;
  }

  spoke(id: string, kind: "help" | "nudge" | "tip" = "tip") {
    this.m.lastSpokeAt = Date.now();
    if (this.m.today[0] !== day()) this.m.today = [day(), 0];
    if (kind === "nudge" || kind === "tip") this.m.today[1] += 1;
    this.m.tips[id] = { at: Date.now() };
    this.prune();
    this.save();
  }

  /** What the person did with what he said; tunes how often he speaks. */
  heard(id: string, outcome: Outcome) {
    const t = this.m.tips[id];
    if (t) t.outcome = outcome;
    const factor = outcome === "acted" ? 0.8 : outcome === "closed" ? 1.6 : 1.25;
    this.m.pace = Math.min(6, Math.max(0.6, this.m.pace * factor));
    this.m.paceAt = Date.now();
    this.save();
  }

  /** Keep memory small: forget tips older than a month. */
  private prune() {
    const cutoff = Date.now() - 30 * 86_400_000;
    for (const [id, t] of Object.entries(this.m.tips)) if (t.at < cutoff) delete this.m.tips[id];
  }
}
