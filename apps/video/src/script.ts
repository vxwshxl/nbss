/**
 * Everything the film says: the chapter titles and one-line points on screen,
 * and the voice-over read over each point.
 *
 * `points[i]` and `voice[i]` go together — the line is spoken while point i is
 * lit, and the capture's steps say which point each belongs to. Keep points to
 * one short line; the voice carries the sentence.
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

export const INTRO_VOICE = `Meet ${N}. One platform that runs a security agency — the website, the operations console, and the guard's app.`;
export const CONTENTS_VOICE = "Here's the whole journey, start to finish, through every role.";
export const OUTRO_VOICE = `${N}. Your safety, our responsibility. Book guards online, watch every gate live, and bring help with a single press.`;

export const SCRIPT: Record<string, ChapterScript> = {
  website: {
    title: "The website",
    heading: "A website that brings clients in",
    points: ["Four clear menus", "A page for every service", "Built for phones too", "One sign-in for everyone"],
    voice: [
      "It starts with the website. Four clear menus, and a hero that gets straight to the point.",
      "Every service has its own page, so clients know exactly what they're booking.",
      "And it reads just as well on a phone.",
      "One sign-in serves everyone: admins, supervisors, guards and clients.",
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
      "A new client creates an account right from the sign-in page.",
      "Just a name, a company, a phone number and an email.",
      "They verify with a six-digit code by email. No password to remember.",
      "Then they book guards: the service, the site, how many, and the shift.",
      "Every request gets a reference they can follow.",
    ],
  },
  admin: {
    title: "Every role",
    heading: "Every role, its own dashboard",
    points: ["Code or PIN to sign in", "The right dashboard, automatically", "Live figures at a glance", "An assistant that reads the screen"],
    voice: [
      "Staff sign in with an employee code and a PIN, or an email code.",
      "Each role lands on its own dashboard, automatically.",
      "Live figures up front: who's on duty, the sites, late arrivals, anything to review.",
      "And an assistant that reads the screen and answers in plain language.",
    ],
  },
  quote: {
    title: "Booking to quote",
    heading: "From booking to quotation",
    points: ["Every request in one inbox", "Click a row for details", "Send a monthly quote", "The client sees it instantly"],
    voice: [
      "Every booking lands in one inbox.",
      "Click a row to see the contact, the site, and what they need.",
      "Send a monthly quotation in one step.",
      "And the client's screen updates on its own. No refresh.",
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
      "Every site sits on a live map, each with its own geofence.",
      "Open a site to see who's on duty right now, with a number to call.",
      "Its client, its fence, its shift rules and its SOS history, all in one place.",
      "Registering a site is a click on the map and a radius.",
      "Then the booking is handed over to the new site.",
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
      "The roster shows every site: how many guards it needs, and how many are on.",
      "Post a guard to a site, a shift, and the days they work.",
      "The week ahead fills itself in from the posts.",
      "If a guard hasn't arrived, the office sees it straight away — and can call.",
      "Checked in somewhere else? It's allowed, but held for a supervisor to approve.",
    ],
  },
  attendance: {
    title: "Geofenced attendance",
    heading: "Attendance by geofence",
    points: [
      "Tonight's post, on the app",
      "Outside the fence: locked",
      "Inside: check-in unlocks",
      "The office sees it live",
      "Proof of where they stood",
    ],
    voice: [
      "On the guard's app, tonight's post is right at the top.",
      "Outside the fence, check-in stays locked.",
      "Step inside, and it unlocks.",
      "Check in, and the office sees it the same second.",
      "Every punch keeps proof of where the guard stood, against the fence.",
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
      "In an emergency, the guard holds the SOS button for three seconds.",
      "The office is alerted instantly, with the guard's number to call.",
      "Supervisors get it on their phones too.",
      "One tap says 'on the way', and the guard sees help is coming.",
      "When it's over, it's closed — with the full record kept.",
    ],
  },
  stats: {
    title: "Stats & people",
    heading: "Stats and people",
    points: ["A live dashboard", "30 days per guard", "Users by role", "SOS response times"],
    voice: [
      "The dashboard keeps every number current, as it happens.",
      "Click any guard for their last thirty days.",
      "Users are organised by role: admins, supervisors, guards and clients.",
      "And the SOS log tracks response times and false alarms.",
    ],
  },
  client: {
    title: "The client's view",
    heading: "What clients see",
    points: ["Their gate, live", "Tap a guard for details", "Same view in the app", "Only their own sites"],
    voice: [
      "Clients see who's on duty at their gate, live.",
      "Tap a guard to see when they checked in, verified at the fence.",
      "The same view works in the app.",
      "And they only ever see their own sites. Nothing more.",
    ],
  },
};
