"use client";

import { useState, useTransition } from "react";

import { forceCheckOut, reviewAttendance } from "@/app/console/attendance/actions";
import { DataTable, type Column } from "@/components/console/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { byDate, byNum, byText } from "@/lib/hooks/useTableControls";

export type AttendanceRow = {
  id: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_accuracy_m: number | null;
  check_in_distance_m: number | null;
  check_in_method: string;
  check_out_distance_m: number | null;
  check_out_method: string | null;
  worked_minutes: number | null;
  overtime_minutes: number | null;
  status: string;
  device_reported_at: string | null;
  ip: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  guard_name: string | null;
  guard_code: string | null;
  site_name: string | null;
};

const IST = "Asia/Kolkata";

function dateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  });
}

function shortTime(iso: string | null): string {
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

function hours(minutes: number | null): string {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  pending_review: "Needs review",
  rejected: "Rejected",
};

const METHOD_LABEL: Record<string, string> = {
  geofence: "Inside the boundary",
  supervisor_override: "Supervisor override",
  auto_close: "Closed automatically",
};

function badgeClass(status: string, closed: boolean): string {
  if (status === "late" || status === "pending_review" || status === "rejected") return "cbadge--late";
  return closed ? "cbadge--off" : "cbadge--on";
}

/**
 * Attendance, with the evidence behind each punch one click away.
 *
 * The table shows what a supervisor scans for; the detail shows what a dispute
 * needs — where the guard stood, how precise the fix was, what the device
 * claimed the time was, and who has changed the record since.
 */
export function AttendanceWorkspace({
  rows,
  canReview,
}: {
  rows: AttendanceRow[];
  canReview: boolean;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [detail, setDetail] = useState<AttendanceRow | null>(null);
  const [verdict, setVerdict] = useState<"present" | "late" | "absent" | "rejected">("present");
  const [note, setNote] = useState("");

  const open = (row: AttendanceRow) => {
    setDetail(row);
    setVerdict(
      row.status === "late" || row.status === "absent" || row.status === "rejected"
        ? (row.status as "late" | "absent" | "rejected")
        : "present",
    );
    setNote("");
  };

  const submitReview = () => {
    if (!detail) return;
    start(async () => {
      const result = await reviewAttendance(detail.id, verdict, note);
      if (!result.ok) {
        toast.error("Could not save the review", result.error);
        return;
      }
      toast.ok("Attendance updated", `${detail.guard_name ?? "This punch"} — ${STATUS_LABEL[verdict]}.`);
      setDetail(null);
    });
  };

  const closeShift = () => {
    if (!detail) return;
    start(async () => {
      const result = await forceCheckOut(detail.id, note || "Closed by the operations desk.");
      if (!result.ok) {
        toast.error("Could not close the shift", result.error);
        return;
      }
      toast.ok("Shift closed", "Capped at the site's standard shift and flagged for review.");
      setDetail(null);
    });
  };

  const showGuard = rows.some((r) => r.guard_name);

  const columns: Column<AttendanceRow>[] = [
    ...(showGuard
      ? [
          {
            key: "guard",
            label: "Guard",
            sort: byText((r: AttendanceRow) => r.guard_name),
            render: (r: AttendanceRow) => r.guard_name ?? "—",
          },
        ]
      : []),
    { key: "site", label: "Site", sort: byText((r) => r.site_name), render: (r) => r.site_name ?? "—" },
    {
      key: "in",
      label: "In",
      mono: true,
      sort: byDate((r) => r.check_in_at),
      defaultDir: "desc",
      render: (r) => shortTime(r.check_in_at),
    },
    {
      key: "out",
      label: "Out",
      mono: true,
      sort: byDate((r) => r.check_out_at),
      defaultDir: "desc",
      render: (r) => (r.check_out_at ? shortTime(r.check_out_at) : "On duty"),
    },
    {
      key: "worked",
      label: "Worked",
      mono: true,
      sort: byNum((r) => r.worked_minutes),
      defaultDir: "desc",
      render: (r) => hours(r.worked_minutes),
    },
    {
      key: "overtime",
      label: "Overtime",
      mono: true,
      sort: byNum((r) => r.overtime_minutes),
      defaultDir: "desc",
      render: (r) => hours(r.overtime_minutes),
    },
    {
      key: "distance",
      label: "Distance",
      mono: true,
      sort: byNum((r) => r.check_in_distance_m),
      defaultDir: "desc",
      render: (r) => (r.check_in_distance_m === null ? "—" : `${Math.round(r.check_in_distance_m)} m`),
    },
    {
      key: "state",
      label: "State",
      sort: byText((r) => r.status),
      render: (r) => (
        <span className={`cbadge ${badgeClass(r.status, !!r.check_out_at)}`}>
          {STATUS_LABEL[r.status] ?? r.status}
        </span>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        getKey={(r) => r.id}
        onRowClick={open}
        persistKey={`nbss.table.attendance.${showGuard ? "all" : "mine"}`}
        initialSort="in"
        initialDir="desc"
        searchPlaceholder={showGuard ? "Search by guard, code or site…" : "Search by site…"}
        searchFields={(r) => [r.guard_name, r.guard_code, r.site_name, STATUS_LABEL[r.status]]}
        dateField={(r) => r.check_in_at}
        empty={{
          title: "No attendance recorded yet.",
          body: "Punches appear here as soon as a guard checks in.",
        }}
      />

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        wide
        title={detail?.guard_name ?? "Punch"}
        description={
          detail
            ? `${detail.site_name ?? "Unknown site"}${detail.guard_code ? ` · ${detail.guard_code}` : ""}`
            : undefined
        }
        footer={
          detail && canReview ? (
            <>
              {!detail.check_out_at && (
                <button className="btn btn--ghost btn--sm" type="button" disabled={pending} onClick={closeShift}>
                  Close this shift
                </button>
              )}
              <button className="btn btn--solid btn--sm" type="button" disabled={pending} onClick={submitReview}>
                {pending ? "Saving…" : "Save review"}
              </button>
            </>
          ) : null
        }
      >
        {detail && (
          <>
            <dl className="ui-dl">
              <dt>Checked in</dt>
              <dd className="mono">{dateTime(detail.check_in_at)}</dd>

              <dt>Checked out</dt>
              <dd className="mono">
                {detail.check_out_at ? dateTime(detail.check_out_at) : "Still on duty"}
              </dd>

              <dt>Worked</dt>
              <dd className="mono">
                {hours(detail.worked_minutes)}
                {detail.overtime_minutes ? ` · ${hours(detail.overtime_minutes)} overtime` : ""}
              </dd>

              <dt>State</dt>
              <dd>
                <span className={`cbadge ${badgeClass(detail.status, !!detail.check_out_at)}`}>
                  {STATUS_LABEL[detail.status] ?? detail.status}
                </span>
              </dd>
            </dl>

            <div className="cpanel" style={{ background: "var(--ink-100)" }}>
              <div className="cpanel__head">
                <h3 className="cpanel__h">Evidence</h3>
              </div>
              <div className="cpanel__body">
                <dl className="ui-dl">
                  <dt>Distance in</dt>
                  <dd className="mono">
                    {detail.check_in_distance_m === null
                      ? "—"
                      : `${Math.round(detail.check_in_distance_m)} m from the centre`}
                  </dd>

                  <dt>GPS accuracy</dt>
                  <dd className="mono">
                    {detail.check_in_accuracy_m === null
                      ? "—"
                      : `±${Math.round(detail.check_in_accuracy_m)} m`}
                  </dd>

                  <dt>Coordinates</dt>
                  <dd className="mono">
                    {detail.check_in_lat !== null && detail.check_in_lng !== null
                      ? `${detail.check_in_lat.toFixed(6)}, ${detail.check_in_lng.toFixed(6)}`
                      : "—"}
                  </dd>

                  <dt>Allowed by</dt>
                  <dd>{METHOD_LABEL[detail.check_in_method] ?? detail.check_in_method}</dd>

                  {detail.check_out_at && (
                    <>
                      <dt>Distance out</dt>
                      <dd className="mono">
                        {detail.check_out_distance_m === null
                          ? "—"
                          : `${Math.round(detail.check_out_distance_m)} m`}
                      </dd>
                    </>
                  )}

                  <dt>Device clock</dt>
                  <dd className="mono">{dateTime(detail.device_reported_at)}</dd>

                  <dt>From</dt>
                  <dd className="mono">{detail.ip ?? "—"}</dd>
                </dl>

                <p className="ui-hint" style={{ marginTop: 12 }}>
                  Times are the server&apos;s. The device clock is recorded for comparison and
                  never used to decide anything — a phone disagreeing with the server is itself
                  worth noticing.
                </p>
              </div>
            </div>

            {detail.review_note && (
              <p className="cpunch__hint">
                <strong>Previously reviewed {shortTime(detail.reviewed_at)}:</strong>{" "}
                {detail.review_note}
              </p>
            )}

            {canReview && (
              <>
                <Select
                  label="Mark this shift as"
                  value={verdict}
                  onChange={setVerdict}
                  options={[
                    { value: "present", label: "Present", note: "Worked as recorded" },
                    { value: "late", label: "Late", note: "Worked, but arrived after the grace period" },
                    { value: "absent", label: "Absent", note: "Did not work this shift" },
                    { value: "rejected", label: "Rejected", note: "Not a genuine punch — excluded from pay" },
                  ]}
                />

                <label className="ui-field">
                  <span className="ui-label">
                    Reason<span className="ui-req"> *</span>
                  </span>
                  <textarea
                    className="cfield__i"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Why this record is being changed"
                  />
                  <span className="ui-hint">
                    Kept with the punch and written to the audit log. The original coordinates and
                    times are never overwritten.
                  </span>
                </label>
              </>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
