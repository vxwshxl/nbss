/**
 * What each console page is, in the assistant's words.
 *
 * Plain data with no `"use client"` and no `server-only`, because both sides
 * need it: the panel names the page it can see, and the server turns the same
 * entry into a paragraph of page notes in the system prompt.
 *
 * This is documentation, not permission. Telling the model what the Sites page
 * is for does not let it read a fence: `tools` only *points* at lookups, and
 * the brief names a tool only when `toolsFor(ctx)` has already granted it.
 */
export type PageKnowledge = {
  title: string;
  about: string;
  actions?: string[];
  tools?: string[];
};

export const PAGES: Record<string, PageKnowledge> = {
  "/console": {
    title: "Dashboard",
    about:
      "The operations desk's front page: how many guards are on duty right now, sites covered and uncovered, punches waiting for review and the latest enquiries.",
    tools: ["who_is_on_duty", "attendance_summary", "punches_needing_review", "list_sites"],
  },
  "/console/attendance": {
    title: "Attendance",
    about:
      "Every check-in and check-out, with the distance from the site's geofence, accuracy and method. Staff review punches that landed outside a fence or were auto-closed; a guard sees only their own.",
    actions: ["Filter by date, site or guard", "Approve or reject a punch that needs review", "Print or export the register"],
    tools: ["attendance_summary", "punches_needing_review", "guard_attendance", "my_shifts"],
  },
  "/console/sites": {
    title: "Sites & geofences",
    about:
      "The client sites guards are deployed to, each with a geofence (centre and radius) a guard must be inside to check in, shift times and grace minutes.",
    actions: ["Add a site", "Draw or move a geofence on the map", "Change shift times and grace", "Link a site to a client account"],
    tools: ["list_sites", "who_is_on_duty"],
  },
  "/console/guards": {
    title: "Guards",
    about: "Every guard account: code, email, phone and whether it is active. Clicking a row opens their profile with 30-day attendance.",
    actions: ["Add a guard", "Edit contact details", "Reset a PIN", "Deactivate or reactivate", "View the console as them"],
    tools: ["roster_overview", "guard_attendance"],
  },
  "/console/users": {
    title: "Users",
    about:
      "Every account in the console — administrators, supervisors, guards and clients — split into role tabs. Clicking a row opens that person's profile.",
    actions: ["Filter by role", "Add a person", "Change someone's role", "Edit contact details", "Deactivate or delete an account"],
    tools: ["roster_overview"],
  },
  "/console/submissions": {
    title: "Enquiries",
    about: "Quote requests, enquiries and job applications sent from the public website, with their status.",
    actions: ["Mark an enquiry contacted or closed"],
    tools: ["enquiry_inbox"],
  },
  "/console/audit": {
    title: "Audit log",
    about: "An append-only record of every privileged action: sign-ins, accounts created, PIN resets, fence changes, impersonation.",
  },
  "/console/duty": {
    title: "Today's duty",
    about:
      "The guard's own shift for today and the check-in / check-out control. Checking in needs the phone's location inside the site's geofence.",
    actions: ["Check in", "Check out"],
    tools: ["my_shifts"],
  },
  "/console/site": {
    title: "My site",
    about: "The client's own site or sites: who is on duty there now, and recent attendance.",
    tools: ["my_site"],
  },
  "/console/profile": {
    title: "My profile",
    about: "The signed-in person's own details.",
    actions: ["Edit their name or phone", "Change their PIN or passphrase"],
  },
};

export function pageKnowledge(pathname: string | null | undefined): PageKnowledge | null {
  if (!pathname) return null;
  const path = pathname.replace(/\/+$/, "") || "/";
  const exact = PAGES[path];
  if (exact) return exact;

  let best: string | null = null;
  for (const key of Object.keys(PAGES)) {
    if (key !== "/console" && path.startsWith(`${key}/`) && (!best || key.length > best.length)) best = key;
  }
  return best ? (PAGES[best] ?? null) : null;
}

export function pageBrief(pathname: string | null | undefined, granted: string[]): string | null {
  const page = pageKnowledge(pathname);
  if (!page) return pathname ? `The person is looking at ${pathname} right now.` : null;

  const lines = [`The person is looking at the ${page.title} page (${pathname}) right now.`, page.about];
  if (page.actions?.length) lines.push(`From here they can: ${page.actions.join("; ")}.`);
  const tools = (page.tools ?? []).filter((t) => granted.includes(t));
  if (tools.length) lines.push(`The lookups that best answer questions about this page are: ${tools.join(", ")}.`);
  lines.push('Answer "what is this page" and "what can I do here" from this, without calling a tool for the description itself.');
  return lines.join(" ");
}
