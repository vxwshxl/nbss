import type { NiboMood } from "@/components/nibo/nibo";

/** Something Nibo might say. */
export type NiboLine = {
  /** Stable id: what the brain remembers it by (nudges include their count). */
  id: string;
  /** help = a form error right now; nudge = live data; tip = a page hint. */
  kind: "help" | "nudge" | "tip";
  text: string;
  mood?: NiboMood;
  /** At most two; the first is the main one. */
  actions?: NiboAction[];
  /** CSS selector of what he is talking about: he flies next to it. */
  target?: string;
  /** Higher first when several are due. */
  priority?: number;
};

export type NiboAction =
  | { label: string; href: string }
  /** Opens the assistant and asks this. */
  | { label: string; ask: string }
  /** Scrolls this into view and focuses it. */
  | { label: string; focus: string };
