/**
 * Everything the film says: the chapter titles and one-line points on screen,
 * and the voice-over read over each point.
 *
 * `points[i]` and `voice[i]` go together — the line is spoken while point i is
 * lit, and the capture's steps say which point each belongs to. Keep points to
 * one short line, and the voice to a few words: the film should never wait on it.
 *
 * Plain, erasable TypeScript, so the Node scripts can import it as well.
 */

export type ChapterScript = {
  title: string;
  heading: string;
  points: string[];
  voice: string[];
};

/** "NBSS" is spelt out for the voice, which would otherwise try to say it as a word. */
const N = "N B S S";

export const INTRO_VOICE = `Meet ${N}. One platform for your whole security agency.`;
export const CONTENTS_VOICE = "Ten chapters. Every role.";
export const OUTRO_VOICE = `${N}. Your safety, our responsibility.`;

export const SCRIPT: Record<string, ChapterScript> = {
  website: {
    title: "The website",
    heading: "A website that brings clients in",
    points: ["Four clear menus", "A page for every service", "Built for phones too", "One sign-in for everyone"],
    voice: [
      "Four clear menus.",
      "A page for every service.",
      "Works on any phone.",
      "One sign-in for everyone.",
    ],
  },
  "client-book": {
    title: "Clients book online",
    heading: "New clients book in minutes",
    points: [
      "Sign up from the sign-in page",
      "Name, company, phone, email",
      "A 6-digit code by email",
      "Service, site, guards, shift",
      "A reference for every request",
    ],
    voice: [
      "Clients sign up here.",
      "Name, company, phone, email.",
      "Verify with an email code.",
      "Book guards in one form.",
      "Every request gets a reference.",
    ],
  },
  admin: {
    title: "Every role",
    heading: "Every role, its own dashboard",
    points: ["Code or PIN to sign in", "The right dashboard, automatically", "Live figures at a glance", "An assistant that reads the screen"],
    voice: [
      "Sign in with a code and PIN.",
      "Each role gets its own dashboard.",
      "Live figures, up front.",
      "Ask the assistant anything.",
    ],
  },
  quote: {
    title: "Booking to quote",
    heading: "From booking to quotation",
    points: ["Every request in one inbox", "Click a row for details", "Send a monthly quote", "The client sees it instantly"],
    voice: [
      "Every booking, one inbox.",
      "Click a row for details.",
      "Send a quote.",
      "The client sees it instantly.",
    ],
  },
  sites: {
    title: "Sites & geofences",
    heading: "Sites and geofences",
    points: [
      "Every site on a live map",
      "Guards on duty, with phones",
      "Client, fence, shifts, SOS",
      "Draw a new fence on the map",
      "Hand the booking to the site",
    ],
    voice: [
      "Every site on a live map.",
      "Who's on duty, with their number.",
      "Client, fence, shifts and SOS.",
      "Draw a new fence.",
      "Hand over the booking.",
    ],
  },
  roster: {
    title: "The roster",
    heading: "Who guards where",
    points: [
      "Needed vs. on duty, per site",
      "Post a guard to a site",
      "The week fills itself in",
      "No-shows flagged instantly",
      "Off-roster check-ins held",
    ],
    voice: [
      "Needed versus on duty.",
      "Post a guard to a site.",
      "The week fills itself in.",
      "No-shows flagged instantly.",
      "Wrong site? Held for approval.",
    ],
  },
  attendance: {
    title: "Geofenced attendance",
    heading: "Attendance by geofence",
    points: [
      "Tonight's post on a live map",
      "Too far? It shows the way",
      "Inside the fence: green",
      "The office sees it live",
      "Proof of where they stood",
    ],
    voice: [
      "A live map to the post.",
      "Too far? Get directions.",
      "Inside the fence, it turns green.",
      "The office sees it live.",
      "Every punch is proof.",
    ],
  },
  sos: {
    title: "SOS",
    heading: "SOS in one press",
    points: [
      "Hold three seconds",
      "The office sees it at once",
      "Supervisors alerted by phone",
      "The guard sees help coming",
      "Closed, with a full record",
    ],
    voice: [
      "Hold three seconds for help.",
      "The office is alerted.",
      "Supervisors too.",
      "Help is on the way.",
      "Closed, and fully recorded.",
    ],
  },
  stats: {
    title: "Stats & people",
    heading: "Stats and people",
    points: ["A live dashboard", "30 days per guard", "Users by role", "SOS response times"],
    voice: [
      "A live dashboard.",
      "Thirty days per guard.",
      "Users by role.",
      "SOS response times.",
    ],
  },
  client: {
    title: "The client's view",
    heading: "What clients see",
    points: ["Their gate, live", "Tap a guard for details", "Same view in the app", "Only their own sites"],
    voice: [
      "Clients see their gate, live.",
      "Tap a guard for details.",
      "Same view in the app.",
      "Only their own sites.",
    ],
  },
};
