"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { checkIn, checkOut } from "@/app/console/duty/actions";
import { emptyPunchState } from "@/app/console/duty/punch-state";
import { Icon } from "@/components/Icon";

export type PunchSite = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  geofence_radius_m: number;
  max_accuracy_m: number;
};

type Fix = {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
};

type FixState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "ready"; fix: Fix }
  | { kind: "denied" }
  | { kind: "failed"; reason: string };

/** Haversine, same formula as `geo_distance_m` in the database. */
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
 * The one control a guard uses every day.
 *
 * The distance shown here is computed in the browser purely so the guard can
 * see whether walking closer will help before they press anything. It carries
 * no authority at all: the server recomputes it from the site's own record and
 * refuses the punch on its own answer. The two use the same formula so the
 * readout and the verdict agree.
 *
 * `watchPosition` rather than `getCurrentPosition`: a first GPS fix indoors is
 * often hundreds of metres wide and then tightens over several seconds.
 * Watching lets the accuracy improve while the guard walks to the gate,
 * instead of freezing the worst reading of the day.
 */
export function PunchControl({
  sites,
  openPunch,
}: {
  sites: PunchSite[];
  openPunch: { siteName: string; since: string } | null;
}) {
  const [state, setState] = useState<FixState>({ kind: "idle" });
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
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
      <div className="cpanel__body">
        <p className="chead__lede" style={{ margin: 0 }}>
          No sites are on the register yet, so there is nowhere to check in. Ask the operations
          desk to add your site.
        </p>
      </div>
    );
  }

  return (
    <div className="cpanel__body cpunch">
      {/* Live position readout. Shown before any decision so the guard can see
          what the system sees, rather than being refused with no explanation. */}
      <div className="cpunch__fix">
        {state.kind === "locating" && (
          <p className="cpunch__status">
            <span className="cdot cdot--pulse" /> Finding your position…
          </p>
        )}

        {state.kind === "denied" && (
          <p className="cerror" role="alert">
            <Icon name="close" />
            <span>
              Location permission is blocked. Allow it for this site in your browser settings —
              attendance cannot be recorded without it.
            </span>
          </p>
        )}

        {state.kind === "failed" && (
          <p className="cerror" role="alert">
            <Icon name="close" />
            <span>{state.reason}</span>
          </p>
        )}

        {fix && site && (
          <div className="cpunch__grid">
            <div className="cpunch__cell">
              <span className="cstat__l">Distance to {site.name}</span>
              <strong className={`cpunch__v${inside ? " is-ok" : " is-bad"}`}>
                {distance} m
              </strong>
              <span className="cpunch__note">boundary {site.geofence_radius_m} m</span>
            </div>
            <div className="cpunch__cell">
              <span className="cstat__l">GPS accuracy</span>
              <strong className={`cpunch__v${accurate ? " is-ok" : " is-bad"}`}>
                ±{Math.round(fix.accuracy)} m
              </strong>
              <span className="cpunch__note">needs ±{site.max_accuracy_m} m or better</span>
            </div>
          </div>
        )}

        {fix && site && !accurate && (
          <p className="cpunch__hint">
            The fix is still too wide to prove where you are. Step into the open, away from
            buildings, and wait a few seconds — it usually tightens.
          </p>
        )}

        {fix && site && accurate && !inside && !openPunch && (
          <p className="cpunch__hint">
            You are outside the boundary. Walk to the gate and the distance above will fall.
          </p>
        )}
      </div>

      {result.error && (
        <p className="cerror" role="alert">
          <Icon name="close" />
          <span>{result.error}</span>
        </p>
      )}

      {result.ok && result.message && (
        <p className="cokay" role="status">
          <Icon name="check" />
          <span>{result.message}</span>
        </p>
      )}

      <form action={openPunch ? outAction : inAction} className="cpunch__form">
        <input type="hidden" name="lat" value={fix?.lat ?? ""} />
        <input type="hidden" name="lng" value={fix?.lng ?? ""} />
        <input type="hidden" name="accuracy" value={fix?.accuracy ?? ""} />
        {/* Recorded as evidence and never trusted: a device clock that
            disagrees with the server is itself worth keeping. */}
        <input type="hidden" name="device_time" value={fix ? new Date(fix.at).toISOString() : ""} />

        {!openPunch && (
          <label className="cfield">
            <span className="cfield__l">Reporting to</span>
            <select
              className="cfield__i"
              name="site_id"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          className={`btn btn--lg ${openPunch ? "btn--ghost" : "btn--solid"}`}
          type="submit"
          disabled={!canPunch}
        >
          {pending
            ? openPunch
              ? "Checking out…"
              : "Checking in…"
            : openPunch
              ? `Check out of ${openPunch.siteName}`
              : "Check in"}
        </button>

        {openPunch && (
          <p className="cpunch__note">On duty since {openPunch.since}.</p>
        )}
      </form>
    </div>
  );
}
