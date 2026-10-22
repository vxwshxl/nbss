import type { NiboLine } from "@/lib/nibo/types";

/**
 * One gentle hint per page, the first times someone opens it. Short, about the
 * page in front of them, each with something to do. First matching prefix wins,
 * so the longer paths come first.
 */
const PAGE_TIPS: [prefix: string, tip: Omit<NiboLine, "kind" | "id">][] = [
  ["/console/attendance", { text: "Punches flagged for review are the ones to look at first. I can list them.", mood: "think", actions: [{ label: "What needs review?", ask: "Which attendance entries are waiting for review today?" }] }],
  ["/console/sites", { text: "Every site needs a geofence before a guard can check in there. Draw it on the map.", mood: "think" }],
  ["/console/roster", { text: "Want to know who is short of cover this week?", mood: "think", actions: [{ label: "Gaps this week", ask: "Which sites are short of guards on the roster this week?" }] }],
  ["/console/guards", { text: "Open a guard to see their last two weeks, reset a PIN or post them to a site.", mood: "happy" }],
  ["/console/sos", { text: "A live alert stays on top until someone stands it down. Every call is logged.", mood: "think" }],
  ["/console/bookings", { text: "New requests show first. Quote, then deploy once the client agrees.", mood: "happy" }],
  ["/console/users", { text: "Use View as in the top bar to see the console exactly as someone else does.", mood: "wave" }],
  ["/console/guide", { text: "Everything you need to run the website, the app and the database is here.", mood: "cheer" }],
  ["/console/duty", { text: "Tap check in when you reach the gate. I'll tell you if you're outside the fence.", mood: "wave", actions: [{ label: "My hours", ask: "How many hours have I worked this month?" }] }],
  ["/console/site", { text: "Hi! Ask me who is on your gate right now, or the man-hours this month.", mood: "wave", actions: [{ label: "Who's on duty?", ask: "Is anyone on my gate right now?" }] }],
  ["/console/book", { text: "Tell us the site, the hours and how many guards. A rough number is fine.", mood: "happy" }],
  ["/console", { text: "Hi, I'm Nibo! Ask me anything about duty, sites, hours or the roster.", mood: "wave", actions: [{ label: "Ask Nibo", ask: "What needs my attention today?" }] }],
];

export function pageTip(pathname: string): NiboLine | null {
  const hit = PAGE_TIPS.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  if (!hit) return null;
  return { ...hit[1], kind: "tip", id: `tip:${hit[0]}` };
}
