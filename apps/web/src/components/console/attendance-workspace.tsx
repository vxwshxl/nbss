"use client";

import { useState, useTransition } from "react";
import {
  Crosshair,
  Gauge,
  MapPin,
  Radio,
  ShieldCheck,
  SquareCheckBig,
  TimerOff,
} from "lucide-react";
import { toast } from "sonner";

import { forceCheckOut, reviewAttendance } from "@/app/console/attendance/actions";
import { SiteMap, type MapPunch, type MapSite } from "@/components/console/site-map";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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
  /** The fence this punch was judged against, for the evidence map. */
  site: MapSite | null;
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

type Verdict = "present" | "late" | "absent" | "rejected";

const VERDICTS: { value: Verdict; label: string; note: string }[] = [
  { value: "present", label: "Present", note: "Worked as recorded" },
  { value: "late", label: "Late", note: "Worked, but arrived after the grace period" },
  { value: "absent", label: "Absent", note: "Did not work this shift" },
  { value: "rejected", label: "Rejected", note: "Not a genuine punch — excluded from pay" },
];

/** One line of the evidence panel. */
function Fact({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon?: typeof MapPin;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-app-line-soft py-2 last:border-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="size-3.5 shrink-0" strokeWidth={1.9} />}
        {label}
      </span>
      <span className={mono ? "text-right font-mono text-sm tabular-nums" : "text-right text-sm"}>
        {value}
      </span>
    </div>
  );
}

/**
 * Attendance, with the evidence behind each punch one click away.
 *
 * The table shows what a supervisor scans for. The panel shows what a dispute
 * needs: where the guard actually stood, drawn against the fence they were
 * judged against, how precise the fix was, what their phone claimed the time
 * was, and who has changed the record since.
 *
 * A side sheet rather than a dialog, because the evidence is a long column — a
 * map, ten facts and a review form — and a centred dialog holding all of that
 * either scrolls inside itself or covers the table it came from.
 */
export function AttendanceWorkspace({
  rows,
  canReview,
}: {
  rows: AttendanceRow[];
  canReview: boolean;
}) {
  const [pending, start] = useTransition();
  const [detail, setDetail] = useState<AttendanceRow | null>(null);
  const [verdict, setVerdict] = useState<Verdict>("present");
  const [note, setNote] = useState("");

  function open(row: AttendanceRow) {
    setDetail(row);
    setVerdict(
      row.status === "late" || row.status === "absent" || row.status === "rejected"
        ? (row.status as Verdict)
        : "present",
    );
    setNote("");
  }

  function submitReview() {
    if (!detail) return;
    start(async () => {
      const result = await reviewAttendance(detail.id, verdict, note);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${detail.guard_name ?? "Punch"} marked ${STATUS_LABEL[verdict]?.toLowerCase()}`,
      );
      setDetail(null);
    });
  }

  function closeShift() {
    if (!detail) return;
    start(async () => {
      const result = await forceCheckOut(detail.id, note || "Closed by the operations desk.");
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Shift closed", {
        description: "Capped at the site's standard shift and flagged for review.",
      });
      setDetail(null);
    });
  }

  // A guard sees only their own punches, so the guard column is dropped for
  // them rather than repeating their own name on every row.
  const showGuard = rows.some((r) => r.guard_name);

  const columns: Column<AttendanceRow>[] = [
    ...(showGuard
      ? [
          {
            header: "Guard",
            cell: (r: AttendanceRow) => (
              <span className="block">
                <span className="block font-medium">{r.guard_name ?? "—"}</span>
                <span className="block font-mono text-xs text-muted-foreground">
                  {r.guard_code ?? ""}
                </span>
              </span>
            ),
            sortValue: (r: AttendanceRow) => r.guard_name ?? "",
            searchValue: (r: AttendanceRow) => `${r.guard_name ?? ""} ${r.guard_code ?? ""}`,
            printCell: (r: AttendanceRow) => r.guard_name ?? "—",
          },
        ]
      : []),
    {
      header: "Site",
      cell: (r) => r.site_name ?? "—",
      sortValue: (r) => r.site_name ?? "",
      searchValue: (r) => r.site_name ?? "",
    },
    {
      header: "In",
      cell: (r) => <span className="tabular-nums">{shortTime(r.check_in_at)}</span>,
      sortValue: (r) => r.check_in_at ?? "",
      printCell: (r) => shortTime(r.check_in_at),
    },
    {
      header: "Out",
      cell: (r) =>
        r.check_out_at ? (
          <span className="tabular-nums">{shortTime(r.check_out_at)}</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            <Radio className="size-3.5" strokeWidth={2.2} />
            On duty
          </span>
        ),
      sortValue: (r) => r.check_out_at ?? "",
      printCell: (r) => (r.check_out_at ? shortTime(r.check_out_at) : "On duty"),
    },
    {
      header: "Worked",
      className: "text-right",
      headClassName: "text-right",
      cell: (r) => <span className="tabular-nums">{hours(r.worked_minutes)}</span>,
      sortValue: (r) => r.worked_minutes ?? -1,
      printCell: (r) => hours(r.worked_minutes),
    },
    {
      header: "Overtime",
      className: "text-right",
      headClassName: "text-right",
      cell: (r) => <span className="tabular-nums">{hours(r.overtime_minutes)}</span>,
      sortValue: (r) => r.overtime_minutes ?? -1,
      printCell: (r) => hours(r.overtime_minutes),
    },
    {
      header: "Distance",
      className: "text-right",
      headClassName: "text-right",
      cell: (r) => (
        <span className="tabular-nums">
          {r.check_in_distance_m === null ? "—" : `${Math.round(r.check_in_distance_m)} m`}
        </span>
      ),
      sortValue: (r) => r.check_in_distance_m ?? -1,
      printCell: (r) =>
        r.check_in_distance_m === null ? "—" : `${Math.round(r.check_in_distance_m)} m`,
    },
    {
      header: "State",
      className: "text-right",
      headClassName: "text-right",
      cell: (r) => <StatusPill status={r.status} />,
      sortValue: (r) => r.status,
      searchValue: (r) => STATUS_LABEL[r.status] ?? r.status,
      printCell: (r) => STATUS_LABEL[r.status] ?? r.status,
    },
  ];

  const punch: MapPunch[] =
    detail?.check_in_lat != null && detail.check_in_lng != null
      ? [
          {
            lat: detail.check_in_lat,
            lng: detail.check_in_lng,
            accuracy: detail.check_in_accuracy_m,
            distance: detail.check_in_distance_m,
            inside: detail.check_in_method === "geofence",
            label: `${detail.guard_name ?? "Guard"} checked in`,
          },
        ]
      : [];

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        getRowKey={(r) => r.id}
        interactiveRows
        rowPreview={false}
        onRowClick={open}
        printTitle={showGuard ? "Attendance" : "My attendance"}
        searchPlaceholder={
          showGuard ? "Search by guard, code or site…" : "Search by site or state…"
        }
        emptyMessage="No attendance recorded yet. Punches appear here as soon as a guard checks in."
        rowClassName={(r) =>
          r.status === "pending_review" ? "bg-amber-50/60 dark:bg-amber-500/8" : undefined
        }
      />

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {detail.guard_name ?? "Punch"}
                  <StatusPill status={detail.status} />
                </SheetTitle>
                <SheetDescription>
                  {detail.site_name ?? "Unknown site"}
                  {detail.guard_code ? ` · ${detail.guard_code}` : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
                {/* Where they stood, against the fence they were judged by.
                    This is the one piece of evidence a written register could
                    never produce, so it leads rather than sitting in a list. */}
                {detail.site && punch.length > 0 && (
                  <div>
                    <SiteMap
                      sites={[detail.site]}
                      punches={punch}
                      focus={detail.site.id}
                      height={220}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      The shaded ring is the site&apos;s geofence. The dot is where the
                      phone reported itself; the halo around it is how sure the
                      phone was.
                    </p>
                  </div>
                )}

                <section>
                  <h3 className="mb-1 text-sm font-semibold">The shift</h3>
                  <Fact label="Checked in" value={dateTime(detail.check_in_at)} mono />
                  <Fact
                    label="Checked out"
                    value={
                      detail.check_out_at ? dateTime(detail.check_out_at) : "Still on duty"
                    }
                    mono
                  />
                  <Fact label="Worked" value={hours(detail.worked_minutes)} mono />
                  <Fact
                    label="Overtime"
                    value={detail.overtime_minutes ? hours(detail.overtime_minutes) : "—"}
                    mono
                  />
                </section>

                <section>
                  <h3 className="mb-1 text-sm font-semibold">Evidence</h3>
                  <Fact
                    icon={MapPin}
                    label="Distance in"
                    value={
                      detail.check_in_distance_m === null
                        ? "—"
                        : `${Math.round(detail.check_in_distance_m)} m from centre`
                    }
                    mono
                  />
                  <Fact
                    icon={Gauge}
                    label="GPS accuracy"
                    value={
                      detail.check_in_accuracy_m === null
                        ? "—"
                        : `±${Math.round(detail.check_in_accuracy_m)} m`
                    }
                    mono
                  />
                  <Fact
                    icon={Crosshair}
                    label="Coordinates"
                    value={
                      detail.check_in_lat !== null && detail.check_in_lng !== null
                        ? `${detail.check_in_lat.toFixed(6)}, ${detail.check_in_lng.toFixed(6)}`
                        : "—"
                    }
                    mono
                  />
                  <Fact
                    icon={ShieldCheck}
                    label="Allowed by"
                    value={METHOD_LABEL[detail.check_in_method] ?? detail.check_in_method}
                  />
                  {detail.check_out_at && (
                    <Fact
                      icon={MapPin}
                      label="Distance out"
                      value={
                        detail.check_out_distance_m === null
                          ? "—"
                          : `${Math.round(detail.check_out_distance_m)} m`
                      }
                      mono
                    />
                  )}
                  <Fact label="Device clock" value={dateTime(detail.device_reported_at)} mono />
                  <Fact label="From" value={detail.ip ?? "—"} mono />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Times are the server&apos;s. The device clock is recorded for
                    comparison and never used to decide anything — a phone
                    disagreeing with the server is itself worth noticing.
                  </p>
                </section>

                {detail.review_note && (
                  <div className="rounded-lg border border-app-line-soft bg-muted/50 p-3 text-sm">
                    <p className="font-medium">
                      Reviewed {shortTime(detail.reviewed_at)}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">{detail.review_note}</p>
                  </div>
                )}

                {canReview && (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">Review</h3>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="verdict">Mark this shift as</Label>
                      <Select
                        value={verdict}
                        onValueChange={(v) => setVerdict(v as Verdict)}
                      >
                        <SelectTrigger id="verdict" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VERDICTS.map((v) => (
                            <SelectItem key={v.value} value={v.value}>
                              {v.label}
                              <span className="ml-2 text-xs text-muted-foreground">
                                {v.note}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="reason">
                        Reason <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="reason"
                        rows={2}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Why this record is being changed"
                      />
                      <p className="text-xs text-muted-foreground">
                        Kept with the punch and written to the audit log. The original
                        coordinates and times are never overwritten.
                      </p>
                    </div>
                  </section>
                )}
              </div>

              {canReview && (
                <SheetFooter className="flex-row justify-end gap-2">
                  {!detail.check_out_at && (
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={closeShift}
                      className="mr-auto"
                    >
                      <TimerOff data-icon="inline-start" />
                      Close this shift
                    </Button>
                  )}
                  <Button disabled={pending} onClick={submitReview}>
                    <SquareCheckBig data-icon="inline-start" />
                    {pending ? "Saving…" : "Save review"}
                  </Button>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
