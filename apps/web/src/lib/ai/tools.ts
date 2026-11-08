import "server-only";

import { expandEmployeeCode, isStaff, roleAllowed } from "@nbss/shared/identity";
import { z } from "zod";

import { istDay, istInstant } from "@/lib/roster";
import { supabaseServer } from "@/lib/supabase/server";
import type { AiContext } from "./context";

/** The IST calendar day of an instant, for counting days rather than check-ins. */
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
import type { Role } from "@/lib/auth";

/**
 * The assistant's entire view of the database.
 *
 * Three rules hold for every tool here, and they — not the system prompt — are
 * why this surface is safe:
 *
 *   1. **No tool takes an identity.** Not a guard id, not "whose", not as an
 *      override. Who is asking comes from the server-derived {@link AiContext}.
 *      A model that hallucinates `guardId: "someone-else"` is passing an
 *      argument that does not exist in the schema, and Zod drops it.
 *   2. **Every tool re-checks the role it was handed**, rather than trusting
 *      that the catalogue was filtered upstream. `toolsFor()` already hides
 *      what a role cannot use; this is the second lock on the same door.
 *   3. **Every query runs on the request-scoped Supabase client**, not the
 *      admin one. So even a tool with a bug in its own filter is still standing
 *      behind row-level security, and a guard's session physically cannot read
 *      another guard's punches — the database refuses, not the code above it.
 *
 * Rule 3 is the load-bearing one. It is what makes it safe to let a language
 * model choose which of these to call.
 */
export type AiTool = {
  name: string;
  description: string;
  parameters: z.ZodType;
  /** JSON Schema for the model. Kept beside the Zod schema that enforces it. */
  jsonSchema: Record<string, unknown>;
  /** Roles this tool is offered to. */
  roles: Role[];
  run: (args: unknown, ctx: AiContext) => Promise<unknown>;
};

const empty = { type: "object", properties: {}, required: [] as string[] };

const IST = "Asia/Kolkata";

function hours(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

function stamp(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  });
}

function office(ctx: AiContext) {
  if (!isStaff(ctx.role)) {
    throw new Error("This lookup is only available to the operations desk.");
  }
}

/**
 * Start of today, in the zone the agency actually works in. Not `setHours(0)`:
 * the server runs on UTC, where that is 5:30 am IST and drops the night shift.
 */
function startOfToday(): string {
  return istInstant(istDay(0), "00:00").toISOString();
}

/** "7:00 am", IST. */
function clockAt(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST });
}

/** "Sat 7 Nov", IST, for a calendar date "2026-11-07". */
function dayName(date: string): string {
  return new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: IST });
}

/** An embedded to-one row comes back as an object or a one-item array. */
function one<T>(v: unknown): T | null {
  return (Array.isArray(v) ? (v[0] ?? null) : (v ?? null)) as T | null;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ---------------------------------------------------------------------------

const whoIsOnDuty: AiTool = {
  name: "who_is_on_duty",
  description:
    "Every guard currently checked in and not yet checked out, with the site they are at, the time they arrived and how long they have been on duty. Use this for any question about right now.",
  parameters: z.object({}),
  jsonSchema: empty,
  roles: ["admin", "supervisor"],
  run: async (_args, ctx) => {
    office(ctx);
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from("attendance")
      .select("id, check_in_at, status, profiles!attendance_guard_id_fkey(full_name, employee_code), sites(name, district)")
      .is("check_out_at", null)
      .order("check_in_at", { ascending: false });

    const rows = (data ?? []).map((r) => {
      const guard = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      const place = Array.isArray(r.sites) ? r.sites[0] : r.sites;
      const mins = r.check_in_at
        ? Math.round((Date.now() - new Date(r.check_in_at).getTime()) / 60000)
        : null;
      return {
        guard: guard?.full_name ?? "unknown",
        code: guard?.employee_code ?? null,
        site: place?.name ?? "unknown",
        district: place?.district ?? null,
        since: stamp(r.check_in_at),
        onDutyFor: hours(mins),
        arrivedLate: r.status === "late",
      };
    });

    return { count: rows.length, guards: rows };
  },
};

const attendanceSummary: AiTool = {
  name: "attendance_summary",
  description:
    "Totals across all sites for a recent window: shifts recorded, hours worked, overtime, how many arrived late, and how many punches are waiting for review. Defaults to today.",
  parameters: z.object({ days: z.number().int().min(1).max(90).optional() }),
  jsonSchema: {
    type: "object",
    properties: {
      days: {
        type: "integer",
        minimum: 1,
        maximum: 90,
        description: "How many days back to include. 1 means today only.",
      },
    },
    required: [],
  },
  roles: ["admin", "supervisor"],
  run: async (args, ctx) => {
    office(ctx);
    const { days } = z.object({ days: z.number().int().min(1).max(90).optional() }).parse(args);
    const since = days && days > 1 ? daysAgo(days) : startOfToday();

    const supabase = await supabaseServer();
    const { data } = await supabase
      .from("attendance")
      .select("guard_id, check_in_at, worked_minutes, overtime_minutes, status, check_out_at")
      .gte("check_in_at", since);

    const rows = data ?? [];
    // Guard-days, as the register counts them: two check-ins on one day are one day present.
    const guardDay = (r: (typeof rows)[number]) => `${r.guard_id}|${r.check_in_at ? dayOf(r.check_in_at) : ""}`;
    return {
      window: days && days > 1 ? `last ${days} days` : "today",
      checkIns: rows.length,
      guardDaysPresent: new Set(rows.filter((r) => r.status !== "absent" && r.status !== "rejected").map(guardDay)).size,
      hoursWorked: hours(rows.reduce((s, r) => s + (r.worked_minutes ?? 0), 0)),
      overtime: hours(rows.reduce((s, r) => s + (r.overtime_minutes ?? 0), 0)),
      lateGuardDays: new Set(rows.filter((r) => r.status === "late").map(guardDay)).size,
      absent: rows.filter((r) => r.status === "absent").length,
      awaitingReview: rows.filter((r) => r.status === "pending_review").length,
      stillOnDuty: rows.filter((r) => !r.check_out_at).length,
    };
  },
};

const listSites: AiTool = {
  name: "list_sites",
  description:
    "Every site on the register: its client, district, the shape and size of its geofence, its shift window, and how many guards are standing in it right now.",
  parameters: z.object({}),
  jsonSchema: empty,
  roles: ["admin", "supervisor"],
  run: async (_args, ctx) => {
    office(ctx);
    const supabase = await supabaseServer();
    const [sites, live] = await Promise.all([
      supabase
        .from("sites")
        .select(
          "id, name, client_name, district, geofence_radius_m, polygon, shift_start, shift_end, grace_minutes, standard_shift_minutes, active",
        )
        .order("name"),
      supabase.from("attendance").select("site_id").is("check_out_at", null),
    ]);

    const onDuty = new Map<string, number>();
    for (const row of live.data ?? []) {
      onDuty.set(row.site_id, (onDuty.get(row.site_id) ?? 0) + 1);
    }

    return {
      count: sites.data?.length ?? 0,
      sites: (sites.data ?? []).map((s) => ({
        name: s.name,
        client: s.client_name,
        district: s.district,
        boundary: Array.isArray(s.polygon)
          ? `drawn area, ${s.polygon.length} points`
          : `${s.geofence_radius_m} m radius`,
        shift: s.shift_start ? `${s.shift_start}–${s.shift_end}` : "not set",
        graceMinutes: s.grace_minutes,
        standardShift: hours(s.standard_shift_minutes),
        inService: s.active,
        onDutyNow: onDuty.get(s.id) ?? 0,
      })),
    };
  },
};

const accountOverview: AiTool = {
  name: "account_overview",
  description:
    "How many people hold each kind of login, how many accounts are active, and who has no mobile number on file (and so cannot sign in). This counts accounts; it is not the duty roster. For who is scheduled to work, use shift_roster.",
  parameters: z.object({}),
  jsonSchema: empty,
  roles: ["admin", "supervisor"],
  run: async (_args, ctx) => {
    office(ctx);
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from("profiles")
      .select("role, active, phone, full_name, employee_code");

    const rows = data ?? [];
    const byRole = (role: Role) => rows.filter((r) => r.role === role && r.active).length;

    return {
      activeTotal: rows.filter((r) => r.active).length,
      deactivated: rows.filter((r) => !r.active).length,
      guards: byRole("guard"),
      supervisors: byRole("supervisor"),
      administrators: byRole("admin"),
      clients: byRole("client"),
      cannotSignInNoMobile: rows
        .filter((r) => r.active && r.role !== "client" && !r.phone)
        .map((r) => ({ name: r.full_name, code: r.employee_code })),
    };
  },
};

const punchesNeedingReview: AiTool = {
  name: "punches_needing_review",
  description:
    "Attendance records the geofence could not confirm, made at a site the guard was not rostered to, or closed by hand, waiting for a supervisor's decision, each with the reason it was held. This is the work queue.",
  parameters: z.object({}),
  jsonSchema: empty,
  roles: ["admin", "supervisor"],
  run: async (_args, ctx) => {
    office(ctx);
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from("attendance")
      .select(
        "id, check_in_at, check_in_distance_m, check_in_accuracy_m, check_in_method, status, off_roster, review_note, device_flag, profiles!attendance_guard_id_fkey(full_name, employee_code), sites(name)",
      )
      .eq("status", "pending_review")
      .order("check_in_at", { ascending: false })
      .limit(50);

    const rows = (data ?? []).map((r) => {
      const guard = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      const place = Array.isArray(r.sites) ? r.sites[0] : r.sites;
      return {
        guard: guard?.full_name ?? "unknown",
        code: guard?.employee_code ?? null,
        site: place?.name ?? "unknown",
        when: stamp(r.check_in_at),
        metresFromCentre:
          r.check_in_distance_m === null ? null : Math.round(r.check_in_distance_m),
        gpsAccuracy:
          r.check_in_accuracy_m === null ? null : `±${Math.round(r.check_in_accuracy_m)} m`,
        allowedBy: r.check_in_method,
        // Why it is held, in the record's own words: the review note says it
        // (off roster, outside the fence, closed by hand), the flags back it up.
        reason: r.review_note ?? (r.off_roster ? "Checked in at a site this guard was not rostered to." : null),
        offRoster: r.off_roster,
        deviceFlag: r.device_flag,
      };
    });

    return { count: rows.length, punches: rows };
  },
};

const guardAttendance: AiTool = {
  name: "guard_attendance",
  description:
    "One named guard's recent shifts: when they checked in and out, hours worked, overtime and how each shift was marked. Give the guard's name or employee code.",
  parameters: z.object({
    who: z.string().min(2).max(60),
    days: z.number().int().min(1).max(90).optional(),
  }),
  jsonSchema: {
    type: "object",
    properties: {
      who: { type: "string", description: "The guard's name or employee code." },
      days: { type: "integer", minimum: 1, maximum: 90 },
    },
    required: ["who"],
  },
  roles: ["admin", "supervisor"],
  run: async (args, ctx) => {
    office(ctx);
    const { who, days = 30 } = z
      .object({ who: z.string().min(2).max(60), days: z.number().int().min(1).max(90).optional() })
      .parse(args);

    const supabase = await supabaseServer();

    // Matched on either field, because the office says "Ripun" and the roster
    // says "NBSS-41" and both are the same question. A code is read as the sign-in
    // reads it, so "41" and an old "NBSS-041" find NBSS-41 too.
    const term = /^(nbss-)?\d+$/i.test(who.trim()) ? expandEmployeeCode(who) : who.trim();
    const { data: people } = await supabase
      .from("profiles")
      .select("id, full_name, employee_code, role, active")
      .or(`full_name.ilike.%${term}%,employee_code.ilike.%${term}%`)
      .limit(5);

    if (!people || people.length === 0) {
      return { found: false, message: `Nobody on the roster matches "${term}".` };
    }
    if (people.length > 1) {
      return {
        found: false,
        message: "That matches more than one person: ask again with the employee code.",
        candidates: people.map((p) => ({ name: p.full_name, code: p.employee_code })),
      };
    }

    const person = people[0]!;
    const { data } = await supabase
      .from("attendance")
      .select(
        "check_in_at, check_out_at, worked_minutes, overtime_minutes, status, check_in_distance_m, sites(name)",
      )
      .eq("guard_id", person.id)
      .gte("check_in_at", daysAgo(days))
      .order("check_in_at", { ascending: false })
      .limit(100);

    const rows = data ?? [];
    return {
      found: true,
      guard: { name: person.full_name, code: person.employee_code, active: person.active },
      window: `last ${days} days`,
      checkIns: rows.length,
      daysPresent: new Set(rows.filter((r) => r.check_in_at && r.status !== "rejected").map((r) => dayOf(r.check_in_at!))).size,
      hoursWorked: hours(rows.reduce((s, r) => s + (r.worked_minutes ?? 0), 0)),
      overtime: hours(rows.reduce((s, r) => s + (r.overtime_minutes ?? 0), 0)),
      lateDays: new Set(rows.filter((r) => r.status === "late" && r.check_in_at).map((r) => dayOf(r.check_in_at!))).size,
      recent: rows.slice(0, 15).map((r) => {
        const place = Array.isArray(r.sites) ? r.sites[0] : r.sites;
        return {
          site: place?.name ?? "unknown",
          in: stamp(r.check_in_at),
          out: r.check_out_at ? stamp(r.check_out_at) : "still on duty",
          worked: hours(r.worked_minutes),
          marked: r.status,
        };
      }),
    };
  },
};

const enquiryInbox: AiTool = {
  name: "enquiry_inbox",
  description:
    "What is sitting on the front desk: how many quote requests, contact enquiries and job applications have come in off the public website, and how many nobody has picked up yet.",
  parameters: z.object({}),
  jsonSchema: empty,
  roles: ["admin", "supervisor"],
  run: async (_args, ctx) => {
    office(ctx);
    // Imported lazily: the store reads a JSON file, and pulling it into the
    // module graph of every tool would drag `node:fs` into places that do not
    // need it.
    const { countSubmissions, listSubmissions } = await import("@/lib/store");
    const [counts, rows] = await Promise.all([countSubmissions(), listSubmissions()]);

    return {
      ...counts,
      // Names and messages deliberately withheld: an enquiry is somebody's
      // phone number, and a chat transcript is the wrong place for it. The
      // assistant can say how many there are and point at the screen.
      newest: rows.slice(0, 5).map((s) => ({
        reference: s.id,
        kind: s.kind,
        status: s.status,
        received: stamp(s.createdAt),
        district: s.district ?? null,
        service: s.service ?? s.vacancyTitle ?? null,
      })),
    };
  },
};

const mySite: AiTool = {
  name: "my_site",
  description:
    "The signed-in client's own site: who is checked in there right now, the man-hours and overtime billed this month, and how many shifts were worked. Use this for any question a client asks about their own cover.",
  parameters: z.object({}),
  jsonSchema: empty,
  roles: ["client"],
  run: async () => {
    const supabase = await supabaseServer();

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Read through `client_attendance`, which Postgres filters to this
    // client's own sites and which carries no coordinates, IPs or review notes.
    // Clients have no read policy on `attendance` itself, so querying the table
    // directly returned nothing and reported every site as unstaffed.
    const [live, month] = await Promise.all([
      supabase
        .from("client_attendance")
        .select("id, check_in_at, guard_name, site_name")
        .is("check_out_at", null)
        .order("check_in_at", { ascending: false }),
      supabase
        .from("client_attendance")
        .select("worked_minutes, overtime_minutes")
        .gte("check_in_at", monthStart.toISOString()),
    ]);

    const rows = month.data ?? [];

    return {
      onDutyNow: (live.data ?? []).map((r) => ({
        // A name and a site. A client is entitled to know their site is
        // staffed; they are not entitled to a guard's employee code, their
        // coordinates, or where else that person works.
        guard: r.guard_name ?? "unknown",
        site: r.site_name ?? "your site",
        since: stamp(r.check_in_at),
      })),
      thisMonth: {
        shifts: rows.length,
        manHours: hours(rows.reduce((s, r) => s + (r.worked_minutes ?? 0), 0)),
        overtime: hours(rows.reduce((s, r) => s + (r.overtime_minutes ?? 0), 0)),
      },
    };
  },
};

const myShifts: AiTool = {
  name: "my_shifts",
  description:
    "The signed-in person's own recent shifts and hours. Use this for any question phrased as 'me' or 'my'.",
  parameters: z.object({ days: z.number().int().min(1).max(90).optional() }),
  jsonSchema: {
    type: "object",
    properties: { days: { type: "integer", minimum: 1, maximum: 90 } },
    required: [],
  },
  roles: ["admin", "supervisor", "guard"],
  run: async (args, ctx) => {
    const { days = 30 } = z
      .object({ days: z.number().int().min(1).max(90).optional() })
      .parse(args);

    const supabase = await supabaseServer();
    const { data } = await supabase
      .from("attendance")
      .select(
        "check_in_at, check_out_at, worked_minutes, overtime_minutes, status, sites(name)",
      )
      .eq("guard_id", ctx.userId)
      .gte("check_in_at", daysAgo(days))
      .order("check_in_at", { ascending: false })
      .limit(100);

    const rows = data ?? [];
    return {
      window: `last ${days} days`,
      shifts: rows.length,
      hoursWorked: hours(rows.reduce((s, r) => s + (r.worked_minutes ?? 0), 0)),
      overtime: hours(rows.reduce((s, r) => s + (r.overtime_minutes ?? 0), 0)),
      onDutyNow: rows.some((r) => !r.check_out_at),
      recent: rows.slice(0, 10).map((r) => {
        const place = Array.isArray(r.sites) ? r.sites[0] : r.sites;
        return {
          site: place?.name ?? "unknown",
          in: stamp(r.check_in_at),
          out: r.check_out_at ? stamp(r.check_out_at) : "still on duty",
          worked: hours(r.worked_minutes),
          marked: r.status,
        };
      }),
    };
  },
};

// ---------------------------------------------------------------------------
// The duty roster: `shifts`, written a week ahead from each guard's posting
// plus the cover shifts added by hand. Who *should* be where, as opposed to
// `attendance`, which is who actually is.

type Supabase = Awaited<ReturnType<typeof supabaseServer>>;

type RosterState =
  | "on duty"
  | "not arrived"
  | "due now, inside the grace minutes"
  | "due later"
  | "checked in at another site"
  | "checked out"
  | "missed"
  | "supervisor, does not check in";

type RosterRow = {
  guard: string;
  code: string | null;
  site: string;
  hours: string;
  state: RosterState;
  /** Where they did check in, when it is not the rostered site. */
  checkedInAt?: string;
  /** How far past the start, for a shift nobody has arrived for. */
  lateBy?: string;
  cover: boolean;
};

/**
 * Every shift that touches one IST day, and where each stands now. The same
 * reading the dashboard and the Roster page give: a shift is "not arrived" once
 * it has started, its site's grace minutes have passed, and its guard is not
 * checked in there. Supervisors are never "not arrived": they do not check in.
 */
async function readRosterDay(supabase: Supabase, offset: number) {
  const date = istDay(offset);
  const from = istInstant(date, "00:00").toISOString();
  const to = istInstant(istDay(offset + 1), "00:00").toISOString();

  const [shifts, open] = await Promise.all([
    supabase
      .from("shifts")
      .select(
        "id, guard_id, site_id, starts_at, ends_at, status, posting_id, guard:profiles!shifts_guard_id_fkey(full_name, employee_code, role), sites(name, grace_minutes)",
      )
      .neq("status", "cancelled")
      // Overlapping the day, so last night's shift that runs into this morning counts.
      .lt("starts_at", to)
      .gt("ends_at", from)
      .order("starts_at")
      .limit(500),
    supabase.from("attendance").select("guard_id, site_id, sites(name)").is("check_out_at", null),
  ]);

  const openBy = new Map<string, { siteId: string; site: string }>();
  for (const a of open.data ?? []) {
    openBy.set(a.guard_id, { siteId: a.site_id, site: one<{ name: string }>(a.sites)?.name ?? "another site" });
  }

  const now = Date.now();
  const rows: RosterRow[] = (shifts.data ?? []).map((s) => {
    const g = one<{ full_name: string; employee_code: string; role: string }>(s.guard);
    const place = one<{ name: string; grace_minutes: number | null }>(s.sites);
    const start = new Date(s.starts_at).getTime();
    const end = new Date(s.ends_at).getTime();
    const here = openBy.get(s.guard_id);
    const graceMs = (place?.grace_minutes ?? 10) * 60_000;

    let state: RosterState;
    if (here?.siteId === s.site_id) state = "on duty";
    else if (s.status === "missed") state = "missed";
    else if (s.status === "completed" || s.status === "in_progress") state = "checked out";
    else if (g?.role === "supervisor") state = "supervisor, does not check in";
    else if (start > now) state = "due later";
    else if (end <= now) state = "missed";
    else if (here) state = "checked in at another site";
    else if (now - start > graceMs) state = "not arrived";
    else state = "due now, inside the grace minutes";

    return {
      guard: g?.full_name ?? "A guard",
      code: g?.employee_code ?? null,
      site: place?.name ?? "a site",
      hours: `${clockAt(s.starts_at)} – ${clockAt(s.ends_at)}`,
      state,
      ...(state === "checked in at another site" ? { checkedInAt: here?.site } : {}),
      ...(state === "not arrived" ? { lateBy: hours(Math.round((now - start) / 60_000)) } : {}),
      cover: !s.posting_id,
    };
  });

  return { date, rows };
}

const DAYS = ["yesterday", "today", "tomorrow"] as const;
const shiftRosterArgs = z.object({
  day: z.enum(DAYS).optional(),
  site: z.string().min(2).max(80).optional(),
});

const shiftRoster: AiTool = {
  name: "shift_roster",
  description:
    "The duty roster for one day (today unless asked): every rostered shift with its guard, site and hours, and where each stands now: on duty, not arrived (started, grace passed, no check-in), due now (inside the grace minutes), due later, checked in at another site, checked out or missed. Also the check-ins made today at a site the guard was not rostered to. Use this for who is rostered or scheduled, who has not turned up or checked in, who is late or absent, and who works where today or tomorrow.",
  parameters: shiftRosterArgs,
  jsonSchema: {
    type: "object",
    properties: {
      day: { type: "string", enum: [...DAYS], description: "Which day. Defaults to today." },
      site: { type: "string", description: "Only this site: part of its name." },
    },
    required: [],
  },
  roles: ["admin", "supervisor"],
  run: async (args, ctx) => {
    office(ctx);
    const { day = "today", site } = shiftRosterArgs.parse(args);
    const offset = day === "yesterday" ? -1 : day === "tomorrow" ? 1 : 0;
    const supabase = await supabaseServer();

    const [{ date, rows: all }, offRoster] = await Promise.all([
      readRosterDay(supabase, offset),
      offset === 0
        ? supabase
            .from("attendance")
            .select("check_in_at, profiles!attendance_guard_id_fkey(full_name, employee_code), sites(name)")
            .eq("off_roster", true)
            .gte("check_in_at", startOfToday())
            .order("check_in_at", { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] as never[] }),
    ]);

    const term = site?.trim().toLowerCase();
    const rows = term ? all.filter((r) => r.site.toLowerCase().includes(term)) : all;
    const count = (state: RosterState) => rows.filter((r) => r.state === state).length;
    const pick = (state: RosterState) => rows.filter((r) => r.state === state);

    return {
      day: `${day}, ${dayName(date)}`,
      ...(term ? { site: site, matchedNothing: rows.length === 0 && all.length > 0 } : {}),
      rostered: rows.length,
      counts: {
        onDuty: count("on duty"),
        notArrived: count("not arrived"),
        dueNowInsideGrace: count("due now, inside the grace minutes"),
        checkedInAtAnotherSite: count("checked in at another site"),
        dueLater: count("due later"),
        checkedOut: count("checked out"),
        missed: count("missed"),
      },
      // The question this tool is asked most, answered first.
      notCheckedIn: [
        ...pick("not arrived"),
        ...pick("due now, inside the grace minutes"),
        ...pick("checked in at another site"),
      ],
      shifts: rows.slice(0, 120),
      ...(offset === 0
        ? {
            checkedInOffRoster: (offRoster.data ?? []).map((a) => ({
              guard: one<{ full_name: string }>(a.profiles)?.full_name ?? "A guard",
              code: one<{ employee_code: string }>(a.profiles)?.employee_code ?? null,
              site: one<{ name: string }>(a.sites)?.name ?? "a site",
              since: stamp(a.check_in_at),
            })),
          }
        : {}),
      ...(all.length === 0
        ? { note: "Nothing is rostered for this day. Guards without a posting check in first come, first served." }
        : {}),
    };
  },
};

const rosterCoverArgs = z.object({ days: z.number().int().min(1).max(14).optional() });

const rosterCover: AiTool = {
  name: "roster_cover",
  description:
    "Each active site's rostered guards per day, from today, against the number of guards it needs (as the Roster page counts them), and which site-days are short. Use this for gaps in the roster, sites short of guards, or cover over the coming week.",
  parameters: rosterCoverArgs,
  jsonSchema: {
    type: "object",
    properties: { days: { type: "integer", minimum: 1, maximum: 14, description: "How many days from today. Defaults to 7." } },
    required: [],
  },
  roles: ["admin", "supervisor"],
  run: async (args, ctx) => {
    office(ctx);
    const { days = 7 } = rosterCoverArgs.parse(args);
    const supabase = await supabaseServer();
    const dates = Array.from({ length: days }, (_, i) => istDay(i));

    const [sites, shifts] = await Promise.all([
      supabase.from("sites").select("id, name, guards_required").eq("active", true).order("name"),
      supabase
        .from("shifts")
        .select("site_id, guard_id, starts_at")
        .neq("status", "cancelled")
        .gte("starts_at", istInstant(dates[0]!, "00:00").toISOString())
        .lt("starts_at", istInstant(istDay(days), "00:00").toISOString())
        .limit(5000),
    ]);

    // Guards rostered per site per IST start date: the figure in each Roster page cell.
    // Guards, not shifts: a post with a break is two shifts on one day for one guard.
    const day = new Map<string, Set<string>>();
    const posted = new Map<string, Set<string>>();
    for (const s of shifts.data ?? []) {
      const date = new Date(s.starts_at).toLocaleDateString("en-CA", { timeZone: IST });
      day.set(`${s.site_id}|${date}`, (day.get(`${s.site_id}|${date}`) ?? new Set()).add(s.guard_id));
      posted.set(s.site_id, (posted.get(s.site_id) ?? new Set()).add(s.guard_id));
    }
    const cell = new Map([...day].map(([k, v]) => [k, v.size]));

    const perSite = (sites.data ?? []).map((s) => {
      const week = dates.map((d) => ({ day: dayName(d), rostered: cell.get(`${s.id}|${d}`) ?? 0 }));
      const short = s.guards_required ? week.filter((w) => w.rostered < s.guards_required!) : [];
      return {
        site: s.name,
        needs: s.guards_required,
        guardsRostered: posted.get(s.id)?.size ?? 0,
        shortOn: short.map((w) => `${w.day}: ${w.rostered} of ${s.guards_required}`),
        nothingRostered: week.every((w) => w.rostered === 0),
      };
    });

    return {
      window: `${dayName(dates[0]!)} to ${dayName(dates.at(-1)!)}`,
      sitesShort: perSite.filter((s) => s.shortOn.length > 0),
      sitesFullyCovered: perSite.filter((s) => s.needs && s.shortOn.length === 0).map((s) => s.site),
      // Without a headcount there is nothing to be short of; say so rather than call it covered.
      sitesWithNoHeadcountSet: perSite
        .filter((s) => !s.needs)
        .map((s) => ({ site: s.site, guardsRostered: s.guardsRostered, nothingRostered: s.nothingRostered })),
    };
  },
};

const needsAttention: AiTool = {
  name: "needs_attention",
  description:
    "Everything waiting on the operations desk right now, in one read: open SOS alerts, rostered guards who have not arrived, punches awaiting review today, and new booking requests. Use this for 'what needs my attention', 'anything urgent', or a quick status of the day.",
  parameters: z.object({}),
  jsonSchema: empty,
  roles: ["admin", "supervisor"],
  run: async (_args, ctx) => {
    office(ctx);
    const supabase = await supabaseServer();
    const [sos, roster, review, bookings] = await Promise.all([
      supabase
        .from("sos_alerts")
        .select("kind, status, raised_at, guard:profiles!sos_alerts_raised_by_fkey(full_name), sites(name)")
        .in("status", ["active", "acknowledged"])
        .order("raised_at", { ascending: false }),
      readRosterDay(supabase, 0),
      supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_review")
        .gte("check_in_at", startOfToday()),
      supabase
        .from("service_requests")
        .select("reference, service_type, district, created_at")
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const late = roster.rows.filter((r) => r.state === "not arrived");
    return {
      openSos: (sos.data ?? []).map((a) => ({
        kind: a.kind,
        status: a.status === "active" ? "nobody has responded yet" : "acknowledged, still open",
        guard: one<{ full_name: string }>(a.guard)?.full_name ?? "A guard",
        site: one<{ name: string }>(a.sites)?.name ?? "a site",
        raised: stamp(a.raised_at),
      })),
      notArrived: late.map(({ guard, code, site, hours: window, lateBy }) => ({ guard, code, site, hours: window, lateBy })),
      punchesAwaitingReviewToday: review.count ?? 0,
      // References only: a booking is somebody's name and phone number.
      newBookingRequests: (bookings.data ?? []).map((b) => ({
        reference: b.reference,
        service: b.service_type,
        district: b.district,
        received: stamp(b.created_at),
      })),
    };
  },
};

const ALL_TOOLS: AiTool[] = [
  whoIsOnDuty,
  attendanceSummary,
  listSites,
  accountOverview,
  shiftRoster,
  rosterCover,
  needsAttention,
  punchesNeedingReview,
  guardAttendance,
  enquiryInbox,
  myShifts,
  mySite,
];

/** The tools this caller is offered. The first of the two locks; see rule 2. */
export function toolsFor(ctx: AiContext): AiTool[] {
  return ALL_TOOLS.filter((t) => roleAllowed(ctx.role, t.roles));
}

/**
 * A plain sentence naming a lookup that just finished.
 *
 * This is the receipt the thread shows under each answer, and it is the only
 * way somebody reading a figure can tell it was read rather than invented. So
 * the wording says what was *looked at*, in the past tense, and never what the
 * model concluded.
 */
const LABELS: Record<string, string> = {
  who_is_on_duty: "Checked who is on duty right now",
  attendance_summary: "Totalled the attendance records",
  list_sites: "Read the site register",
  account_overview: "Counted the accounts in the console",
  shift_roster: "Read the duty roster",
  roster_cover: "Checked the roster against each site's headcount",
  needs_attention: "Checked what is waiting on the desk",
  punches_needing_review: "Looked at the punches awaiting review",
  guard_attendance: "Read that guard's shifts",
  enquiry_inbox: "Checked the enquiry inbox",
  my_shifts: "Read your own shifts",
  my_site: "Checked the cover at your site",
};

export function toolLabel(name: string): string {
  return LABELS[name] ?? "Looked something up";
}

export async function runTool(
  name: string,
  args: unknown,
  ctx: AiContext,
): Promise<unknown> {
  const tool = ALL_TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`No such lookup: ${name}`);
  // The second lock. `toolsFor` already hid this from the catalogue; a model
  // that names it anyway is refused here rather than trusted.
  if (!roleAllowed(ctx.role, tool.roles)) {
    throw new Error("That lookup is not available to you.");
  }
  const parsed = tool.parameters.parse(args ?? {});
  return tool.run(parsed, ctx);
}
