"use client";

import { useState } from "react";

import { DataTable, type Column } from "@/components/console/DataTable";
import { Modal } from "@/components/ui/Modal";
import { byDate, byText } from "@/lib/hooks/useTableControls";

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

/** Machine names read badly in a list somebody scans for wrongdoing. */
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
};

export function AuditWorkspace({ rows }: { rows: AuditRow[] }) {
  const [detail, setDetail] = useState<AuditRow | null>(null);

  const columns: Column<AuditRow>[] = [
    {
      key: "when",
      label: "When",
      mono: true,
      sort: byDate((r) => r.created_at),
      defaultDir: "desc",
      render: (r) => dateTime(r.created_at),
    },
    {
      key: "who",
      label: "Who",
      mono: true,
      sort: byText((r) => r.actor_code),
      render: (r) => r.actor_code ?? "—",
    },
    {
      key: "action",
      label: "Action",
      sort: byText((r) => r.action),
      render: (r) => ACTION_LABEL[r.action] ?? r.action,
    },
    { key: "entity", label: "Concerning", sort: byText((r) => r.entity), render: (r) => r.entity ?? "—" },
    { key: "ip", label: "From", mono: true, render: (r) => r.ip ?? "—" },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        getKey={(r) => String(r.id)}
        onRowClick={setDetail}
        persistKey="nbss.table.audit"
        initialSort="when"
        initialDir="desc"
        searchPlaceholder="Search by person, action or address…"
        searchFields={(r) => [r.actor_code, r.action, ACTION_LABEL[r.action], r.entity, r.entity_id, r.ip]}
        dateField={(r) => r.created_at}
        empty={{
          title: "Nothing logged yet.",
          body: "Sign-ins, PIN resets, attendance corrections and impersonation are recorded here.",
        }}
      />

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? (ACTION_LABEL[detail.action] ?? detail.action) : ""}
        description={detail ? dateTime(detail.created_at) : undefined}
      >
        {detail && (
          <>
            <dl className="ui-dl">
              <dt>Who</dt>
              <dd className="mono">{detail.actor_code ?? "—"}</dd>

              <dt>Action</dt>
              <dd className="mono">{detail.action}</dd>

              <dt>Concerning</dt>
              <dd className="mono">{detail.entity ?? "—"}</dd>

              <dt>Record</dt>
              <dd className="mono">{detail.entity_id ?? "—"}</dd>

              <dt>From</dt>
              <dd className="mono">{detail.ip ?? "—"}</dd>
            </dl>

            {detail.detail != null && (
              <div>
                <span className="ui-label" style={{ display: "block", marginBottom: 6 }}>
                  Details
                </span>
                <pre className="caudit__json">{JSON.stringify(detail.detail, null, 2)}</pre>
              </div>
            )}

            <p className="ui-hint">
              This log is append-only. Nothing here can be edited or removed, including by an
              administrator — that is what makes it worth reading.
            </p>
          </>
        )}
      </Modal>
    </>
  );
}
