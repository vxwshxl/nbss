"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, Circle, Polygon } from "leaflet";
import { LocateFixed } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Drawing a site's boundary.
 *
 * Two shapes, because sites come in two kinds. A gate or an ATM is a point
 * with a radius around it. A campus, a factory or a hospital compound is an
 * outline, and forcing a circle onto one either leaves half the grounds
 * outside the fence or swallows the road beside it.
 *
 * Tiles come from `/api/tiles`, this site's own origin, so the strict
 * Content-Security-Policy needs no exception for a map CDN.
 *
 * Leaflet is loaded dynamically rather than imported at module scope: it
 * reaches for `window` as it initialises, which fails during server rendering.
 */

export type Fence =
  | { mode: "radius"; lat: number; lng: number; radius: number }
  | { mode: "polygon"; lat: number; lng: number; ring: [number, number][] };

const KOKRAJHAR: [number, number] = [26.4015, 90.2717];

/** Metric area of a lat/lng ring, via the shoelace formula on a local projection. */
function ringAreaM2(ring: [number, number][]): number {
  if (ring.length < 3) return 0;

  const latRef = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((latRef * Math.PI) / 180);

  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    total += x1 * mPerDegLng * (y2 * mPerDegLat) - x2 * mPerDegLng * (y1 * mPerDegLat);
  }
  return Math.abs(total / 2);
}

function centroid(ring: [number, number][]): [number, number] {
  const lng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return [lng, lat];
}

export function FenceMap({
  value,
  onChange,
}: {
  value: Fence;
  onChange: (fence: Fence) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const centre = useRef<Marker | null>(null);
  const circle = useRef<Circle | null>(null);
  const shape = useRef<Polygon | null>(null);
  const points = useRef<Marker[]>([]);
  const latest = useRef(value);
  const [ready, setReady] = useState(false);

  /**
   * The newest `value`, reachable from Leaflet's own event handlers.
   *
   * Those handlers are registered once when the map is created and then live outside
   * React entirely, so they cannot close over a `value` that changes — hence the ref.
   *
   * Synced in an effect rather than assigned during render. A render can be discarded and
   * re-run, so a write during one is not guaranteed to have happened exactly once, which
   * is why `react-hooks/refs` rejects it. `useRef(value)` already holds the first value,
   * and this effect runs before any user interaction can reach a handler.
   */
  useEffect(() => {
    latest.current = value;
  }, [value]);

  // ------------------------------------------------------------- create map
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !host.current || map.current) return;

      const instance = L.map(host.current, {
        center: [value.lat || KOKRAJHAR[0], value.lng || KOKRAJHAR[1]],
        zoom: value.lat ? 17 : 14,
        // The default zoom control sits top-left, over the mode switch.
        zoomControl: false,
        attributionControl: true,
      });

      L.tileLayer("/api/tiles/{z}/{x}/{y}", {
        maxZoom: 19,
        minZoom: 3,
        attribution: "© OpenStreetMap contributors",
      }).addTo(instance);

      L.control.zoom({ position: "topright" }).addTo(instance);

      instance.on("click", (e) => {
        const current = latest.current;
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        if (current.mode === "radius") {
          onChange({ ...current, lat, lng });
        } else {
          const ring: [number, number][] = [...current.ring, [lng, lat]];
          const [cLng, cLat] = centroid(ring);
          onChange({ mode: "polygon", ring, lat: cLat, lng: cLng });
        }
      });

      map.current = instance;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // Created once. Redrawing is handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------- redraw
  useEffect(() => {
    if (!ready || !map.current) return;

    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !map.current) return;
      const m = map.current;

      // Clear whatever the previous state drew.
      for (const marker of points.current) marker.remove();
      points.current = [];
      centre.current?.remove();
      centre.current = null;
      circle.current?.remove();
      circle.current = null;
      shape.current?.remove();
      shape.current = null;

      const pin = L.divIcon({
        className: "fence-pin",
        html: '<span></span>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      if (value.mode === "radius") {
        if (!value.lat && !value.lng) return;

        circle.current = L.circle([value.lat, value.lng], {
          radius: value.radius,
          color: "#19A96E",
          weight: 2,
          fillColor: "#19A96E",
          fillOpacity: 0.12,
        }).addTo(m);

        centre.current = L.marker([value.lat, value.lng], { icon: pin, draggable: true })
          .addTo(m)
          .on("drag", (e) => {
            const p = (e.target as Marker).getLatLng();
            circle.current?.setLatLng(p);
          })
          .on("dragend", (e) => {
            const p = (e.target as Marker).getLatLng();
            onChange({ mode: "radius", lat: p.lat, lng: p.lng, radius: latest.current.mode === "radius" ? latest.current.radius : 150 });
          });

        return;
      }

      if (value.ring.length === 0) return;

      // Each vertex is draggable, which is what "adjusted manually via points"
      // has to mean — dropping a corner in roughly the right place and then
      // nudging it onto the wall.
      value.ring.forEach(([lng, lat], index) => {
        const marker = L.marker([lat, lng], { icon: pin, draggable: true })
          .addTo(m)
          .on("drag", (e) => {
            const p = (e.target as Marker).getLatLng();
            const ring = latest.current.mode === "polygon" ? [...latest.current.ring] : [];
            ring[index] = [p.lng, p.lat];
            shape.current?.setLatLngs(ring.map(([x, y]) => [y, x] as [number, number]));
          })
          .on("dragend", (e) => {
            const p = (e.target as Marker).getLatLng();
            if (latest.current.mode !== "polygon") return;
            const ring = [...latest.current.ring];
            ring[index] = [p.lng, p.lat];
            const [cLng, cLat] = centroid(ring);
            onChange({ mode: "polygon", ring, lat: cLat, lng: cLng });
          })
          // Right-click removes a point, the usual gesture for this.
          .on("contextmenu", () => {
            if (latest.current.mode !== "polygon") return;
            const ring = latest.current.ring.filter((_, i) => i !== index);
            const [cLng, cLat] = ring.length ? centroid(ring) : [0, 0];
            onChange({ mode: "polygon", ring, lat: cLat, lng: cLng });
          });

        points.current.push(marker);
      });

      if (value.ring.length >= 2) {
        shape.current = L.polygon(
          value.ring.map(([lng, lat]) => [lat, lng] as [number, number]),
          { color: "#19A96E", weight: 2, fillColor: "#19A96E", fillOpacity: 0.12 },
        ).addTo(m);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [value, ready, onChange]);

  const area = value.mode === "polygon" ? ringAreaM2(value.ring) : Math.PI * value.radius ** 2;

  return (
    <div className="overflow-hidden rounded-xl border border-app-line bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-app-line-soft px-3 py-2.5">
        {/* Two shapes, because sites come in two kinds — see the note at the
            top of this file. The switch leads the toolbar because choosing it
            changes what every other control here means. */}
        <div
          role="group"
          aria-label="Boundary shape"
          className="inline-flex items-center rounded-full bg-muted/70 p-0.5 ring-1 ring-border/60"
        >
          {(
            [
              { mode: "radius", label: "Circle" },
              { mode: "polygon", label: "Draw area" },
            ] as const
          ).map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              aria-pressed={value.mode === mode}
              onClick={() =>
                onChange(
                  mode === "radius"
                    ? {
                        mode: "radius",
                        lat: value.lat,
                        lng: value.lng,
                        radius: value.mode === "radius" ? value.radius : 150,
                      }
                    : {
                        mode: "polygon",
                        lat: value.lat,
                        lng: value.lng,
                        ring: value.mode === "polygon" ? value.ring : [],
                      },
                )
              }
              className={cn(
                "press rounded-full px-3 py-1 text-xs font-medium outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring/50",
                value.mode === mode
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {value.mode === "radius" ? (
          <label className="flex min-w-0 flex-1 items-center gap-2.5 text-xs font-medium text-muted-foreground">
            <span className="shrink-0">Radius</span>
            <input
              type="range"
              min={25}
              max={1000}
              step={5}
              value={value.radius}
              onChange={(e) => onChange({ ...value, radius: Number(e.target.value) })}
              className="h-1.5 min-w-24 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />
            <strong className="shrink-0 font-mono text-sm text-foreground tabular-nums">
              {value.radius} m
            </strong>
          </label>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {value.ring.length} {value.ring.length === 1 ? "point" : "points"}
            </span>
            {value.ring.length >= 3 && (
              <span className="font-mono tabular-nums">
                ≈ {area >= 10000 ? `${(area / 10000).toFixed(2)} ha` : `${Math.round(area)} m²`}
              </span>
            )}
            {value.ring.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onChange({ mode: "polygon", ring: [], lat: 0, lng: 0 })}
              >
                Clear
              </Button>
            )}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() =>
            navigator.geolocation.getCurrentPosition((pos) => {
              const { latitude, longitude } = pos.coords;
              map.current?.setView([latitude, longitude], 18);
              if (latest.current.mode === "radius") {
                onChange({
                  mode: "radius",
                  lat: latitude,
                  lng: longitude,
                  radius: latest.current.radius,
                });
              }
            })
          }
        >
          <LocateFixed data-icon="inline-start" />
          Find me
        </Button>
      </div>

      <div className="h-[340px] w-full" ref={host} />

      <p className="border-t border-app-line-soft px-3 py-2.5 text-xs text-muted-foreground">
        {value.mode === "radius"
          ? "Click the map to place the site, then drag the pin to fine-tune. The shaded circle is where a guard may check in."
          : "Click to drop each corner of the boundary. Drag a point to move it, right-click one to remove it. Three points make an area."}
      </p>
    </div>
  );
}
