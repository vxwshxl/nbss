"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

import "leaflet/dist/leaflet.css";

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

const KOKRAJHAR: [number, number] = [26.4015, 90.2717];

/**
 * The deployment map.
 *
 * Read-only, and deliberately not the same component as the fence editor in
 * `SiteForm`: an editor's job is to let you move a boundary, and every one of
 * its click handlers is a way to move one by accident. This draws.
 *
 * Two things are on it at once, because they are the two halves of the same
 * question. The fences say where a guard is allowed to punch from; the dots say
 * where one actually did. A dot outside its own fence is the single most useful
 * thing this product can show a supervisor, so it is drawn in the destructive
 * colour and nothing else on the map competes with it.
 *
 * Leaflet is imported dynamically rather than at module scope: it reaches for
 * `window` as it initialises, which throws during server rendering.
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
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const [ready, setReady] = useState(false);

  // The data the draw effect reads. Held in a ref as well as a dep so the map
  // itself is only ever created once — recreating it on every data change
  // would reset the reader's pan and zoom on every refresh.
  //
  // Synced in an effect rather than assigned during render: a render can be discarded
  // and re-run, so a write during one is not guaranteed to have happened exactly once,
  // which is what `react-hooks/refs` objects to. `useRef` already holds the first value
  // and this effect commits before the draw effect below can read it.
  const data = useRef({ sites, punches, focus });
  useEffect(() => {
    data.current = { sites, punches, focus };
  }, [sites, punches, focus]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !host.current || map.current) return;

      const instance = L.map(host.current, {
        center: KOKRAJHAR,
        zoom: 11,
        zoomControl: false,
        scrollWheelZoom: false, // a map that eats the page scroll is a trap
      });

      // Tiles come from this site's own origin (`/api/tiles`), so the strict
      // Content-Security-Policy needs no exception for a third-party map CDN.
      L.tileLayer("/api/tiles/{z}/{x}/{y}", {
        maxZoom: 19,
        minZoom: 3,
        attribution: "© OpenStreetMap contributors",
      }).addTo(instance);

      L.control.zoom({ position: "topright" }).addTo(instance);
      // Restores the wheel once the reader has clicked into the map, which is
      // an unambiguous "I meant to interact with this".
      instance.on("click", () => instance.scrollWheelZoom.enable());
      instance.on("mouseout", () => instance.scrollWheelZoom.disable());

      layer.current = L.layerGroup().addTo(instance);
      map.current = instance;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      const instance = map.current;
      const group = layer.current;
      if (cancelled || !instance || !group) return;

      group.clearLayers();

      const bounds = L.latLngBounds([]);

      for (const s of data.current.sites) {
        // A staffed site is the brand green, an empty one is muted. Reading the
        // token rather than hard-coding a hex is what keeps the map in step
        // with the theme instead of being the one element that ignores it.
        const style = s.onDuty > 0 ? "--color-primary" : "--color-muted-foreground";
        const colour = getComputedStyle(document.documentElement)
          .getPropertyValue(style)
          .trim();

        const shape = s.ring?.length
          ? L.polygon(
              s.ring.map(([lng, lat]) => [lat, lng] as [number, number]),
              { color: colour, weight: 2, fillOpacity: 0.1 },
            )
          : L.circle([s.lat, s.lng], {
              radius: s.geofence_radius_m,
              color: colour,
              weight: 2,
              fillOpacity: 0.1,
            });

        shape.addTo(group);
        bounds.extend(shape.getBounds());

        L.marker([s.lat, s.lng], {
          icon: L.divIcon({
            className: "punch-dot",
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          }),
        })
          .bindPopup(
            // Escaped by hand: these are names typed by an operator into the
            // site form, and Leaflet's popup takes raw HTML.
            `<strong>${esc(s.name)}</strong>` +
              (s.client_name ? `<br>${esc(s.client_name)}` : "") +
              (s.district ? `<br><em>${esc(s.district)}</em>` : "") +
              `<br>${s.onDuty} on duty · ${s.assigned} assigned`,
          )
          .addTo(group);
      }

      for (const p of data.current.punches) {
        if (p.accuracy) {
          L.circle([p.lat, p.lng], {
            radius: p.accuracy,
            color: "transparent",
            fillColor: p.inside ? "#19A96E" : "#e5484d",
            fillOpacity: 0.12,
          }).addTo(group);
        }

        const dot = L.divIcon({
          className: "punch-dot",
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const marker = L.marker([p.lat, p.lng], { icon: dot }).addTo(group);
        // The dot's own element carries the outside flag, so the CSS decides
        // the colour and there is one place that knows what "outside" looks
        // like rather than two.
        if (!p.inside) marker.getElement()?.setAttribute("data-outside", "");
        marker.bindPopup(
          `<strong>${esc(p.label)}</strong>` +
            (p.distance !== null
              ? `<br>${Math.round(p.distance)} m from the centre`
              : "") +
            (p.accuracy ? `<br>GPS ±${Math.round(p.accuracy)} m` : ""),
        );
        bounds.extend([p.lat, p.lng]);
      }

      const focused = data.current.focus
        ? data.current.sites.find((s) => s.id === data.current.focus)
        : undefined;

      if (focused) {
        instance.setView([focused.lat, focused.lng], 17);
      } else if (bounds.isValid()) {
        instance.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, sites, punches, focus]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-app-line-soft bg-muted",
        className,
      )}
      style={{ height }}
    >
      <div ref={host} className="size-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading the map…
        </div>
      )}
    </div>
  );
}

function esc(v: string): string {
  return v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
