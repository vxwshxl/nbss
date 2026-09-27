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
  if (action.includes("refused") || action.includes("deactivated")) return "rose";
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
      cell: (r) => (
        <span className="font-mono text-sm">{r.actor_code ?? "—"}</span>
      ),
      sortValue: (r) => r.actor_code ?? "",
      searchValue: (r) => r.actor_code ?? "",
      printCell: (r) => r.actor_code ?? "—",
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
      header: "Entity",
      cell: (r) => <span className="font-mono text-sm">{r.entity ?? "—"}</span>,
      sortValue: (r) => r.entity ?? "",
      searchValue: (r) => `${r.entity ?? ""} ${r.entity_id ?? ""}`,
      printCell: (r) => r.entity ?? "—",
    },
    {
      header: "From",
      className: "text-right",
      headClassName: "text-right",
      cell: (r) => <span className="font-mono text-sm">{r.ip ?? "—"}</span>,
      searchValue: (r) => r.ip ?? "",
      printCell: (r) => r.ip ?? "—",
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
        searchPlaceholder="Search by who, action, entity or address…"
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
                  {detail.actor_code && <span aria-hidden>·</span>}
                  {detail.actor_code && <span className="font-mono">{detail.actor_code}</span>}
                </>
              }
            />
            <PreviewBody>
              <FieldGrid>
                <Field icon={UserRound} label="Who" mono value={detail.actor_code} />
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
