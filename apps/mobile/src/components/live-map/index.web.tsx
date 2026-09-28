import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { MAP_COLOR, TILE_URL, fenceRing, frameBounds, type LiveMapProps } from "./shared";

export type { LiveMapProps, MapSite } from "./shared";
export { ATTRIBUTION } from "./shared";

/**
 * The same map for the browser preview, drawn with Leaflet — MapLibre's React
 * Native package has no web build.
 */

const CSS = `
.nbss-me{position:relative;width:64px;height:64px}
.nbss-me i{position:absolute;inset:0;border-radius:50%;background:${MAP_COLOR.me};animation:nbss-pulse 1.8s ease-out infinite}
.nbss-me b{position:absolute;left:22px;top:22px;width:20px;height:20px;border-radius:50%;background:${MAP_COLOR.me};border:3px solid #fff;box-sizing:border-box;box-shadow:0 1px 4px #0004}
@keyframes nbss-pulse{from{transform:scale(.4);opacity:.45}to{transform:scale(1);opacity:0}}
.nbss-pin{display:flex;flex-direction:column;align-items:center;font:600 12px/16px Geist_600SemiBold,system-ui,sans-serif}
.nbss-pin span{max-width:200px;padding:6px 12px;border-radius:999px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 6px #0003}
.nbss-pin s{width:3px;height:14px}
.nbss-pin u{width:12px;height:12px;border-radius:50%;border:3px solid;background:#fff;margin-top:-2px;box-sizing:border-box}
.nbss-map .leaflet-tile-pane{filter:saturate(.45) brightness(1.04)}
`;

function injectCss() {
  if (document.getElementById("nbss-map-css")) return;
  const style = document.createElement("style");
  style.id = "nbss-map-css";
  style.textContent = CSS;
  document.head.appendChild(style);
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function LiveMap({ me, site, inside, frameKey, padding }: LiveMapProps) {
  const host = useRef<View>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<L.LayerGroup | null>(null);
  const framed = useRef(false);

  useEffect(() => {
    injectCss();
    const el = host.current as unknown as HTMLElement | null;
    if (!el) return;
    const m = L.map(el, { zoomControl: false, attributionControl: false }).setView([26.14, 91.74], 15);
    el.classList.add("nbss-map");
    L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(m);
    layers.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Redrawn on every fix: a few shapes, cheap enough to rebuild.
  useEffect(() => {
    const group = layers.current;
    if (!group) return;
    group.clearLayers();
    const tone = inside ? MAP_COLOR.inside : MAP_COLOR.outside;
    if (site) {
      const ring = fenceRing(site).map(([lng, lat]) => [lat, lng] as [number, number]);
      L.polygon(ring, { color: tone, weight: 2.5, fillColor: tone, fillOpacity: 0.14, smoothFactor: 0 }).addTo(group);
      if (me && !inside) {
        L.polyline(
          [
            [me.lat, me.lng],
            [site.lat, site.lng],
          ],
          { color: MAP_COLOR.route, weight: 3, dashArray: "1 8", lineCap: "round" },
        ).addTo(group);
      }
      L.marker([site.lat, site.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="nbss-pin"><span style="background:${tone}">${escape(site.name)}</span><s style="background:${tone}"></s><u style="border-color:${tone}"></u></div>`,
          iconSize: [200, 50],
          iconAnchor: [100, 48],
        }),
        interactive: false,
      }).addTo(group);
    }
    if (me) {
      L.marker([me.lat, me.lng], {
        icon: L.divIcon({ className: "", html: `<div class="nbss-me"><i></i><b></b></div>`, iconSize: [64, 64], iconAnchor: [32, 32] }),
        interactive: false,
        zIndexOffset: 1000,
      }).addTo(group);
    }
  }, [me, site, inside]);

  const hasMe = me !== null;
  const bounds = frameBounds(me, site);
  const boundsRef = useRef(bounds);
  useEffect(() => {
    boundsRef.current = bounds;
  });
  useEffect(() => {
    const m = map.current;
    const b = boundsRef.current;
    if (!m || !b) return;
    m.fitBounds(
      [
        [b[1], b[0]],
        [b[3], b[2]],
      ],
      {
        paddingTopLeft: [padding.left, padding.top],
        paddingBottomRight: [padding.right, padding.bottom],
        maxZoom: 18,
        animate: framed.current,
      },
    );
    framed.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey, hasMe, site?.id, padding.bottom]);

  return <View ref={host} style={styles.fill} />;
}

const styles = StyleSheet.create({ fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#eef0ee" } });
