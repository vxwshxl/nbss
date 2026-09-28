"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  Clock,
  Crosshair,
  Gauge,
  Hourglass,
  Mail,
  MapPin,
  MapPinned,
  Navigation,
  Phone,
  Radio,
  ShieldAlert,
  Timer,
  TriangleAlert,
  UserRound,
  Users,
} from "lucide-react";

import { SOS_KIND_LABEL, isLive } from "@nbss/shared/sos";

import { siteDetail, type SiteDetail } from "@/app/console/sites/preview";
import { AttendancePreviewDialog } from "@/components/console/attendance-preview";
import {
  Field,
  FieldGrid,
  HeroPill,
  PhoneLink,
  PreviewActions,
  PreviewBody,
  PreviewDialog,
  PreviewHero,
  Section,
  Stat,
  StatGrid,
  ago,
  istDateTime,
} from "@/components/console/preview-kit";
import { SiteMap, type MapSite } from "@/components/console/site-map";
import { SosPreviewDialog } from "@/components/console/sos-preview";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { BOOKING_STATUS_LABEL, type BookingStatus } from "@/lib/bookings";
import { mapsUrl } from "@/lib/fence";
import { daysLabel, windowLabel } from "@/lib/roster";
import { initials } from "@/lib/ui/initials";
import { cn } from "@/lib/utils";

/** The site as the table already has it; the popup loads the rest. */
export type SiteSummary = MapSite & {
  address: string | null;
  max_accuracy_m: number;
  shift_start: string | null;
  shift_end: string | null;
  grace_minutes: number;
  standard_shift_minutes: number;
  active: boolean;
};

function clock(value: string | null): string {
  if (!value) return "—";
  const [h, m] = value.split(":");
  const hour = Number(h);
  if (!Number.isFinite(hour)) return value;
  return `${hour % 12 === 0 ? 12 : hour % 12}:${m ?? "00"} ${hour < 12 ? "am" : "pm"}`;
}

function shiftHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function PersonRow({
  name,
  code,
  phone,
  detail,
  right,
  onOpen,
}: {
  name: string;
  code: string;
  phone: string | null;
  detail: React.ReactNode;
  right?: React.ReactNode;
  onOpen?: () => void;
}) {
  return (
    <li
      onClick={onOpen}
      className={cn("flex items-center gap-3 px-3.5 py-2.5", onOpen && "cursor-pointer transition-colors hover:bg-muted/60")}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
        {initials(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {name} <span className="font-mono text-xs font-normal text-muted-foreground">{code}</span>
        </span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
      {phone && (
        <a
          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-app-line-soft px-2.5 py-1.5 font-mono text-xs text-primary-ink transition-colors hover:bg-accent"
          aria-label={`Call ${name}`}
        >
          <Phone className="size-3.5" />
          <span className="hidden sm:inline">{phone}</span>
        </a>
      )}
      {right}
      {onOpen && <ChevronRight className="size-4 text-muted-foreground" />}
    </li>
  );
}

/**
 * A site, opened from the sites table (or `?site=<id>` from anywhere else).
 *
 * The people come first: who is at the gate right now with a number to ring,
 * then who is normally posted there, then whose site it is. The fence and the
 * shift rules follow, then the site's SOS history and the booking it came
 * from. Clicking a guard on duty opens that punch; clicking an alert opens it.
 */
export function SitePreviewDialog({
  site,
  onClose,
  actions,
  canReview = false,
}: {
  site: SiteSummary | null;
  onClose: () => void;
  /** Whether a punch opened from here may be reviewed. */
  canReview?: boolean;
  /** Extra buttons for the action bar — the workspace's service toggle. */
  actions?: React.ReactNode;
}) {
  const [data, setData] = useState<SiteDetail | { error: string } | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [, load] = useTransition();
  const [punchId, setPunchId] = useState<string | null>(null);
  const [sosId, setSosId] = useState<string | null>(null);

  useEffect(() => {
    if (!site) return;
    const id = site.id;
    load(async () => {
      const d = await siteDetail(id);
      setData(d);
      setLoadedFor(id);
    });
  }, [site]);

  const d = data && !("error" in data) && loadedFor === site?.id ? data : null;
  const liveSos = d?.sos.filter((a) => isLive(a.status)) ?? [];

  return (
    <>
      <PreviewDialog open={!!site} onClose={onClose} label="Site" wide>
        {site && (
          <>
            <PreviewHero
              icon={Building2}
              tone={liveSos.length ? "rose" : site.active ? "brand" : "slate"}
              title={site.name}
              meta={
                <>
                  <span>{site.client_name ?? "No client recorded"}</span>
                  {site.district && <span aria-hidden>·</span>}
                  {site.district && <span>{site.district}</span>}
                </>
              }
              badge={
                <>
                  <HeroPill>{site.active ? "In service" : "Out of service"}</HeroPill>
                  <HeroPill>● {d ? d.onDuty.length : site.onDuty} on duty</HeroPill>
                  {liveSos.length > 0 && <HeroPill>⚠ {liveSos.length} live SOS</HeroPill>}
                </>
              }
            />

            <PreviewBody>
              {liveSos.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSosId(a.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-left text-rose-900 transition hover:bg-rose-100"
                >
                  <ShieldAlert className="size-5 shrink-0 text-rose-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      SOS · {a.by} · {SOS_KIND_LABEL[a.kind]}
                    </span>
                    <span className="block text-xs">Raised {ago(a.raisedAt)} — open it to call and respond</span>
                  </span>
                  <ChevronRight className="size-4" />
                </button>
              ))}

              <StatGrid>
                <Stat icon={Radio} label="On duty now" tone="text-primary-ink">
                  {d ? d.onDuty.length : site.onDuty}
                </Stat>
                <Stat icon={Users} label="Guards · 30d" tone="text-sky-700">
                  {d ? d.stats.guards30 : "…"}
                </Stat>
                <Stat icon={CalendarCheck} label="Shifts · 30d">
                  {d ? d.stats.shifts30 : "…"}
                </Stat>
                <Stat icon={TriangleAlert} label="Late · 30d" tone={d?.stats.late30 ? "text-amber-600" : "text-foreground"}>
                  {d ? d.stats.late30 : "…"}
                </Stat>
              </StatGrid>

              {site.active && <SiteMap sites={[site]} focus={site.id} height={220} />}

              {d && (
                <Section
                  title={`Roster · needs ${d.required ?? "—"} on duty · ${d.posted.length} posted`}
                  action={
                    <Link
                      href={`/console/roster?site=${site.id}`}
                      onClick={onClose}
                      className="text-xs font-medium text-primary-ink hover:underline"
                    >
                      Manage roster
                    </Link>
                  }
                >
                  {d.posted.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-app-line-soft px-4 py-4 text-center text-sm text-muted-foreground">
                      Nobody is posted here — guards check in first come, first served.
                    </p>
                  ) : (
                    <ul className="divide-y divide-app-line-soft overflow-hidden rounded-xl border border-app-line-soft">
                      {d.posted.map((p) => (
                        <PersonRow
                          key={p.id}
                          name={p.name}
                          code={p.code}
                          phone={p.phone}
                          detail={`${windowLabel(p.starts, p.ends)} · ${daysLabel(p.days)}`}
                          right={
                            <StatusPill
                              status={d.onDuty.some((x) => x.id === p.id) ? "on_duty" : "checked_out"}
                              label={d.onDuty.some((x) => x.id === p.id) ? "On duty" : "Off duty"}
                            />
                          }
                        />
                      ))}
                    </ul>
                  )}
                </Section>
              )}

              <Section title={`On duty now · ${d ? d.onDuty.length : "…"}`}>
                {!d ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : d.onDuty.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-app-line-soft px-4 py-5 text-center text-sm text-muted-foreground">
                    Nobody is checked in here right now.
                  </p>
                ) : (
                  <ul className="divide-y divide-app-line-soft overflow-hidden rounded-xl border border-app-line-soft">
                    {d.onDuty.map((p) => (
                      <PersonRow
                        key={p.attendanceId}
                        name={p.name}
                        code={p.code}
                        phone={p.phone}
                        detail={`Since ${istDateTime(p.since).split(", ").pop()}${p.distance != null ? ` · ${Math.round(p.distance)} m from centre` : ""}`}
                        right={<StatusPill status={p.late ? "late" : "on_duty"} />}
                        onOpen={() => setPunchId(p.attendanceId)}
                      />
                    ))}
                  </ul>
                )}
              </Section>

              {d && d.regulars.length > 0 && (
                <Section title="Posted here · last 30 days">
                  <ul className="divide-y divide-app-line-soft overflow-hidden rounded-xl border border-app-line-soft">
                    {d.regulars.map((p) => (
                      <PersonRow
                        key={p.id}
                        name={p.name}
                        code={p.code}
                        phone={p.phone}
                        detail={`${p.shifts} shift${p.shifts === 1 ? "" : "s"} · last ${istDateTime(p.last)}`}
                        right={
                          <Link
                            href={`/console/guards?person=${p.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-medium text-primary-ink hover:underline"
                          >
                            Profile
                          </Link>
                        }
                      />
                    ))}
                  </ul>
                </Section>
              )}

              <Section title="Client">
                {d?.client ? (
                  <div className="rounded-xl border border-app-line-soft p-4">
                    <FieldGrid>
                      <Field icon={UserRound} label="Client" value={`${d.client.name} · ${d.client.code}`} />
                      <Field icon={Phone} label="Phone" value={<PhoneLink phone={d.client.phone} />} />
                      <Field
                        icon={Mail}
                        label="Email"
                        value={
                          d.client.email ? (
                            <a className="text-primary-ink hover:underline" href={`mailto:${d.client.email}`}>
                              {d.client.email}
                            </a>
                          ) : null
                        }
                      />
                      <Field icon={MapPin} label="Address" value={site.address} />
                    </FieldGrid>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {site.client_name
                      ? `${site.client_name} — no client login is linked to this site yet.`
                      : "No client recorded for this site."}
                  </p>
                )}
              </Section>

              <Section title="Fence & shift">
                <FieldGrid>
                  <Field
                    icon={MapPinned}
                    label="Boundary"
                    value={site.ring ? `Drawn area, ${site.ring.length} points` : `Circle, ${site.geofence_radius_m} m radius`}
                  />
                  <Field icon={Crosshair} label="Centre" mono value={`${site.lat.toFixed(6)}, ${site.lng.toFixed(6)}`} />
                  <Field icon={Gauge} label="Required accuracy" mono value={`±${site.max_accuracy_m} m`} />
                  <Field
                    icon={Clock}
                    label="Shift window"
                    value={site.shift_start ? `${clock(site.shift_start)} – ${clock(site.shift_end)}` : "Not set"}
                  />
                  <Field icon={Timer} label="Grace" value={`${site.grace_minutes} min`} />
                  <Field icon={Hourglass} label="Standard shift" value={`${shiftHours(site.standard_shift_minutes)} · then overtime`} />
                </FieldGrid>
              </Section>

              <Section title={`SOS at this site · ${d ? d.sos.length : "…"}`}>
                {d && d.sos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No SOS has been raised here.</p>
                ) : (
                  <ul className="divide-y divide-app-line-soft overflow-hidden rounded-xl border border-app-line-soft">
                    {d?.sos.map((a) => (
                      <li
                        key={a.id}
                        onClick={() => setSosId(a.id)}
                        className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-muted/60"
                      >
                        <ShieldAlert className={cn("size-4", isLive(a.status) ? "text-rose-600" : "text-muted-foreground")} />
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="font-medium">{a.by}</span> · {SOS_KIND_LABEL[a.kind]}
                          <span className="block text-xs text-muted-foreground">{istDateTime(a.raisedAt, true)}</span>
                        </span>
                        <StatusPill status={a.status === "active" ? "sos_active" : a.status} />
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {d && d.bookings.length > 0 && (
                <Section title="Bookings">
                  <ul className="flex flex-wrap gap-2">
                    {d.bookings.map((b) => (
                      <li key={b.id}>
                        <Link
                          href={`/console/bookings?open=${b.id}`}
                          onClick={onClose}
                          className="inline-flex items-center gap-2 rounded-xl border border-app-line-soft px-3 py-2 text-sm transition-colors hover:bg-muted/60"
                        >
                          <ClipboardList className="size-4 text-primary-ink" />
                          <span className="font-mono text-xs">{b.reference}</span>
                          <StatusPill status={b.status} label={BOOKING_STATUS_LABEL[b.status as BookingStatus]} />
                          {b.quoted != null && (
                            <span className="text-xs text-muted-foreground">
                              ₹{(b.quoted / 100).toLocaleString("en-IN")}/mo
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </PreviewBody>

            <PreviewActions>
              {d?.client?.phone && (
                <Button asChild variant="outline" size="sm">
                  <a href={`tel:${d.client.phone.replace(/[^\d+]/g, "")}`}>
                    <Phone data-icon="inline-start" />
                    Call client
                  </a>
                </Button>
              )}
              <Button asChild variant="outline" size="sm">
                <a href={mapsUrl(site.lat, site.lng)} target="_blank" rel="noopener noreferrer">
                  <Navigation data-icon="inline-start" />
                  Directions
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/console/attendance?site=${site.id}`} onClick={onClose}>
                  <CalendarCheck data-icon="inline-start" />
                  Attendance here
                </Link>
              </Button>
              {actions}
            </PreviewActions>
          </>
        )}
      </PreviewDialog>

      <AttendancePreviewDialog id={punchId} onClose={() => setPunchId(null)} canReview={canReview} staff />
      <SosPreviewDialog id={sosId} onClose={() => setSosId(null)} />
    </>
  );
}
