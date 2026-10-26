"use client";

import { useEffect, useRef } from "react";

import { MapFrame, useGoogleMap } from "@/components/maps/use-google-map";
import { MAP_COLOR, circlePath, createHtmlMarker, type HtmlMarker } from "@/lib/google-maps";
import type { TrailPoint, TrailStats } from "@/lib/tracking";

export type TrailSite = { lat: number; lng: number; radiusM: number; ring: [number, number][] | null; name: string };

/**
 * One shift's path on the map. The line is the raw GPS trail — not snapped to
 * roads, because guards walk through compounds, lanes and fields — coloured
 * blue inside the fence and orange outside it. S and E mark check-in and
 * check-out, numbered dots mark stops, and the blue head is the playback
 * position.
 */
export function TrailMap({
  points,
  stats,
  site,
  head,
  clock,
  playing = false,
  pan,
  height = "100%",
  className,
}: {
  points: TrailPoint[];
  stats: TrailStats | null;
  site: TrailSite | null;
  /** Index into `points` the playback is at; the line beyond it is faded. */
  head: number;
  /**
   * The playback time (ms, shift clock), written every frame by the player. While
   * `playing`, the head glides between points by it instead of jumping point to point.
   */
  clock?: React.RefObject<number | null>;
  playing?: boolean;
  /** Changes when the reader picks a moment from the timeline. */
  pan?: { lat: number; lng: number; key: string } | null;
  height?: number | string;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const { maps, map, error } = useGoogleMap(host, { zoom: 16, gestureHandling: "greedy" });
  const headMarker = useRef<HtmlMarker | null>(null);
  const done = useRef<google.maps.Polyline | null>(null);
  // The last stretch, from the last point passed to the head where it is right now.
  const tail = useRef<google.maps.Polyline | null>(null);

  // The fence.
  useEffect(() => {
    if (!maps || !map || !site) return;
    const fence = new maps.Polygon({
      map,
      paths: site.ring?.length ? site.ring.map(([lng, lat]) => ({ lat, lng })) : circlePath(site, site.radiusM),
      strokeColor: MAP_COLOR.primary,
      strokeWeight: 2,
      fillColor: MAP_COLOR.primary,
      fillOpacity: 0.08,
      clickable: false,
    });
    return () => fence.setMap(null);
  }, [maps, map, site]);

  // The whole path, faded; start, end and stops; framed to fit.
  useEffect(() => {
    if (!maps || !map || points.length === 0) return;
    const drawn: { setMap: (m: google.maps.Map | null) => void }[] = [];

    let run: google.maps.LatLngLiteral[] = [points[0]!];
    let inside = points[0]!.inside !== false;
    const flush = () => {
      if (run.length < 2) return;
      drawn.push(
        new maps.Polyline({
          map,
          path: run,
          strokeColor: inside ? MAP_COLOR.route : MAP_COLOR.outside,
          strokeOpacity: 0.35,
          strokeWeight: 5,
          clickable: false,
          zIndex: 2,
          icons: [{ icon: { path: maps.SymbolPath.FORWARD_OPEN_ARROW, scale: 2, strokeOpacity: 0.6 }, offset: "50%", repeat: "120px" }],
        }),
      );
    };
    for (let i = 1; i < points.length; i++) {
      const p = points[i]!;
      run.push(p);
      if ((p.inside !== false) !== inside) {
        flush();
        run = [p];
        inside = p.inside !== false;
      }
    }
    flush();

    const first = points[0]!;
    const last = points.at(-1)!;
    const start = createHtmlMarker(maps, { position: first, html: `<span class="gm-flag" style="--c:${MAP_COLOR.inside}">S</span>`, zIndex: 20, title: "Checked in" });
    start.setMap(map);
    drawn.push(start);
    if (points.length > 1) {
      const end = createHtmlMarker(maps, {
        position: last,
        html: `<span class="gm-flag" style="--c:#111827">${last.reason === "check_out" ? "E" : "•"}</span>`,
        zIndex: 20,
        title: last.reason === "check_out" ? "Checked out" : "Latest",
      });
      end.setMap(map);
      drawn.push(end);
    }
    (stats?.stops ?? []).forEach((s, i) => {
      const m = createHtmlMarker(maps, {
        position: s,
        html: `<span class="gm-flag" style="--c:${s.inside === false ? MAP_COLOR.outside : "#475569"};width:20px;height:20px;font-size:10px">${i + 1}</span>`,
        zIndex: 15,
        title: `Stop ${i + 1}`,
      });
      m.setMap(map);
      drawn.push(m);
    });

    const bounds = new maps.LatLngBounds();
    for (const p of points) bounds.extend(p);
    map.fitBounds(bounds, 60);
    maps.event.addListenerOnce(map, "idle", () => {
      if ((map.getZoom() ?? 0) > 18) map.setZoom(18);
    });

    return () => drawn.forEach((d) => d.setMap(null));
  }, [maps, map, points, stats]);

  // The part already played, solid, and the head.
  useEffect(() => {
    if (!maps || !map || points.length === 0) return;
    const at = points[Math.min(head, points.length - 1)]!;
    // Which way they were walking: from the point before this one (or to the next).
    const from = points[Math.max(0, head - 1)]!;
    const to = head > 0 ? at : (points[1] ?? at);
    const a = head > 0 ? from : at;
    const bearing = (Math.atan2(
      Math.sin(((to.lng - a.lng) * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180),
      Math.cos((a.lat * Math.PI) / 180) * Math.sin((to.lat * Math.PI) / 180) -
        Math.sin((a.lat * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180) * Math.cos(((to.lng - a.lng) * Math.PI) / 180),
    ) * 180) / Math.PI;
    const moved = a !== to && (a.lat !== to.lat || a.lng !== to.lng);
    const headHtml = headIcon(moved ? bearing : null);
    if (!done.current) {
      done.current = new maps.Polyline({ map, strokeColor: MAP_COLOR.route, strokeOpacity: 0.95, strokeWeight: 4, zIndex: 3, clickable: false });
    }
    done.current.setPath(points.slice(0, head + 1));
    if (!headMarker.current) {
      headMarker.current = createHtmlMarker(maps, { position: at, html: headHtml, zIndex: 30 });
      headMarker.current.setMap(map);
    } else {
      headMarker.current.setPosition(at);
      headMarker.current.setHtml(headHtml);
    }
    if (!tail.current) {
      tail.current = new maps.Polyline({ map, strokeColor: MAP_COLOR.route, strokeOpacity: 0.95, strokeWeight: 4, zIndex: 3, clickable: false });
    }
    tail.current.setPath([]);
  }, [maps, map, points, head]);

  /**
   * Playing: every frame the head is placed where the guard was at that instant, between
   * the two points either side of it, and the solid line follows it. The map is moved
   * directly, not through React state, so sixty frames a second cost nothing but the
   * marker's own move; the page only re-renders when a point is passed.
   */
  useEffect(() => {
    if (!playing || !clock || points.length < 2) return;
    let raf = 0;
    let seg = -1;
    const frame = () => {
      const t = clock.current;
      if (t != null && headMarker.current) {
        let i = Math.max(0, Math.min(head, points.length - 2));
        while (i < points.length - 2 && points[i + 1]!.at <= t) i++;
        const a = points[i]!;
        const b = points[i + 1]!;
        const f = b.at > a.at ? Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at))) : 1;
        const pos = { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
        headMarker.current.setPosition(pos);
        tail.current?.setPath([a, pos]);
        if (i !== seg) {
          seg = i;
          const moved = a.lat !== b.lat || a.lng !== b.lng;
          headMarker.current.setHtml(headIcon(moved ? bearingDeg(a, b) : null));
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, clock, points, head]);

  useEffect(
    () => () => {
      done.current?.setMap(null);
      tail.current?.setMap(null);
      headMarker.current?.setMap(null);
      done.current = null;
      tail.current = null;
      headMarker.current = null;
    },
    [points],
  );

  useEffect(() => {
    if (!map || !pan) return;
    map.panTo(pan);
    if ((map.getZoom() ?? 0) < 17) map.setZoom(18);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pan?.key]);

  return <MapFrame hostRef={host} ready={!!map} error={error} height={height} className={className} />;
}

/** The playback head, with its direction arrow when the guard is moving. */
function headIcon(bearing: number | null): string {
  return `<span class="gm-head">${bearing != null ? `<i class="gm-dir" style="--r:${Math.round((bearing + 360) % 360)}deg;--c:#2563eb"></i>` : ""}</span>`;
}

/** Compass bearing from a to b, in degrees. */
function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  return (
    (Math.atan2(
      Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r),
      Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r),
    ) *
      180) /
    Math.PI
  );
}
