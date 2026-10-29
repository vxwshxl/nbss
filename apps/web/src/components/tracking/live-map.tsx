"use client";

import { useEffect, useRef } from "react";

import { MapFrame, useGoogleMap } from "@/components/maps/use-google-map";
import { MAP_COLOR, circlePath, createHtmlMarker, esc, type HtmlMarker } from "@/lib/google-maps";
import { runsByFence } from "@/lib/tracking";

export type LiveSite = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  ring: [number, number][] | null;
  staffed: boolean;
};

export type LiveMarker = {
  id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  initials: string;
  label: string;
  sub?: string;
  color: string;
  live: boolean;
  /** Degrees from north: the compass with the app open, else the GPS course while moving. */
  heading?: number | null;
};

/**
 * The fleet on one map: every site's fence and every guard on duty, moving as
 * the fifteen-second batch arrives. Markers are moved in place rather than
 * redrawn, so a pan or an open info card survives every update; the view is
 * framed once, and again only when `frameKey` changes.
 */
export function LiveMap({
  sites,
  guards,
  selected,
  onSelect,
  trail,
  focus,
  frameKey,
  height = "100%",
  className,
}: {
  sites: LiveSite[];
  guards: LiveMarker[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** The selected guard's path since check-in. */
  trail?: { lat: number; lng: number; inside: boolean | null }[];
  /** Pan here when it changes (a guard picked from the list). */
  /** `offset` (pixels) moves the camera off the point, so it sits clear of a card drawn over the map. */
  focus?: { lat: number; lng: number; key: string; offset?: { x: number; y: number } } | null;
  frameKey?: string;
  height?: number | string;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const { maps, map, error } = useGoogleMap(host, { zoom: 12, gestureHandling: "greedy", fullscreenControl: false });
  const markers = useRef(new Map<string, HtmlMarker>());
  const accuracy = useRef(new Map<string, google.maps.Circle>());
  const framedFor = useRef<string | null>(null);
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  // Fences.
  useEffect(() => {
    if (!maps || !map) return;
    const drawn: (google.maps.Polygon | HtmlMarker)[] = [];
    for (const s of sites) {
      const colour = s.staffed ? MAP_COLOR.primary : MAP_COLOR.muted;
      drawn.push(
        new maps.Polygon({
          map,
          paths: s.ring?.length ? s.ring.map(([lng, lat]) => ({ lat, lng })) : circlePath(s, s.radiusM),
          strokeColor: colour,
          strokeWeight: 1.5,
          fillColor: colour,
          fillOpacity: 0.08,
          clickable: false,
          zIndex: 1,
        }),
      );
      const pin = createHtmlMarker(maps, {
        position: { lat: s.lat, lng: s.lng },
        anchor: "bottom",
        html: `<div class="gm-pin" style="--c:${colour};opacity:.9"><span>${esc(s.name)}</span><i></i></div>`,
        zIndex: 2,
      });
      pin.setMap(map);
      drawn.push(pin);
    }
    return () => drawn.forEach((d) => d.setMap(null));
  }, [maps, map, sites]);

  // Guards: created, moved and removed in place.
  useEffect(() => {
    if (!maps || !map) return;
    const seen = new Set<string>();
    for (const g of guards) {
      seen.add(g.id);
      const html =
        `<div class="gm-guard" style="--c:${g.color}" ${g.live ? "data-live" : ""} ${selected === g.id ? "data-selected" : selected ? "data-dim" : ""}>` +
        `<b>${g.heading != null ? `<i class="gm-dir" style="--r:${Math.round(g.heading)}deg"></i>` : ""}${esc(g.initials)}</b><span>${esc(g.label)}${g.sub ? ` <small>${esc(g.sub)}</small>` : ""}</span></div>`;
      const existing = markers.current.get(g.id);
      if (existing) {
        existing.setPosition({ lat: g.lat, lng: g.lng });
        existing.setHtml(html);
        existing.setZ(selected === g.id ? 50 : 10);
      } else {
        const m = createHtmlMarker(maps, {
          position: { lat: g.lat, lng: g.lng },
          html,
          zIndex: selected === g.id ? 50 : 10,
          title: g.label,
          onClick: () => select.current(g.id),
        });
        m.setMap(map);
        markers.current.set(g.id, m);
      }

      const circle = accuracy.current.get(g.id);
      if (g.accuracy && g.accuracy < 300) {
        if (circle) {
          circle.setCenter(g);
          circle.setRadius(g.accuracy);
          circle.setOptions({ fillColor: g.color, fillOpacity: selected && selected !== g.id ? 0.04 : 0.1 });
        } else {
          accuracy.current.set(
            g.id,
            new maps.Circle({ map, center: g, radius: g.accuracy, strokeOpacity: 0, fillColor: g.color, fillOpacity: selected && selected !== g.id ? 0.04 : 0.1, clickable: false, zIndex: 3 }),
          );
        }
      } else if (circle) {
        circle.setMap(null);
        accuracy.current.delete(g.id);
      }
    }
    for (const [id, m] of markers.current) {
      if (!seen.has(id)) {
        m.setMap(null);
        markers.current.delete(id);
        accuracy.current.get(id)?.setMap(null);
        accuracy.current.delete(id);
      }
    }
  }, [maps, map, guards, selected]);

  // Unmount: clear everything still on the map.
  useEffect(() => {
    const m = markers.current;
    const a = accuracy.current;
    return () => {
      m.forEach((x) => x.setMap(null));
      a.forEach((x) => x.setMap(null));
      m.clear();
      a.clear();
    };
  }, []);

  // The selected guard's path, coloured by whether each stretch was inside the fence.
  useEffect(() => {
    if (!maps || !map || !trail || trail.length < 2) return;
    // A white casing under the line lifts it off the other guards' dots and the roads.
    const lines = [
      new maps.Polyline({ map, path: trail, strokeColor: "#ffffff", strokeOpacity: 0.95, strokeWeight: 9, zIndex: 4, clickable: false }),
      ...runsByFence(trail).map(
        (r) =>
          new maps.Polyline({
            map,
            path: r.path,
            strokeColor: r.inside ? MAP_COLOR.route : MAP_COLOR.outside,
            strokeOpacity: 1,
            strokeWeight: 5,
            zIndex: 5,
            clickable: false,
          }),
      ),
    ];
    return () => lines.forEach((l) => l.setMap(null));
  }, [maps, map, trail]);

  // Framing: everything, once per frameKey.
  useEffect(() => {
    if (!maps || !map) return;
    const key = frameKey ?? "initial";
    if (framedFor.current === key) return;
    const bounds = new maps.LatLngBounds();
    for (const g of guards) bounds.extend(g);
    if (guards.length === 0) for (const s of sites) bounds.extend(s);
    if (bounds.isEmpty()) return;
    framedFor.current = key;
    map.fitBounds(bounds, 60);
    maps.event.addListenerOnce(map, "idle", () => {
      if ((map.getZoom() ?? 0) > 17) map.setZoom(17);
    });
  }, [maps, map, guards, sites, frameKey]);

  useEffect(() => {
    if (!map || !focus) return;
    if ((map.getZoom() ?? 0) < 16) map.setZoom(17);
    map.setCenter({ lat: focus.lat, lng: focus.lng });
    if (focus.offset) map.panBy(focus.offset.x, focus.offset.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focus?.key]);

  // Zoomed out over a whole district, two hundred name chips are a smear: below
  // street level the map shows dots only, and the names come back as you zoom in.
  useEffect(() => {
    if (!map) return;
    const set = () => host.current?.toggleAttribute("data-far", (map.getZoom() ?? 20) < 15);
    set();
    const l = map.addListener("zoom_changed", set);
    return () => l.remove();
  }, [map]);

  // A click on the map itself clears the selection.
  useEffect(() => {
    if (!map) return;
    const l = map.addListener("click", () => select.current(null));
    return () => l.remove();
  }, [map]);

  return <MapFrame hostRef={host} ready={!!map} error={error} height={height} className={className} />;
}
