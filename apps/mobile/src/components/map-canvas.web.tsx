/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { GOOGLE_MAPS_KEY } from "@/lib/config";

import { MAP_COLOR } from "./live-map/shared";
import type { MapCanvasProps } from "./map-canvas";

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

export function MapCanvas({ fences = [], people = [], me = null, route = null, trail = null, frameKey = "", padding, onPersonPress, onFencePress }: MapCanvasProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const [ctx, setCtx] = useState<{ g: G; map: google.maps.Map } | null>(null);
  const framed = useRef<string | null>(null);

  useEffect(() => {
    let gone = false;
    void load().then((g) => {
      if (gone || !host.current) return;
      setCtx({ g, map: new g.Map(host.current, { center: { lat: 26.4015, lng: 90.2717 }, zoom: 14, disableDefaultUI: true, zoomControl: true, clickableIcons: false }) });
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
    if (route) drawn.push(new g.Polyline({ map, path: route, strokeOpacity: 0, icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: MAP_COLOR.route, scale: 3 }, offset: "0", repeat: "12px" }] }));
    for (const p of people) {
      if (p.frame !== false) bounds.extend(p);
      const m = new g.Marker({ map, position: p, icon: dot(p.tone, p.big ? 12 : 8), zIndex: p.big ? 900 : 100, label: p.label ? { text: p.label, fontSize: "11px", fontWeight: "600", className: "nbss-map-label" } : undefined });
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
  }, [ctx, fences, people, me, route, trail, frameKey, padding, onPersonPress, onFencePress]);

  return (
    <View style={styles.fill}>
      <div ref={host} style={{ width: "100%", height: "100%" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#eef0ee", overflow: "hidden" },
});
