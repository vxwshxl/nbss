/// <reference types="google.maps" />
import { runsByFence } from "@nbss/shared/trail";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { GOOGLE_MAPS_KEY } from "@/lib/config";

import { MAP_COLOR, initialsOf } from "./live-map/shared";
import type { MapCanvasProps, MapPerson } from "./map-canvas";

export type { MapCanvasProps, MapFence, MapPerson } from "./map-canvas";

/**
 * The browser preview's map: the same picture as the phone's, drawn by the
 * Google Maps JavaScript API. Only used when the app runs on react-native-web.
 */

type G = typeof google.maps;
let loading: Promise<G> | null = null;
function load(): Promise<G> {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const w = window as unknown as { google?: typeof google; __nbssMaps?: () => void };
    if (w.google?.maps?.Map) return resolve(w.google.maps);
    w.__nbssMaps = () => resolve(w.google!.maps);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&v=weekly&callback=__nbssMaps&loading=async`;
    s.async = true;
    s.onerror = () => reject(new Error("Google Maps could not load"));
    document.head.appendChild(s);
  });
  return loading;
}

function dot(color: string, size: number) {
  return { path: 0 as google.maps.SymbolPath, scale: size, fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 };
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * A guard as the website draws them, as one SVG image: the circle in the state colour
 * with initials and a white ring, the heading pointer turned around it, a halo when
 * picked, and the name chip (dark when picked) hung underneath. The image is anchored
 * on the circle's centre, so the circle sits exactly on the point.
 */
function guardIcon(p: MapPerson): google.maps.Icon {
  const big = Boolean(p.big);
  const D = big ? 42 : 30;
  const halo = D + 18;
  const label = p.label ? `${p.label}${p.sub ? ` ${p.sub}` : ""}` : "";
  const fs = big ? 12 : 11;
  const chipW = label ? Math.ceil(label.length * fs * 0.6) + 16 : 0;
  const top = 14; // room for the pointer above the circle
  const W = Math.max(halo + 4, chipW + 4);
  const cx = W / 2;
  const cy = top + halo / 2;
  const chipY = cy + (big ? halo : D) / 2 + 3;
  const H = chipY + (label ? 20 : 0) + 2;
  const tri = p.heading != null
    ? `<g transform="rotate(${Math.round(p.heading)} ${cx} ${cy})"><path d="M ${cx - 7} ${cy - D / 2 - 1} L ${cx} ${cy - D / 2 - 11} L ${cx + 7} ${cy - D / 2 - 1} Z" fill="${p.tone}" stroke="#fff" stroke-width="1"/></g>`
    : "";
  const [subName, subRest] = p.sub ? [esc(p.label ?? ""), esc(` ${p.sub}`)] : [esc(label), ""];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-opacity="0.35"/></filter></defs>` +
    (big ? `<circle cx="${cx}" cy="${cy}" r="${halo / 2}" fill="${p.tone}" fill-opacity="0.28"/>` : "") +
    tri +
    `<circle cx="${cx}" cy="${cy}" r="${D / 2}" fill="${p.tone}" stroke="#fff" stroke-width="${big ? 3 : 2.5}" filter="url(#s)"/>` +
    `<text x="${cx}" y="${cy + (big ? 5 : 4)}" text-anchor="middle" font-family="Geist, Inter, system-ui, sans-serif" font-weight="700" font-size="${big ? 14 : 11}" fill="#fff">${esc(p.initials ?? initialsOf(p.label))}</text>` +
    (label
      ? `<rect x="${cx - chipW / 2}" y="${chipY}" width="${chipW}" height="19" rx="6" fill="${big ? "#0f172a" : "#fff"}" fill-opacity="${big ? 1 : 0.96}" filter="url(#s)"/>` +
        `<text x="${cx}" y="${chipY + 13.5}" text-anchor="middle" font-family="Geist, Inter, system-ui, sans-serif" font-weight="600" font-size="${fs}" fill="${big ? "#fff" : "#111"}">${subName}<tspan font-weight="500" fill="${big ? "#cbd5e1" : "#555"}">${subRest}</tspan></text>`
      : "") +
    `</svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    size: new google.maps.Size(W, H),
    anchor: new google.maps.Point(cx, cy),
  };
}

export function MapCanvas({ fences = [], people = [], me = null, route = null, trail = null, path = null, frameKey = "", padding, onPersonPress, onFencePress }: MapCanvasProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const [ctx, setCtx] = useState<{ g: G; map: google.maps.Map } | null>(null);
  const framed = useRef<string | null>(null);
  // Zoomed out, the name chips would pile up: as on the phone, only the picked one stays.
  const [far, setFar] = useState(false);

  useEffect(() => {
    let gone = false;
    void load().then((g) => {
      if (gone || !host.current) return;
      const map = new g.Map(host.current, { center: { lat: 26.4015, lng: 90.2717 }, zoom: 14, disableDefaultUI: true, zoomControl: true, clickableIcons: false });
      map.addListener("zoom_changed", () => setFar((map.getZoom() ?? 20) < 14));
      setCtx({ g, map });
    });
    return () => {
      gone = true;
    };
  }, []);

  useEffect(() => {
    if (!ctx) return;
    const { g, map } = ctx;
    const drawn: { setMap: (m: google.maps.Map | null) => void }[] = [];
    const bounds = new g.LatLngBounds();
    for (const f of fences) {
      const path = f.ring.map(([lng, lat]) => ({ lat, lng }));
      if (f.frame !== false) path.forEach((p) => bounds.extend(p));
      const poly = new g.Polygon({ map, paths: path, strokeColor: f.tone, strokeWeight: f.quiet ? 1.5 : 2.5, fillColor: f.tone, fillOpacity: f.fill ?? (f.quiet ? 0.08 : 0.14), clickable: Boolean(onFencePress) });
      if (onFencePress) poly.addListener("click", () => onFencePress(f.id));
      drawn.push(poly);
    }
    if (trail && trail.length > 1) drawn.push(new g.Polyline({ map, path: trail, strokeColor: MAP_COLOR.me, strokeOpacity: 0.75, strokeWeight: 4 }));
    // A shift's route, as on the phone: blue inside the fence, orange outside, the part
    // after a picked moment faint.
    if (path && path.points.length > 1) {
      const cut = path.upTo == null ? path.points.length - 1 : Math.max(0, Math.min(path.upTo, path.points.length - 1));
      for (const r of runsByFence(path.points.slice(0, cut + 1)))
        drawn.push(new g.Polyline({ map, path: r.path, strokeColor: r.inside ? MAP_COLOR.me : MAP_COLOR.outside, strokeWeight: 4 }));
      if (cut < path.points.length - 1)
        for (const r of runsByFence(path.points.slice(cut)))
          drawn.push(new g.Polyline({ map, path: r.path, strokeColor: r.inside ? MAP_COLOR.me : MAP_COLOR.outside, strokeOpacity: 0.45, strokeWeight: 3 }));
      for (const p of path.points) bounds.extend(p);
    }
    if (route) drawn.push(new g.Polyline({ map, path: route, strokeOpacity: 0, icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: MAP_COLOR.route, scale: 3 }, offset: "0", repeat: "12px" }] }));
    for (const p of people) {
      if (p.frame !== false) bounds.extend(p);
      const m = new g.Marker({ map, position: p, icon: guardIcon(far && !p.big ? { ...p, label: undefined, sub: undefined } : p), zIndex: p.big ? 900 : 100 });
      if (onPersonPress) m.addListener("click", () => onPersonPress(p.id));
      drawn.push(m);
    }
    if (me) {
      if (me.frame !== false) bounds.extend(me);
      if (me.accuracyM && me.accuracyM < 500) drawn.push(new g.Circle({ map, center: me, radius: me.accuracyM, strokeOpacity: 0, fillColor: MAP_COLOR.me, fillOpacity: 0.1 }));
      if (me.heading != null) {
        drawn.push(
          new g.Marker({
            map,
            position: me,
            clickable: false,
            zIndex: 999,
            icon: { path: "M 0 0 L -9 -24 A 26 26 0 0 1 9 -24 Z", rotation: me.heading, fillColor: MAP_COLOR.me, fillOpacity: 0.3, strokeOpacity: 0, scale: 1.4 },
          }),
        );
      }
      drawn.push(new g.Marker({ map, position: me, icon: dot(MAP_COLOR.me, 9), zIndex: 1000 }));
    }
    const key = `${frameKey}|${me ? 1 : 0}`;
    if (framed.current !== key && !bounds.isEmpty()) {
      framed.current = key;
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      // One point (my location, a single guard): centred at street level, not the deepest zoom.
      if (ne.equals(sw)) {
        map.setCenter(ne);
        map.setZoom(17);
      } else map.fitBounds(bounds, padding ?? 40);
      g.event.addListenerOnce(map, "idle", () => {
        if ((map.getZoom() ?? 0) > 18) map.setZoom(18);
      });
    }
    return () => drawn.forEach((d) => d.setMap(null));
  }, [ctx, fences, people, me, route, trail, path, frameKey, padding, onPersonPress, onFencePress, far]);

  return (
    <View style={styles.fill}>
      <div ref={host} style={{ width: "100%", height: "100%" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#eef0ee", overflow: "hidden" },
});
