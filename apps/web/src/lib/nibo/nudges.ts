import "server-only";

import { isStaff } from "@nbss/shared/identity";

import type { Session } from "@/lib/impersonation";
import type { NiboLine } from "@/lib/nibo/types";
import { supabaseServer } from "@/lib/supabase/server";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * What Nibo could usefully point out right now, from live data. Counts only,
 * read with the person's own session (row-level security applies), each
 * linking somewhere they may go. The id carries the count, so a changed number
 * can be said again.
 */
export async function getNiboNudges(session: Session): Promise<NiboLine[]> {
  const s = await supabaseServer();
  const p = session.profile;
  const out: NiboLine[] = [];
  const tasks: PromiseLike<void>[] = [];
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const now = new Date().toISOString();

  if (isStaff(p.role)) {
    tasks.push(
      s.from("sos_alerts").select("id", { count: "exact", head: true }).in("status", ["active", "acknowledged"]).then(({ count }) => {
        if (count) out.push({ id: `sos:${count}`, kind: "nudge", priority: 10, mood: "oops", text: `${plural(count, "SOS alert")} still open.`, actions: [{ label: "Open SOS", href: "/console/sos" }] });
      }),
      s.from("attendance").select("id", { count: "exact", head: true }).eq("status", "pending_review").gte("check_in_at", startOfToday.toISOString()).then(({ count }) => {
        if (count) out.push({ id: `review:${count}`, kind: "nudge", priority: 7, mood: "think", text: `${plural(count, "punch", "punches")} waiting for review today.`, actions: [{ label: "Review", href: "/console/attendance" }, { label: "Why?", ask: "Which attendance entries are waiting for review today and why?" }] });
      }),
      s.from("shifts").select("id", { count: "exact", head: true }).eq("status", "scheduled").lte("starts_at", now).gt("ends_at", now).then(({ count }) => {
        if (count) out.push({ id: `late:${count}`, kind: "nudge", priority: 8, mood: "think", text: `${plural(count, "rostered guard")} not checked in yet.`, actions: [{ label: "Who?", ask: "Which rostered guards have not checked in yet?" }, { label: "Roster", href: "/console/roster" }] });
      }),
      s.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "new").then(({ count }) => {
        if (count) out.push({ id: `bookings:${count}`, kind: "nudge", priority: 6, mood: "wave", text: `${plural(count, "new booking request")} to look at.`, actions: [{ label: "Bookings", href: "/console/bookings" }] });
      }),
    );
  } else if (p.role === "guard") {
    tasks.push(
      s.from("shifts").select("id, starts_at", { count: "exact" }).eq("guard_id", p.id).eq("status", "scheduled").lte("starts_at", now).gt("ends_at", now).then(({ count }) => {
        if (count) out.push({ id: `myshift:${now.slice(0, 13)}`, kind: "nudge", priority: 9, mood: "wave", text: "Your shift has started. Check in when you reach the gate.", actions: [{ label: "Check in", href: "/console/duty" }] });
      }),
    );
  } else if (p.role === "client") {
    tasks.push(
      s.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "quoted").then(({ count }) => {
        if (count) out.push({ id: `quote:${count}`, kind: "nudge", priority: 8, mood: "cheer", text: "Your quotation is ready to look at.", actions: [{ label: "See it", href: "/console/book" }] });
      }),
    );
  }

  await Promise.allSettled(tasks);
  return out.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}
