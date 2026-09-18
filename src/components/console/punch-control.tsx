"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Gauge,
  LocateFixed,
  LogIn,
  LogOut,
  MapPin,
  Radio,
} from "lucide-react";

import { checkIn, checkOut } from "@/app/console/duty/actions";
import { emptyPunchState } from "@/app/console/duty/punch-state";
import { SiteMap, type MapSite } from "@/components/console/site-map";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type PunchSite = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  geofence_radius_m: number;
  max_accuracy_m: number;
  ring: [number, number][] | null;
};

type Fix = { lat: number; lng: number; accuracy: number; at: number };

type FixState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "ready"; fix: Fix }
  | { kind: "denied" }
  | { kind: "failed"; reason: string };

/** Haversine, the same formula as `geo_distance_m` in the database. */
function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

/**
 * One of the two live readings, drawn large enough to be read at arm's length
 * in daylight. This is the only screen in the product used standing up.
 */
function Reading({
  icon: Icon,
  label,
  value,
  note,
  good,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  note: string;
  good: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-4",
        good
          ? "border-primary/25 bg-primary/8"
          : "border-amber-500/30 bg-amber-100/50 dark:bg-amber-500/10",
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" strokeWidth={1.9} />
        {label}
      </span>
      <strong
        className={cn(
          "font-display text-3xl font-bold tracking-tight tabular-nums",
          good ? "text-primary" : "text-amber-700 dark:text-amber-300",
        )}
      >
        {value}
      </strong>
      <span className="text-xs text-muted-foreground">{note}</span>
    </div>
  );
}

/**
 * The one control a guard uses every day.
 *
 * The distance shown here is computed in the browser purely so the guard can
 * see whether walking closer will help *before* they press anything. It carries
 * no authority at all: the server recomputes it from the site's own record and
 * refuses the punch on its own answer. The two use the same formula so the
 * readout and the verdict never disagree in front of someone.
 *
 * `watchPosition` rather than `getCurrentPosition`: a first GPS fix indoors is
 * often hundreds of metres wide and then tightens over several seconds.
 * Watching lets the accuracy improve while the guard walks to the gate, instead
 * of freezing the worst reading of the day and refusing them on it.
 */
export function PunchControl({
  sites,
  openPunch,
}: {
  sites: PunchSite[];
  openPunch: { siteId: string; siteName: string; since: string } | null;
}) {
  const [state, setState] = useState<FixState>({ kind: "idle" });
  const [siteId, setSiteId] = useState(openPunch?.siteId ?? sites[0]?.id ?? "");
  const watchId = useRef<number | null>(null);

  const [inResult, inAction, inPending] = useActionState(checkIn, emptyPunchState);
  const [outResult, outAction, outPending] = useActionState(checkOut, emptyPunchState);

  const pending = inPending || outPending;
  const result = openPunch ? outResult : inResult;

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setState({ kind: "failed", reason: "This device cannot report its location." });
      return;
    }

    setState({ kind: "locating" });

    watchId.current = navigator.geolocation.watchPosition(
      (pos) =>
        setState({
          kind: "ready",
          fix: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            at: pos.timestamp,
          },
        }),
      (err) =>
        setState(
          err.code === err.PERMISSION_DENIED
            ? { kind: "denied" }
            : {
                kind: "failed",
                reason:
                  err.code === err.TIMEOUT
                    ? "Finding your position took too long. Step into the open and try again."
                    : "Your position is unavailable right now.",
              },
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  const site = sites.find((s) => s.id === siteId) ?? sites[0];
  const fix = state.kind === "ready" ? state.fix : null;

  const distance =
    fix && site ? Math.round(distanceM(fix.lat, fix.lng, site.lat, site.lng)) : null;

  const accurate = fix && site ? fix.accuracy <= site.max_accuracy_m : false;
  const inside = distance !== null && site ? distance <= site.geofence_radius_m : false;
  const canPunch = !!fix && accurate && (openPunch ? true : inside) && !pending;

  if (sites.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No sites are on the register yet, so there is nowhere to check in. Ask the
        operations desk to add your site.
      </p>
    );
  }

  const mapSite: MapSite[] = site
    ? [
        {
          id: site.id,
          name: site.name,
          client_name: null,
          district: null,
          lat: site.lat,
          lng: site.lng,
          geofence_radius_m: site.geofence_radius_m,
          ring: site.ring,
          onDuty: openPunch ? 1 : 0,
          assigned: 1,
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      {/* Where you are, against where you must be. Shown before any decision,
          so nobody is refused with no explanation of why. */}
      {state.kind === "locating" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LocateFixed className="size-4 animate-pulse text-primary" />
          Finding your position…
        </p>
      )}

      {state.kind === "denied" && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            Location permission is blocked. Allow it for this site in your browser
            settings — attendance cannot be recorded without it.
          </span>
        </div>
      )}

      {state.kind === "failed" && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.reason}</span>
        </div>
      )}

      {fix && site && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Reading
              icon={MapPin}
              label={`Distance to ${site.name}`}
              value={`${distance} m`}
              note={`boundary ${site.geofence_radius_m} m`}
              good={inside}
            />
            <Reading
              icon={Gauge}
              label="GPS accuracy"
              value={`±${Math.round(fix.accuracy)} m`}
              note={`needs ±${site.max_accuracy_m} m or better`}
              good={accurate}
            />
          </div>

          {/* The picture behind the two numbers. A guard told "you are 40 m
              away" and standing at what they believe is the gate has no way to
              act on that; a guard who can see which side of the ring they are
              on does. */}
          <SiteMap
            sites={mapSite}
            punches={[
              {
                lat: fix.lat,
                lng: fix.lng,
                accuracy: fix.accuracy,
                distance,
                inside,
                label: "You are here",
              },
            ]}
            focus={site.id}
            height={220}
          />

          {!accurate && (
            <p className="text-sm text-muted-foreground">
              The fix is still too wide to prove where you are. Step into the open,
              away from buildings, and wait a few seconds — it usually tightens.
            </p>
          )}

          {accurate && !inside && !openPunch && (
            <p className="text-sm text-muted-foreground">
              You are outside the boundary. Walk to the gate and the distance above
              will fall.
            </p>
          )}
        </>
      )}

      {result.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{result.error}</span>
        </div>
      )}

      {result.ok && result.message && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm text-primary"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>{result.message}</span>
        </div>
      )}

      <form action={openPunch ? outAction : inAction} className="space-y-4">
        <input type="hidden" name="lat" value={fix?.lat ?? ""} />
        <input type="hidden" name="lng" value={fix?.lng ?? ""} />
        <input type="hidden" name="accuracy" value={fix?.accuracy ?? ""} />
        {/* Recorded as evidence and never trusted: a device clock that
            disagrees with the server is itself worth keeping. */}
        <input
          type="hidden"
          name="device_time"
          value={fix ? new Date(fix.at).toISOString() : ""}
        />

        {!openPunch && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="site">Reporting to</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger id="site" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="site_id" value={siteId} />
          </div>
        )}

        {/* Full width and 48px tall: it is pressed with a thumb, outdoors,
            sometimes wearing gloves. */}
        <Button
          type="submit"
          size="lg"
          variant={openPunch ? "outline" : "default"}
          className="h-12 w-full text-base"
          disabled={!canPunch}
        >
          {openPunch ? (
            <LogOut data-icon="inline-start" />
          ) : (
            <LogIn data-icon="inline-start" />
          )}
          {pending
            ? openPunch
              ? "Checking out…"
              : "Checking in…"
            : openPunch
              ? `Check out of ${openPunch.siteName}`
              : "Check in"}
        </Button>

        {openPunch && (
          <p className="flex items-center justify-center gap-1.5 text-sm text-primary">
            <Radio className="size-3.5" strokeWidth={2.2} />
            On duty since {openPunch.since}.
          </p>
        )}
      </form>
    </div>
  );
}
