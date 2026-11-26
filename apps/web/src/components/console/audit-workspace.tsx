"use client";

import { createElement, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  CalendarClock,
  ClipboardCheck,
  Dot,
  Info,
  KeyRound,
  LogIn,
  LogOut,
  MapPin,
  PencilLine,
  Plus,
  ReceiptIndianRupee,
  Search,
  ShieldAlert,
  Smartphone,
  Trash2,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn, matchesSearch } from "@/lib/utils";
import type { Tone } from "@/lib/ui/tones";

export type AuditRow = {
  id: number;
  actor_code: string | null;
  /** The person the entry is about, by name (the page resolves it). */
  who: { name: string; phone: string | null } | null;
  /** The site it happened at, by name. */
  site: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  detail: unknown;
  ip: string | null;
  created_at: string;
  /** app: written by the code in words. trigger: a row change the database recorded. */
  source: "app" | "trigger";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

const IST = "Asia/Kolkata";

function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: IST,
  });
}

/** Machine names read badly in a list somebody is scanning for wrongdoing. */
const ACTION_LABEL: Record<string, string> = {
  sign_in: "Signed in",
  sign_out: "Signed out",
  account_created: "Created an account",
  account_deactivated: "Deactivated an account",
  account_reactivated: "Reactivated an account",
  role_changed: "Changed a role",
  pin_reset: "Issued a new PIN",
  own_pin_changed: "Changed their own PIN",
  profile_updated: "Updated a profile",
  site_created: "Registered a site",
  handover_note: "Left a handover note",
  handover_note_deleted: "Deleted a handover note",
  device_autostart_checked: "Marked Autostart checked on a phone",
  device_autostart_unchecked: "Took back an Autostart check",
  site_updated: "Edited a site",
  site_deleted: "Deleted a site",
  location_pin_deleted: "Deleted a location sent from the field",
  site_deactivated: "Took a site out of service",
  site_reactivated: "Put a site back in service",
  check_in: "Checked in",
  check_out: "Checked out",
  check_in_refused: "Was refused a check-in",
  attendance_reviewed: "Reviewed a punch",
  attendance_force_closed: "Closed a shift manually",
  impersonation_started: "Started viewing as someone",
  impersonation_stopped: "Stopped viewing as someone",
  sos_acknowledged: "Answered an SOS",
  sos_closed: "Closed an SOS",
  booking_updated: "Moved a booking along",
  booking_deleted: "Deleted a booking",
  submission_deleted: "Deleted an enquiry",
  app_release_updated: "Published an app update",
  auto_check_out: "Checked out automatically",
  "sos.raise": "Raised an SOS",
  "sos.close": "Closed an SOS",
  ai_query: "Asked the assistant",
  posting_created: "Posted a guard to a site",
  booking_requested: "Requested guards",
  device_pending: "Signed in on a new phone",
  device_approved: "Approved a phone",
  device_blocked: "Blocked a phone",
  device_punch_accepted: "Accepted a held check-in",
  replacement_requested: "Asked for cover",
  replacement_assigned: "Assigned cover",
  client_registered: "Registered as a client",
  off_roster_approved: "Approved an off-roster check-in",
  wake_phone: "Woke a phone",
  contact_updated: "Changed contact details",
  account_deleted: "Deleted an account",
};

/** Where each kind of record lives, so an entry can open the thing it is about. */
const ENTITY_HREF: Record<string, (id: string) => string> = {
  profiles: (id) => `/console/users?person=${id}`,
  sites: (id) => `/console/sites?site=${id}`,
  attendance: (id) => `/console/attendance?record=${id}`,
  service_requests: (id) => `/console/bookings?open=${id}`,
  sos_alerts: (id) => `/console/sos?alert=${id}`,
};

const ENTITY_LABEL: Record<string, string> = {
  profiles: "account",
  sites: "site",
  site_postings: "roster posting",
  shifts: "shift",
  shift_types: "shift type",
  attendance: "punch",
  guard_devices: "phone",
  service_requests: "booking",
  replacement_requests: "cover request",
  sos_alerts: "SOS alert",
  handover_notes: "handover note",
  location_pins: "location pin",
  submissions: "enquiry",
  app_release: "app update",
  software_fee_settings: "software fee setting",
  software_fee_invoices: "software fee invoice",
  software_fee_extras: "software fee charge",
};

/**
 * Colour by consequence, not by subject.
 *
 * Somebody reading this page is looking for the entries that changed something
 * they would want to know about. A sign-in is noise; a role change, a PIN reset
 * and an impersonation are the three lines an auditor is actually here for, so
 * those are the ones that carry weight.
 */
function toneFor(action: string): Tone {
  if (action.startsWith("impersonation")) return "amber";
  if (action.includes("refused") || action.includes("deactivated") || action.endsWith("_deleted")) return "rose";
  if (
    action.includes("reset") ||
    action.includes("role_changed") ||
    action.includes("force_closed") ||
    action.includes("reviewed")
  ) {
    return "violet";
  }
  if (action === "sign_in" || action === "sign_out") return "slate";
  return "sky";
}

/** The entry in a line: what the recorded detail says, in words. */
function summary(r: AuditRow): string {
  const d = (r.detail ?? {}) as Record<string, unknown>;
  const n = (k: string) => (typeof d[k] === "number" ? (d[k] as number) : null);
  const hm = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`);
  const parts: string[] = [];
  if (r.action === "check_in" || r.action === "check_in_refused") {
    if (typeof d.status === "string") parts.push(d.status === "late" ? "Late" : d.status === "on_time" ? "On time" : d.status.replace(/_/g, " "));
    if (n("distance_m") != null) parts.push(`${n("distance_m")} m from the centre${n("accuracy_m") != null ? ` (±${n("accuracy_m")} m)` : ""}`);
    if (d.off_roster === true) parts.push("off roster");
    if (typeof d.device_flag === "string") parts.push(d.device_flag === "shared_device" ? "another guard's phone" : "unapproved phone");
    if (typeof d.reason === "string") parts.push(d.reason);
  } else if (r.action === "check_out" || r.action === "auto_check_out") {
    if (n("worked_minutes") != null) parts.push(`Worked ${hm(n("worked_minutes")!)}`);
    if (n("overtime_minutes")) parts.push(`${hm(n("overtime_minutes")!)} overtime`);
    if (n("distance_m") != null) parts.push(`${n("distance_m")} m from the centre`);
  } else if (r.action === "sign_in") {
    const how = d.method === "name_mobile" ? "Name and mobile" : d.method === "google" ? "Google" : typeof d.method === "string" ? d.method.replace(/_/g, " ") : "";
    if (how) parts.push(how);
    if (d.client === "mobile") parts.push("app");
  } else {
    for (const k of ["reference", "name", "role", "employee_code", "kind", "status", "to"]) {
      if (typeof d[k] === "string") parts.push(String(d[k]).replace(/_/g, " "));
    }
  }
  return parts.join(" · ");
}

/* ------------------------------------------------------------------ feed -- */

type Group = "all" | "people" | "sites" | "roster" | "punches" | "bookings" | "sos" | "phones" | "fees" | "signins" | "other";

const GROUPS: { key: Group; label: string }[] = [
  { key: "all", label: "All" },
  { key: "people", label: "People" },
  { key: "sites", label: "Sites" },
  { key: "roster", label: "Roster" },
  { key: "punches", label: "Punches" },
  { key: "bookings", label: "Bookings" },
  { key: "sos", label: "SOS" },
  { key: "phones", label: "Phones" },
  { key: "fees", label: "Software fee" },
  { key: "signins", label: "Sign-ins" },
  { key: "other", label: "Other" },
];

const ENTITY_GROUP: Record<string, Group> = {
  profiles: "people",
  sites: "sites",
  location_pins: "sites",
  handover_notes: "sites",
  site_postings: "roster",
  shifts: "roster",
  shift_types: "roster",
  replacement_requests: "roster",
  attendance: "punches",
  guard_devices: "phones",
  service_requests: "bookings",
  submissions: "bookings",
  sos_alerts: "sos",
  software_fee_settings: "fees",
  software_fee_invoices: "fees",
  software_fee_extras: "fees",
};

function groupOf(r: AuditRow): Group {
  if (r.action === "sign_in" || r.action === "sign_out") return "signins";
  if (r.action.startsWith("check_") || r.action === "auto_check_out" || r.action.startsWith("attendance")) return "punches";
  if (r.action.startsWith("sos")) return "sos";
  if (r.action.startsWith("device")) return "phones";
  if (r.action.startsWith("posting") || r.action.startsWith("replacement") || r.action === "off_roster_approved") return "roster";
  if (r.action.startsWith("booking") || r.action.startsWith("submission")) return "bookings";
  if (r.action.startsWith("site") || r.action.startsWith("location_pin") || r.action.startsWith("handover")) return "sites";
  if (r.action.startsWith("account") || r.action.startsWith("role") || r.action.includes("pin") || r.action === "profile_updated" || r.action === "contact_updated") return "people";
  return (r.entity && ENTITY_GROUP[r.entity]) || "other";
}

const IST_DAY = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });

function dayLabel(key: string): string {
  const today = IST_DAY(new Date().toISOString());
  const yesterday = IST_DAY(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  const d = new Date(`${key}T12:00:00+05:30`);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: key.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric", timeZone: IST });
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: IST });

/** Field names in words. Anything not listed is read off the column name. */
const FIELD_LABEL: Record<string, string> = {
  id: "Record id",
  full_name: "Name",
  employee_code: "Employee code",
  lat: "Latitude",
  lng: "Longitude",
  geofence_radius_m: "Geofence radius (m)",
  max_accuracy_m: "Accuracy allowed (m)",
  guard_id: "Guard",
  site_id: "Site",
  profile_id: "Person",
  client_id: "Client",
  raised_by: "Raised by",
  sent_by: "Sent by",
  author_id: "Written by",
  replacement_guard: "Cover guard",
  first_responder: "First responder",
  sos_enabled: "SOS on",
  is_test: "Test record",
  must_change_pin: "Must change PIN",
  per_guard_paise: "Rate per account",
  gst_percent: "GST %",
  starts: "Starts",
  ends: "Ends",
};

function fieldLabel(k: string): string {
  if (FIELD_LABEL[k]) return FIELD_LABEL[k];
  const words = k.replace(/_paise$/, "").replace(/_id$/, "").replace(/_m$/, " (m)").replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const UUID = /^[0-9a-f-]{36}$/i;

/** A recorded value in words: names for ids, rupees for paise, IST for times. */
function show(key: string, v: unknown, names: Record<string, string>): string {
  if (v === null || v === undefined || v === "") return "empty";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number" && key.endsWith("_paise")) return `₹${(v / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  if (typeof v === "string") {
    if (UUID.test(v)) return names[v] ?? v.slice(0, 8);
    if (ISO_TIME.test(v)) return dateTime(v);
    return v.length > 160 ? `${v.slice(0, 160)}…` : v;
  }
  const text = JSON.stringify(v);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

function changesOf(r: AuditRow): { key: string; from: unknown; to: unknown }[] {
  if (!r.before || !r.after) return [];
  const keys = new Set([...Object.keys(r.before), ...Object.keys(r.after)]);
  const out: { key: string; from: unknown; to: unknown }[] = [];
  for (const k of keys) if (JSON.stringify(r.before[k]) !== JSON.stringify(r.after[k])) out.push({ key: k, from: r.before[k], to: r.after[k] });
  return out;
}

/** What the changed record is, in a few words: its name, or whose and where. */
function recordName(r: AuditRow, names: Record<string, string>): string {
  const x = (r.after ?? r.before ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof x[k] === "string" && x[k] ? (x[k] as string) : "");
  const who = (k: string) => (str(k) ? (names[str(k)] ?? "") : "");
  switch (r.entity) {
    case "profiles":
      return [str("full_name"), str("employee_code")].filter(Boolean).join(" · ");
    case "sites":
      return str("name");
    case "service_requests":
      return [str("reference"), str("organisation") || str("contact_name")].filter(Boolean).join(" · ");
    case "submissions":
      return [str("name"), str("subject") || str("kind")].filter(Boolean).join(" · ");
    case "software_fee_invoices":
      return str("number");
    case "software_fee_extras":
      return str("label");
    case "app_release":
      return x.version_name ? `${str("version_name")} (build ${String(x.version_code ?? "")})` : "";
    case "shift_types":
      return str("label") || str("code");
    case "guard_devices":
      return [who("profile_id"), [str("brand"), str("model")].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
    case "location_pins":
      return who("sent_by");
    case "handover_notes":
      return [who("author_id"), who("site_id")].filter(Boolean).join(" at ");
    case "sos_alerts":
      return [who("raised_by"), who("site_id")].filter(Boolean).join(" at ");
    default:
      return [who("guard_id"), who("site_id")].filter(Boolean).join(" at ");
  }
}

const VERB = { insert: "added", update: "changed", delete: "removed" } as const;

function article(noun: string) {
  return /^[aeiou]/i.test(noun) || noun.startsWith("SOS") ? "an" : "a";
}

const KIND_STYLE = {
  insert: { icon: Plus, tile: "bg-emerald-100 text-emerald-700" },
  update: { icon: PencilLine, tile: "bg-amber-100 text-amber-700" },
  delete: { icon: Trash2, tile: "bg-rose-100 text-rose-700" },
} as const;

const TONE_TILE: Partial<Record<Tone, string>> = {
  rose: "bg-rose-100 text-rose-700",
  amber: "bg-amber-100 text-amber-700",
  violet: "bg-violet-100 text-violet-700",
  slate: "bg-slate-100 text-slate-600",
  sky: "bg-sky-100 text-sky-700",
};

/** An event's icon, by what kind of thing happened. */
function eventIcon(r: AuditRow): LucideIcon {
  const a = r.action;
  if (a === "sign_in") return LogIn;
  if (a === "sign_out") return LogOut;
  if (a === "check_in" || a === "check_in_refused") return LogIn;
  if (a === "check_out" || a === "auto_check_out") return LogOut;
  if (a.startsWith("attendance")) return ClipboardCheck;
  if (a.startsWith("sos")) return ShieldAlert;
  if (a.startsWith("device") || a === "wake_phone") return Smartphone;
  if (a === "ai_query") return Bot;
  if (a.includes("pin")) return KeyRound;
  if (a.startsWith("site") || a.startsWith("location") || a.startsWith("handover")) return MapPin;
  if (a.startsWith("posting") || a.startsWith("replacement") || a.startsWith("off_roster")) return CalendarClock;
  if (a.startsWith("booking") || a.startsWith("app_release")) return ReceiptIndianRupee;
  if (a.startsWith("account") || a.startsWith("role") || a.includes("profile") || a.includes("contact") || a.startsWith("impersonation")) return UserRound;
  return Dot;
}

const PAGE = 60;

export function AuditWorkspace({ rows, names }: { rows: AuditRow[]; names: Record<string, string> }) {
  const [group, setGroup] = useState<Group>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [about, setAbout] = useState(false);

  const counts = useMemo(() => {
    const c: Partial<Record<Group, number>> = { all: rows.length };
    for (const r of rows) {
      const g = groupOf(r);
      if (g !== "all") c[g] = (c[g] ?? 0) + 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const inGroup = group === "all" ? rows : rows.filter((r) => groupOf(r) === group);
    if (!query.trim()) return inGroup;
    return inGroup.filter((r) =>
      matchesSearch(query, [
        r.who?.name,
        r.who?.phone,
        r.actor_code,
        r.site,
        r.action,
        ACTION_LABEL[r.action],
        r.entity,
        r.entity && ENTITY_LABEL[r.entity],
        r.ip,
        summary(r),
        recordName(r, names),
        r.source === "trigger" ? changesOf(r).map((c) => fieldLabel(c.key)) : null,
        r.detail,
      ]),
    );
  }, [rows, group, query, names]);

  const dayTotal = useMemo(() => {
    const t = new Map<string, number>();
    for (const r of filtered) t.set(IST_DAY(r.created_at), (t.get(IST_DAY(r.created_at)) ?? 0) + 1);
    return t;
  }, [filtered]);

  const days = useMemo(() => {
    const out: { key: string; items: AuditRow[] }[] = [];
    for (const r of filtered.slice(0, shown)) {
      const key = IST_DAY(r.created_at);
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push(r);
      else out.push({ key, items: [r] });
    }
    return out;
  }, [filtered, shown]);

  const pick = (g: Group) => {
    setGroup(g);
    setOpen(null);
    setShown(PAGE);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {GROUPS.filter((g) => g.key === "all" || counts[g.key]).map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => pick(g.key)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
              group === g.key ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {g.label}
            <span className={cn("tabular-nums text-[11px]", group === g.key ? "text-background/70" : "text-muted-foreground")}>{counts[g.key] ?? 0}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAbout((v) => !v)}
          aria-expanded={about}
          className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <Info className="size-3.5" /> How this log works
        </button>
      </div>

      {about && (
        <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          Two kinds of entry. <b className="text-foreground">Event</b> lines are written by the website and the app in words: a sign-in, a
          check-in, an SOS answered. <b className="text-foreground">Change</b> lines are written by the database itself whenever a record
          is added, changed or removed, wherever it came from, with the record as it was before and after. Open one with Detail to
          see exactly which fields moved. Nobody can edit or delete these entries from the console.
        </p>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
          placeholder="Search names, sites, fields, anything in the log…"
          className="h-10 w-full rounded-xl border border-border bg-card pr-9 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
        />
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
          {rows.length ? "Nothing matches." : "Nothing recorded in this period."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {days.map((day) => (
            <section key={day.key}>
              <h3 className="sticky top-0 z-[1] flex items-center gap-2 border-b border-border bg-muted/70 px-4 py-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase backdrop-blur">
                {dayLabel(day.key)}
                <span className="rounded-full bg-background px-1.5 py-px text-[10px] tabular-nums">{dayTotal.get(day.key) ?? day.items.length}</span>
              </h3>
              <ul className="divide-y divide-border">
                {day.items.map((r) => (
                  <Entry key={r.id} r={r} names={names} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {filtered.length > shown && (
        <div className="flex items-center justify-center gap-3">
          <p className="text-xs text-muted-foreground tabular-nums">
            Showing {shown.toLocaleString("en-IN")} of {filtered.length.toLocaleString("en-IN")}
          </p>
          <button type="button" onClick={() => setShown((n) => n + PAGE * 2)} className="h-8 rounded-full border border-border bg-card px-4 text-[13px] font-medium hover:bg-muted">
            Show more
          </button>
        </div>
      )}
    </div>
  );
}

function Entry({ r, names, open, onToggle }: { r: AuditRow; names: Record<string, string>; open: boolean; onToggle: () => void }) {
  const change = r.source === "trigger" && (r.action === "insert" || r.action === "update" || r.action === "delete") ? r.action : null;
  const changes = change === "update" ? changesOf(r) : [];
  const noun = (r.entity && ENTITY_LABEL[r.entity]) ?? r.entity ?? "record";
  const name = change ? recordName(r, names) : "";
  const style = change ? KIND_STYLE[change] : null;
  const Icon = style?.icon ?? eventIcon(r);
  const tile = style?.tile ?? TONE_TILE[toneFor(r.action)] ?? TONE_TILE.sky;
  const detail = (r.detail ?? null) as Record<string, unknown> | null;
  const hasDetail = change ? true : !!detail && Object.keys(detail).length > 0;
  const href = r.entity && r.entity_id && ENTITY_HREF[r.entity] && change !== "delete" ? ENTITY_HREF[r.entity]!(r.entity_id) : null;
  const actor = r.who?.name ?? r.actor_code ?? "System";
  const line = change ? summaryOfChange(changes) : summary(r);

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", tile)}>
          {createElement(Icon, { className: "size-4", strokeWidth: 2.1 })}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] leading-snug">
            <span className={cn("font-semibold", !r.who && !r.actor_code && "text-muted-foreground")}>{actor}</span>{" "}
            {change ? (
              <>
                <span className="text-muted-foreground">
                  {VERB[change]} {article(noun)} {noun}
                </span>
                {name && <span className="font-medium"> · {name}</span>}
              </>
            ) : (
              <span className="text-muted-foreground">{(ACTION_LABEL[r.action] ?? r.action.replace(/[_.]/g, " ")).replace(/^./, (c) => c.toLowerCase())}</span>
            )}
            <span
              className={cn(
                "ml-2 inline-block rounded-md px-1.5 py-px align-[2px] text-[10px] font-semibold tracking-wider uppercase",
                change ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700",
              )}
            >
              {change ? "Change" : "Event"}
            </span>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <time dateTime={r.created_at} title={dateTime(r.created_at)} className="tabular-nums">
              {clock(r.created_at)}
            </time>
            {r.site && <span>· {r.site}</span>}
            {r.ip && <span className="font-mono">· {r.ip}</span>}
            {r.who?.phone && <span className="font-mono">· {r.who.phone}</span>}
          </p>
          {line && !open && <p className="mt-1 truncate text-[13px] text-muted-foreground">{line}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {href && (
            <Link href={href} title={`Open this ${noun}`} className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground">
              <ArrowUpRight className="size-4" />
            </Link>
          )}
          {hasDetail && (
            <button
              type="button"
              aria-expanded={open}
              onClick={onToggle}
              className={cn(
                "h-8 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                open ? "border-foreground bg-card" : "border-border bg-card hover:bg-muted",
              )}
            >
              {open ? "Hide" : "Detail"}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 ml-11 overflow-hidden rounded-xl border border-border bg-muted/30">
          {change === "update" ? (
            <Fields head={["Field", "Before", "After"]} rows={changes.map((c) => [fieldLabel(c.key), show(c.key, c.from, names), show(c.key, c.to, names)])} diff />
          ) : change ? (
            <Fields
              head={["Field", change === "delete" ? "Was" : "Value"]}
              rows={Object.entries((change === "delete" ? r.before : r.after) ?? {})
                .filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && !v.length))
                .map(([k, v]) => [fieldLabel(k), show(k, v, names)])}
            />
          ) : (
            <Fields head={["Detail", "Value"]} rows={Object.entries(detail ?? {}).map(([k, v]) => [fieldLabel(k), show(k, v, names)])} />
          )}
        </div>
      )}
    </li>
  );
}

function summaryOfChange(changes: { key: string }[]): string {
  if (!changes.length) return "";
  const names = changes.map((c) => fieldLabel(c.key));
  return names.length > 4 ? `${names.slice(0, 4).join(", ")} +${names.length - 4} more` : names.join(", ");
}

function Fields({ head, rows, diff }: { head: string[]; rows: string[][]; diff?: boolean }) {
  if (!rows.length) return <p className="px-4 py-3 text-sm text-muted-foreground">Nothing else was recorded.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border text-left text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {head.map((h) => (
              <th key={h} className="px-4 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {rows.map((cells, i) => (
            <tr key={i} className="align-top">
              {cells.map((c, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-4 py-2 break-words",
                    j === 0 ? "w-[28%] font-medium whitespace-nowrap" : "font-mono text-[12px]",
                    diff && j === 1 && "text-rose-700 dark:text-rose-400",
                    diff && j === 2 && "text-emerald-700 dark:text-emerald-400",
                  )}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
