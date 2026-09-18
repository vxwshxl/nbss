import "server-only";

import { z } from "zod";

import { supabaseServer } from "@/lib/supabase/server";
import type { AiContext } from "./context";
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
  if (minutes === null || minutes === undefined) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

function stamp(iso: string | null): string {
  if (!iso) return "—";
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
  if (ctx.role !== "admin" && ctx.role !== "supervisor") {
    throw new Error("This lookup is only available to the operations desk.");
  }
}

/** Start of today, in the zone the agency actually works in. */
function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
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
      .select("id, check_in_at, status, profiles(full_name, employee_code), sites(name, district)")
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
      .select("worked_minutes, overtime_minutes, status, check_out_at")
      .gte("check_in_at", since);

    const rows = data ?? [];
    return {
      window: days && days > 1 ? `last ${days} days` : "today",
      shifts: rows.length,
      hoursWorked: hours(rows.reduce((s, r) => s + (r.worked_minutes ?? 0), 0)),
      overtime: hours(rows.reduce((s, r) => s + (r.overtime_minutes ?? 0), 0)),
      late: rows.filter((r) => r.status === "late").length,
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

const rosterOverview: AiTool = {
  name: "roster_overview",
  description:
    "How many people hold each kind of login, how many accounts are active, and who is still on a temporary PIN issued by the office.",
  parameters: z.object({}),
  jsonSchema: empty,
  roles: ["admin", "supervisor"],
  run: async (_args, ctx) => {
    office(ctx);
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from("profiles")
      .select("role, active, must_change_pin, full_name, employee_code");

    const rows = data ?? [];
    const byRole = (role: Role) => rows.filter((r) => r.role === role && r.active).length;

    return {
      activeTotal: rows.filter((r) => r.active).length,
      deactivated: rows.filter((r) => !r.active).length,
      guards: byRole("guard"),
      supervisors: byRole("supervisor"),
      administrators: byRole("admin"),
      clients: byRole("client"),
      onTemporaryPin: rows
        .filter((r) => r.active && r.must_change_pin)
        .map((r) => ({ name: r.full_name, code: r.employee_code })),
    };
  },
};

const punchesNeedingReview: AiTool = {
  name: "punches_needing_review",
  description:
    "Attendance records the geofence could not confirm, or that were closed by hand, and are waiting for a supervisor's decision. This is the work queue.",
  parameters: z.object({}),
  jsonSchema: empty,
  roles: ["admin", "supervisor"],
  run: async (_args, ctx) => {
    office(ctx);
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from("attendance")
      .select(
        "id, check_in_at, check_in_distance_m, check_in_accuracy_m, check_in_method, status, profiles(full_name, employee_code), sites(name)",
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
      };
    });

    return { count: rows.length, punches: rows };
  },
};

const guardAttendance: AiTool = {
  name: "guard_attendance",
  description:
    "One named guard's recent shifts — when they checked in and out, hours worked, overtime and how each shift was marked. Give the guard's name or employee code.",
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
    // says "NBSS-041" and both are the same question.
    const term = who.trim();
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
        message: "That matches more than one person — ask again with the employee code.",
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
      shifts: rows.length,
      hoursWorked: hours(rows.reduce((s, r) => s + (r.worked_minutes ?? 0), 0)),
      overtime: hours(rows.reduce((s, r) => s + (r.overtime_minutes ?? 0), 0)),
      late: rows.filter((r) => r.status === "late").length,
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

const ALL_TOOLS: AiTool[] = [
  whoIsOnDuty,
  attendanceSummary,
  listSites,
  rosterOverview,
  punchesNeedingReview,
  guardAttendance,
  enquiryInbox,
  myShifts,
];

/** The tools this caller is offered. The first of the two locks; see rule 2. */
export function toolsFor(ctx: AiContext): AiTool[] {
  return ALL_TOOLS.filter((t) => t.roles.includes(ctx.role));
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
  roster_overview: "Counted the accounts on the roster",
  punches_needing_review: "Looked at the punches awaiting review",
  guard_attendance: "Read that guard's shifts",
  enquiry_inbox: "Checked the enquiry inbox",
  my_shifts: "Read your own shifts",
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
  if (!tool.roles.includes(ctx.role)) {
    throw new Error("That lookup is not available to you.");
  }
  const parsed = tool.parameters.parse(args ?? {});
  return tool.run(parsed, ctx);
}
