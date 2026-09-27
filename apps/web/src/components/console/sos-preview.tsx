"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  BellRing,
  Building2,
  CheckCircle2,
  Clock,
  Crosshair,
  Footprints,
  Gauge,
  MapPin,
  Navigation,
  Phone,
  ShieldAlert,
  ShieldOff,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { SOS_KIND_LABEL, SOS_STATUS_LABEL, isLive } from "@nbss/shared/sos";

import { closeSosAlert, respondToSos } from "@/app/console/sos/actions";
import { sosDetail, type SosDetail } from "@/app/console/sos/preview";
import {
  Field,
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
  ago,
  istDateTime,
} from "@/components/console/preview-kit";
import { SiteMap, type MapPunch } from "@/components/console/site-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/status-pill";
import { mapsUrl } from "@/lib/fence";
import { initials } from "@/lib/ui/initials";

const RESPONSE_LABEL: Record<string, { label: string; tone: "emerald" | "sky" | "slate" }> = {
  responding: { label: "On the way", tone: "sky" },
  on_scene: { label: "On scene", tone: "emerald" },
  cannot_respond: { label: "Cannot come", tone: "slate" },
};

function minutesBetween(a: string, b: string | null): string {
  if (!b) return "—";
  const m = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/**
 * One SOS, opened from the dashboard's alert strip, the SOS log or a site.
 *
 * The guard's number and their position lead, because while an alert is live
 * the only useful things are reaching them and getting someone there. Below:
 * who was told, who answered and from how far, and how it ended.
 */
export function SosPreviewDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [data, setData] = useState<SosDetail | { error: string } | null>(null);
  const [loading, load] = useTransition();
  const [saving, save] = useTransition();
  const [note, setNote] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!id) return;
    load(async () => {
      setData(await sosDetail(id));
    });
  }, [id, version]);

  function close() {
    onClose();
    setData(null);
    setNote("");
  }

  const d = data && !("error" in data) && data.id === id ? data : null;

  function respond() {
    if (!d) return;
    save(async () => {
      const r = await respondToSos(d.id, "responding");
      if (!r.ok) return void toast.error(r.error);
      toast.success("Marked on the way", { description: `${d.guard?.name ?? "The guard"} can see help is coming.` });
      setVersion((v) => v + 1);
    });
  }

  function finish(status: "resolved" | "false_alarm") {
    if (!d) return;
    save(async () => {
      const r = await closeSosAlert(d.id, status, note);
      if (!r.ok) return void toast.error(r.error);
      toast.success(status === "resolved" ? "Alert closed as resolved" : "Stood down as a false alarm");
      close();
    });
  }

  const live = d ? isLive(d.status) : false;
  const where: MapPunch[] =
    d?.lat != null && d.lng != null
      ? [
          {
            lat: d.lat,
            lng: d.lng,
            accuracy: d.accuracy,
            distance: null,
            inside: d.insideFence ?? false,
            label: `${d.guard?.name ?? "Guard"} pressed SOS here`,
          },
        ]
      : [];

  return (
    <PreviewDialog open={!!id} onClose={close} label="SOS alert" wide>
      {!data || (loading && !d) || (!d && !("error" in data)) ? (
        <PreviewLoading />
      ) : "error" in data ? (
        <PreviewError message={data.error} />
      ) : (
        d && (
          <>
            <PreviewHero
              icon={ShieldAlert}
              tone={live ? "rose" : "slate"}
              title={`SOS · ${d.guard?.name ?? "A guard"}`}
              meta={
                <>
                  <span>{d.site?.name ?? "Unknown site"}</span>
                  <span aria-hidden>·</span>
                  <span>{live ? `raised ${ago(d.raisedAt)}` : istDateTime(d.raisedAt, true)}</span>
                </>
              }
              badge={
                <>
                  <HeroPill>{live ? `● ${SOS_STATUS_LABEL[d.status]}` : SOS_STATUS_LABEL[d.status]}</HeroPill>
                  <HeroPill>{SOS_KIND_LABEL[d.kind]}</HeroPill>
                  {d.insideFence === false && <HeroPill>Outside the fence</HeroPill>}
                </>
              }
            />

            <PreviewBody>
              {d.guard?.phone && live && (
                <a
                  href={`tel:${d.guard.phone.replace(/[^\d+]/g, "")}`}
                  className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900 transition hover:bg-rose-100"
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-rose-600 text-white">
                    <Phone className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold tracking-wide uppercase">Call {d.guard.name}</span>
                    <span className="block font-mono text-lg font-bold">{d.guard.phone}</span>
                  </span>
                </a>
              )}

              <StatGrid>
                <Stat icon={BellRing} label="Raised" tone={live ? "text-rose-700" : "text-foreground"}>
                  {istDateTime(d.raisedAt).split(", ").pop()}
                </Stat>
                <Stat icon={Users} label="Alerted">
                  {d.notified.staff + d.notified.guards + d.notified.client}
                </Stat>
                <Stat icon={Footprints} label="Responding" tone={d.responders.length ? "text-primary-ink" : "text-amber-600"}>
                  {d.responders.filter((r) => r.response !== "cannot_respond").length}
                </Stat>
                <Stat icon={Clock} label="First answer">
                  {minutesBetween(d.raisedAt, d.acknowledgedAt)}
                </Stat>
              </StatGrid>

              {d.site && (
                <Section title="Where">
                  <SiteMap sites={[d.site]} punches={where} focus={d.site.id} height={230} />
                  <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    <Field
                      icon={Crosshair}
                      label="Position"
                      mono
                      value={d.lat != null && d.lng != null ? `${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}` : "No fix — indoors?"}
                    />
                    <Field icon={Gauge} label="Accuracy" mono value={d.accuracy != null ? `±${Math.round(d.accuracy)} m` : null} />
                    <Field icon={Building2} label="Site" value={[d.site.name, d.site.district].filter(Boolean).join(" · ")} />
                    <Field icon={MapPin} label="Address" value={d.site.address} />
                  </dl>
                </Section>
              )}

              {d.note && (
                <p className="rounded-xl bg-muted/60 px-3.5 py-3 text-sm">
                  <span className="font-semibold">From the guard: </span>
                  {d.note}
                </p>
              )}

              <Section title={`Responders · ${d.responders.length}`}>
                {d.responders.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-app-line-soft px-4 py-5 text-center text-sm text-muted-foreground">
                    Nobody has answered yet. {d.notified.staff} staff, {d.notified.guards} guard
                    {d.notified.guards === 1 ? "" : "s"} on site and {d.notified.client ? "the client" : "no client"} were alerted.
                  </p>
                ) : (
                  <ul className="divide-y divide-app-line-soft rounded-xl border border-app-line-soft">
                    {d.responders.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 px-3.5 py-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                          {initials(r.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{r.name}</span>
                          <span className="block text-xs text-muted-foreground capitalize">
                            {r.role} · {istDateTime(r.at).split(", ").pop()}
                            {r.distance != null ? ` · ${r.distance < 1000 ? `${Math.round(r.distance)} m` : `${(r.distance / 1000).toFixed(1)} km`} away` : ""}
                          </span>
                        </span>
                        <PhoneLink phone={r.phone} className="hidden text-xs sm:inline" />
                        <StatusPill label={RESPONSE_LABEL[r.response]?.label ?? r.response} tone={RESPONSE_LABEL[r.response]?.tone} />
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {!live && (
                <div className="flex items-start gap-2.5 rounded-xl border border-app-line-soft bg-muted/40 px-3.5 py-3 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary-ink" />
                  <span>
                    {SOS_STATUS_LABEL[d.status]} {d.closedBy ? `by ${d.closedBy}` : ""} · {istDateTime(d.closedAt, true)} —
                    open for {minutesBetween(d.raisedAt, d.closedAt)}.
                    {d.closingNote && <span className="mt-1 block text-muted-foreground">{d.closingNote}</span>}
                  </span>
                </div>
              )}

              {live && (
                <Section title="Closing note">
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What happened — optional, kept with the alert"
                  />
                </Section>
              )}
            </PreviewBody>

            <PreviewActions>
              {d.guard && (
                <Button asChild variant="outline" size="sm" className="mr-auto">
                  <Link href={`/console/guards?person=${d.guard.id}`} onClick={close}>
                    <UserRound data-icon="inline-start" />
                    Guard profile
                  </Link>
                </Button>
              )}
              {d.site?.clientPhone && (
                <Button asChild variant="outline" size="sm">
                  <a href={`tel:${d.site.clientPhone.replace(/[^\d+]/g, "")}`}>
                    <Phone data-icon="inline-start" />
                    Call client
                  </a>
                </Button>
              )}
              {d.lat != null && d.lng != null && (
                <Button asChild variant="outline" size="sm">
                  <a href={mapsUrl(d.lat, d.lng)} target="_blank" rel="noopener noreferrer">
                    <Navigation data-icon="inline-start" />
                    Directions
                  </a>
                </Button>
              )}
              {live && (
                <>
                  <Button variant="outline" size="sm" disabled={saving} onClick={() => finish("false_alarm")}>
                    <ShieldOff data-icon="inline-start" />
                    False alarm
                  </Button>
                  {d.canAcknowledge && (
                    <Button variant="outline" size="sm" disabled={saving} onClick={respond}>
                      <Footprints data-icon="inline-start" />
                      I&apos;m on the way
                    </Button>
                  )}
                  <Button size="sm" disabled={saving} onClick={() => finish("resolved")}>
                    <CheckCircle2 data-icon="inline-start" />
                    Resolved
                  </Button>
                </>
              )}
            </PreviewActions>
          </>
        )
      )}
    </PreviewDialog>
  );
}
