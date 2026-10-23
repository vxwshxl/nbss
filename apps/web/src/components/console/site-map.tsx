"use client";

import { useEffect, useRef } from "react";

import { MapFrame, useGoogleMap } from "@/components/maps/use-google-map";
import { MAP_COLOR, circlePath, createHtmlMarker, esc, type HtmlMarker } from "@/lib/google-maps";

/** A site, with whatever fence it was given and who is standing in it. */
export type MapSite = {
  id: string;
  name: string;
  client_name: string | null;
  district: string | null;
  lat: number;
  lng: number;
  geofence_radius_m: number;
  /** A `[lng, lat][]` ring, when the site is an outline rather than a circle. */
  ring: [number, number][] | null;
  /** Guards currently checked in here. Drives the marker's colour. */
  onDuty: number;
  /** Guards assigned to this site at all, on duty or not. */
  assigned: number;
};

/** One recorded punch, drawn against its site's fence. */
export type MapPunch = {
  lat: number;
  lng: number;
  /** GPS accuracy in metres — drawn as the circle the fix could be anywhere in. */
  accuracy: number | null;
  /** Metres from the site centre, as the database computed it at punch time. */
  distance: number | null;
  inside: boolean;
  label: string;
};

/**
 * The deployment map, on Google Maps.
 *
 * Read-only, and deliberately not the same component as the fence editor: an
 * editor's job is to let you move a boundary, and every one of its click
 * handlers is a way to move one by accident. This draws.
 *
 * Fences say where a guard may punch from; dots say where one actually did. A
 * dot outside its own fence is the most useful thing this map can show, so it
 * is drawn in red and nothing else competes with it.
 */
export function SiteMap({
  sites,
  punches = [],
  /** Zoom to this site on first paint instead of fitting them all. */
  focus,
  className,
  height = 420,
}: {
  sites: MapSite[];
  punches?: MapPunch[];
  focus?: string;
  className?: string;
  height?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const { maps, map, error } = useGoogleMap(host, { zoom: 11 });
  const framed = useRef(false);

  useEffect(() => {
    if (!maps || !map) return;
    const drawn: { setMap: (m: google.maps.Map | null) => void }[] = [];
    const markers: HtmlMarker[] = [];
    const info = new maps.InfoWindow();
    const bounds = new maps.LatLngBounds();

    for (const s of sites) {
      const colour = s.onDuty > 0 ? MAP_COLOR.primary : MAP_COLOR.muted;
      const path = s.ring?.length ? s.ring.map(([lng, lat]) => ({ lat, lng })) : circlePath(s, s.geofence_radius_m);
      const shape = new maps.Polygon({
        map,
        paths: path,
        strokeColor: colour,
        strokeWeight: 2,
        fillColor: colour,
        fillOpacity: 0.12,
        clickable: false,
      });
      drawn.push(shape);
      for (const p of path) bounds.extend(p);

      const marker = createHtmlMarker(maps, {
        position: { lat: s.lat, lng: s.lng },
        anchor: "bottom",
        html: `<div class="gm-pin" style="--c:${colour}"><span>${esc(s.name)}</span><i></i></div>`,
        onClick: () => {
          info.setContent(
            `<div class="gm-info"><strong>${esc(s.name)}</strong>` +
              (s.client_name ? `<br>${esc(s.client_name)}` : "") +
              (s.district ? `<br><em>${esc(s.district)}</em>` : "") +
              `<br>${s.onDuty} on duty · ${s.assigned} assigned</div>`,
          );
          info.setPosition({ lat: s.lat, lng: s.lng });
          info.open({ map });
        },
      });
      marker.setMap(map);
      markers.push(marker);
    }

    for (const p of punches) {
      const colour = p.inside ? MAP_COLOR.inside : MAP_COLOR.sos;
      if (p.accuracy) {
        drawn.push(
          new maps.Circle({
            map,
            center: p,
            radius: p.accuracy,
            strokeOpacity: 0,
            fillColor: colour,
            fillOpacity: 0.14,
            clickable: false,
          }),
        );
      }
      const dot = createHtmlMarker(maps, {
        position: { lat: p.lat, lng: p.lng },
        html: `<span class="gm-dot" style="--c:${colour}"></span>`,
        zIndex: 5,
        onClick: () => {
          info.setContent(
            `<div class="gm-info"><strong>${esc(p.label)}</strong>` +
              (p.distance !== null ? `<br>${Math.round(p.distance)} m from the centre` : "") +
              (p.accuracy ? `<br>GPS ±${Math.round(p.accuracy)} m` : "") +
              `</div>`,
          );
          info.setPosition(p);
          info.open({ map });
        },
      });
      dot.setMap(map);
      markers.push(dot);
      bounds.extend(p);
    }

    // Framed once: a live refresh must not yank the view away from where the
    // reader has panned to.
    if (!framed.current) {
      const focused = focus ? sites.find((s) => s.id === focus) : undefined;
      if (focused && punches.length === 0) {
        map.setCenter({ lat: focused.lat, lng: focused.lng });
        map.setZoom(17);
      } else if (!bounds.isEmpty()) {
        map.fitBounds(bounds, 40);
        maps.event.addListenerOnce(map, "idle", () => {
          if ((map.getZoom() ?? 0) > 17) map.setZoom(17);
        });
      }
      framed.current = sites.length > 0 || punches.length > 0;
    }

    return () => {
      info.close();
      for (const d of drawn) d.setMap(null);
      for (const m of markers) m.setMap(null);
    };
  }, [maps, map, sites, punches, focus]);

  return <MapFrame hostRef={host} ready={!!map} error={error} height={height} className={className} />;
}
