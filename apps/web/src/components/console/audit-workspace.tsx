"use client";

import { useState } from "react";
import Link from "next/link";
import { Database, ExternalLink, Globe, KeyRound, ScrollText, UserRound } from "lucide-react";

import {
  Field,
  FieldGrid,
  PreviewActions,
  PreviewBody,
  PreviewDialog,
  PreviewHero,
  Section,
} from "@/components/console/preview-kit";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
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
  profiles: "person",
  sites: "site",
  attendance: "punch",
  service_requests: "booking",
  sos_alerts: "alert",
  submissions: "enquiry",
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

export function AuditWorkspace({ rows }: { rows: AuditRow[] }) {
  const [detail, setDetail] = useState<AuditRow | null>(null);

  const columns: Column<AuditRow>[] = [
    {
      header: "When",
      cell: (r) => <span className="tabular-nums">{dateTime(r.created_at)}</span>,
      sortValue: (r) => r.created_at,
      printCell: (r) => dateTime(r.created_at),
    },
    {
      header: "Who",
      cell: (r) =>
        r.who ? (
          <span className="block min-w-0">
            <span className="block truncate text-sm font-medium">{r.who.name}</span>
            {r.who.phone && <span className="block font-mono text-xs text-muted-foreground">{r.who.phone}</span>}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">{r.actor_code ?? "System"}</span>
        ),
      sortValue: (r) => r.who?.name ?? r.actor_code ?? "",
      searchValue: (r) => `${r.who?.name ?? ""} ${r.who?.phone ?? ""} ${r.actor_code ?? ""}`,
      printCell: (r) => (r.who ? `${r.who.name}${r.who.phone ? ` · ${r.who.phone}` : ""}` : (r.actor_code ?? "System")),
    },
    {
      header: "Action",
      cell: (r) => (
        <StatusPill label={ACTION_LABEL[r.action] ?? r.action} tone={toneFor(r.action)} />
      ),
      sortValue: (r) => ACTION_LABEL[r.action] ?? r.action,
      searchValue: (r) => `${ACTION_LABEL[r.action] ?? ""} ${r.action}`,
      printCell: (r) => ACTION_LABEL[r.action] ?? r.action,
    },
    {
      header: "Where",
      cell: (r) => <span className="text-sm">{r.site ?? <span className="text-muted-foreground">-</span>}</span>,
      sortValue: (r) => r.site ?? "",
      searchValue: (r) => r.site ?? "",
      printCell: (r) => r.site ?? "-",
    },
    {
      header: "Details",
      cell: (r) => <span className="block max-w-[22rem] truncate text-sm text-muted-foreground">{summary(r) || "-"}</span>,
      searchValue: (r) => `${summary(r)} ${r.entity ?? ""} ${r.entity_id ?? ""}`,
      printCell: (r) => summary(r) || "-",
    },
    {
      header: "From",
      className: "text-right",
      headClassName: "text-right",
      cell: (r) => <span className="font-mono text-sm">{r.ip ?? "-"}</span>,
      searchValue: (r) => r.ip ?? "",
      printCell: (r) => r.ip ?? "-",
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        getRowKey={(r) => String(r.id)}
        interactiveRows
        rowPreview={false}
        onRowClick={setDetail}
        printTitle="Audit log"
        initialPageSize={50}
        searchPlaceholder="Search by name, mobile, action, site or address…"
        emptyMessage="Nothing recorded yet."
      />

      <PreviewDialog open={!!detail} onClose={() => setDetail(null)} label="Audit entry">
        {detail && (
          <>
            <PreviewHero
              icon={ScrollText}
              tone={toneFor(detail.action) === "rose" ? "rose" : toneFor(detail.action) === "amber" ? "amber" : "brand"}
              title={ACTION_LABEL[detail.action] ?? detail.action}
              meta={
                <>
                  <span>{dateTime(detail.created_at)}</span>
                  {(detail.who || detail.actor_code) && <span aria-hidden>·</span>}
                  {detail.who ? <span>{detail.who.name}</span> : detail.actor_code && <span className="font-mono">{detail.actor_code}</span>}
                </>
              }
            />
            <PreviewBody>
              <FieldGrid>
                <Field icon={UserRound} label="Who" value={detail.who ? `${detail.who.name}${detail.who.phone ? ` · ${detail.who.phone}` : ""}` : detail.actor_code} />
                <Field icon={Database} label="Where" value={detail.site} />
                <Field icon={Globe} label="From" mono value={detail.ip} />
                <Field icon={KeyRound} label="Action key" mono value={detail.action} />
                <Field icon={Database} label="Record" mono value={detail.entity} />
              </FieldGrid>
              {detail.entity_id && (
                <p className="rounded-lg bg-muted/50 px-3 py-2 font-mono text-xs break-all text-muted-foreground">
                  {detail.entity_id}
                </p>
              )}
              <Section title="Recorded detail">
                {/* The raw payload, verbatim. Mono earns its place here —
                    this is data being read for exactness, not prose — and it
                    is deliberately not prettied into a field list, because
                    the shape of the payload is itself part of the record. */}
                <pre className="overflow-x-auto rounded-lg border border-app-line-soft bg-muted/50 p-3 font-mono text-xs leading-relaxed">
                  {detail.detail
                    ? JSON.stringify(detail.detail, null, 2)
                    : "No additional detail was recorded."}
                </pre>
              </Section>
            </PreviewBody>
            {detail.entity && detail.entity_id && ENTITY_HREF[detail.entity] && (
              <PreviewActions>
                <Button asChild size="sm">
                  <Link href={ENTITY_HREF[detail.entity]!(detail.entity_id)}>
                    <ExternalLink data-icon="inline-start" />
                    Open this {ENTITY_LABEL[detail.entity] ?? "record"}
                  </Link>
                </Button>
              </PreviewActions>
            )}
          </>
        )}
      </PreviewDialog>
    </>
  );
}
