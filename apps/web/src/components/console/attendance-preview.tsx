"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarCheck,
  Clock,
  Crosshair,
  Gauge,
  LogOut,
  Mail,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  SquareCheckBig,
  Timer,
  TimerOff,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { forceCheckOut, reviewAttendance } from "@/app/console/attendance/actions";
import { attendanceDetail, type AttendanceDetail } from "@/app/console/attendance/preview";
import {
  Field,
  FieldGrid,
  HeroPill,
  PhoneLink,
  PreviewActions,
  PreviewBody,
  PreviewDialog,
  PreviewError,
  PreviewHero,
  PreviewLoading,
  Section,
  Stat,
  StatGrid,
  duration,
  istDateTime,
} from "@/components/console/preview-kit";
import { SiteMap, type MapPunch } from "@/components/console/site-map";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { mapsUrl } from "@/lib/fence";

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

function initialVerdict(status: string): Verdict {
  return status === "late" || status === "absent" || status === "rejected" ? status : "present";
}

/**
 * One punch, opened from any table that lists punches — the ledger, the
 * dashboard's "on duty now", a site's popup.
 *
 * Where the guard stood is drawn against the fence they were judged by; the
 * facts a dispute needs sit under it; and what can be done — call the guard,
 * open their profile or the site, correct the record, close a shift left open —
 * is pinned along the bottom.
 */
export function AttendancePreviewDialog({
  id,
  onClose,
  canReview,
  staff,
}: {
  id: string | null;
  onClose: () => void;
  /** Offer the review form and "close this shift". */
  canReview: boolean;
  /** Offer the guard's phone and links to other staff screens. */
  staff: boolean;
}) {
  const [data, setData] = useState<AttendanceDetail | { error: string } | null>(null);
  const [loading, load] = useTransition();
  const [saving, save] = useTransition();
  const [verdict, setVerdict] = useState<Verdict>("present");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!id) return;
    load(async () => {
      const d = await attendanceDetail(id);
      setData(d);
      if (!("error" in d)) setVerdict(initialVerdict(d.status));
      setNote("");
    });
  }, [id]);

  function close() {
    onClose();
    setData(null);
  }

  const d = data && !("error" in data) && data.id === id ? data : null;

  function submitReview() {
    if (!d) return;
    save(async () => {
      const result = await reviewAttendance(d.id, verdict, note);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${d.guard?.name ?? "Punch"} marked ${STATUS_LABEL[verdict]?.toLowerCase()}`);
      close();
    });
  }

  function closeShift() {
    if (!d) return;
    save(async () => {
      const result = await forceCheckOut(d.id, note || "Closed by the operations desk.");
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Shift closed", {
        description: "Capped at the site's standard shift and flagged for review.",
      });
      close();
    });
  }

  const punch: MapPunch[] =
    d?.check_in_lat != null && d.check_in_lng != null
      ? [
          {
            lat: d.check_in_lat,
            lng: d.check_in_lng,
            accuracy: d.check_in_accuracy_m,
            distance: d.check_in_distance_m,
            inside: d.check_in_method === "geofence",
            label: `${d.guard?.name ?? "Guard"} checked in`,
          },
        ]
      : [];

  return (
    <PreviewDialog open={!!id} onClose={close} label="Punch" wide>
      {!data || loading || (!d && !("error" in data)) ? (
        <PreviewLoading />
      ) : "error" in data ? (
        <PreviewError message={data.error} />
      ) : (
        d && (
          <>
            <PreviewHero
              avatar={d.guard?.name ?? "?"}
              title={d.guard?.name ?? "My shift"}
              tone={d.status === "pending_review" ? "amber" : d.status === "rejected" || d.status === "absent" ? "rose" : "brand"}
              meta={
                <>
                  {d.guard && <span className="font-mono">{d.guard.code}</span>}
                  {d.guard && <span aria-hidden>·</span>}
                  <span>{d.site?.name ?? "Unknown site"}</span>
                </>
              }
              badge={
                <>
                  <HeroPill>{STATUS_LABEL[d.status] ?? d.status}</HeroPill>
                  {!d.check_out_at && <HeroPill>● On duty now</HeroPill>}
                </>
              }
            />

            <PreviewBody>
              <StatGrid>
                <Stat icon={CalendarCheck} label="Checked in" tone="text-primary-ink">
                  {istDateTime(d.check_in_at).split(", ").pop()}
                </Stat>
                <Stat icon={LogOut} label={d.check_out_at ? "Checked out" : "On duty for"} tone="text-sky-700">
                  {d.check_out_at ? istDateTime(d.check_out_at).split(", ").pop() : duration(d.onDutyMinutes)}
                </Stat>
                <Stat icon={Clock} label="Worked">
                  {duration(d.worked_minutes)}
                </Stat>
                <Stat icon={Timer} label="Overtime" tone={d.overtime_minutes ? "text-violet-700" : "text-foreground"}>
                  {d.overtime_minutes ? duration(d.overtime_minutes) : "—"}
                </Stat>
              </StatGrid>

              {d.site && punch.length > 0 && (
                <Section title="Where they stood">
                  <SiteMap sites={[d.site]} punches={punch} focus={d.site.id} height={220} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    The shaded ring is the site&apos;s geofence. The dot is where the phone reported
                    itself; the halo around it is how sure the phone was.
                  </p>
                </Section>
              )}

              <Section title="Evidence">
                <FieldGrid>
                  <Field icon={CalendarCheck} label="Checked in" value={istDateTime(d.check_in_at, true)} />
                  <Field
                    icon={LogOut}
                    label="Checked out"
                    value={d.check_out_at ? istDateTime(d.check_out_at, true) : "Still on duty"}
                  />
                  <Field
                    icon={MapPin}
                    label="Distance in"
                    mono
                    value={d.check_in_distance_m === null ? null : `${Math.round(d.check_in_distance_m)} m from centre`}
                  />
                  <Field
                    icon={Gauge}
                    label="GPS accuracy"
                    mono
                    value={d.check_in_accuracy_m === null ? null : `±${Math.round(d.check_in_accuracy_m)} m`}
                  />
                  <Field
                    icon={Crosshair}
                    label="Coordinates"
                    mono
                    value={
                      d.check_in_lat !== null && d.check_in_lng !== null
                        ? `${d.check_in_lat.toFixed(6)}, ${d.check_in_lng.toFixed(6)}`
                        : null
                    }
                  />
                  <Field
                    icon={ShieldCheck}
                    label="Allowed by"
                    value={METHOD_LABEL[d.check_in_method] ?? d.check_in_method}
                  />
                  <Field icon={Clock} label="Device clock" mono value={istDateTime(d.device_reported_at, true)} />
                  <Field icon={Building2} label="Site" value={[d.site?.name, d.site?.district].filter(Boolean).join(" · ")} />
                </FieldGrid>
              </Section>

              {staff && d.guard && (
                <Section title="Guard">
                  <FieldGrid>
                    <Field icon={Phone} label="Phone" value={<PhoneLink phone={d.guard.phone} />} />
                    <Field icon={Mail} label="Email" value={d.guard.email} />
                  </FieldGrid>
                </Section>
              )}

              {d.review_note && (
                <div className="rounded-xl border border-app-line-soft bg-muted/50 p-3 text-sm">
                  <p className="font-medium">Reviewed {istDateTime(d.reviewed_at)}</p>
                  <p className="mt-0.5 text-muted-foreground">{d.review_note}</p>
                </div>
              )}

              {canReview && (
                <Section title="Review">
                  <div className="grid gap-3 rounded-xl border border-app-line-soft p-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="verdict">Mark this shift as</Label>
                      <Select value={verdict} onValueChange={(v) => setVerdict(v as Verdict)}>
                        <SelectTrigger id="verdict" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VERDICTS.map((v) => (
                            <SelectItem key={v.value} value={v.value}>
                              {v.label}
                              <span className="ml-2 text-xs text-muted-foreground">{v.note}</span>
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
                        Kept with the punch and written to the audit log. The original coordinates and
                        times are never overwritten.
                      </p>
                    </div>
                  </div>
                </Section>
              )}
            </PreviewBody>

            <PreviewActions>
              {staff && d.guard?.phone && (
                <Button asChild variant="outline" size="sm">
                  <a href={`tel:${d.guard.phone.replace(/[^\d+]/g, "")}`}>
                    <Phone data-icon="inline-start" />
                    Call guard
                  </a>
                </Button>
              )}
              {staff && d.guard && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/console/guards?person=${d.guard.id}`} onClick={close}>
                    <UserRound data-icon="inline-start" />
                    Guard profile
                  </Link>
                </Button>
              )}
              {staff && d.site && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/console/sites?site=${d.site.id}`} onClick={close}>
                    <Building2 data-icon="inline-start" />
                    Site
                  </Link>
                </Button>
              )}
              {d.check_in_lat !== null && d.check_in_lng !== null && (
                <Button asChild variant="outline" size="sm">
                  <a href={mapsUrl(d.check_in_lat, d.check_in_lng)} target="_blank" rel="noopener noreferrer">
                    <Navigation data-icon="inline-start" />
                    Directions
                  </a>
                </Button>
              )}
              {canReview && !d.check_out_at && (
                <Button variant="outline" size="sm" disabled={saving} onClick={closeShift}>
                  <TimerOff data-icon="inline-start" />
                  Close this shift
                </Button>
              )}
              {canReview && (
                <Button size="sm" disabled={saving} onClick={submitReview}>
                  <SquareCheckBig data-icon="inline-start" />
                  {saving ? "Saving…" : "Save review"}
                </Button>
              )}
            </PreviewActions>
          </>
        )
      )}
    </PreviewDialog>
  );
}
