"use client";

import { useEffect, useRef } from "react";
import { LocateFixed } from "lucide-react";

import { MapFrame, useGoogleMap } from "@/components/maps/use-google-map";
import { Button } from "@/components/ui/button";
import { KOKRAJHAR, MAP_COLOR } from "@/lib/google-maps";
import { cn } from "@/lib/utils";

/**
 * Drawing a site's boundary, on Google Maps.
 *
 * Two shapes, because sites come in two kinds. A gate or an ATM is a point
 * with a radius around it. A campus, a factory or a hospital compound is an
 * outline, and forcing a circle onto one either leaves half the grounds
 * outside the fence or swallows the road beside it.
 *
 * Both use Google's own editable shapes: the circle has a centre handle to drag
 * and an edge handle to resize; the outline has a handle on every corner and a
 * ghost handle half-way along each side that adds a corner when pulled.
 */

export type Fence =
  | { mode: "radius"; lat: number; lng: number; radius: number }
  | { mode: "polygon"; lat: number; lng: number; ring: [number, number][] };

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

function polygonFence(ring: [number, number][]): Fence {
  const [lng, lat] = ring.length ? centroid(ring) : [0, 0];
  return { mode: "polygon", ring, lat, lng };
}

export function FenceMap({
  value,
  onChange,
}: {
  value: Fence;
  onChange: (fence: Fence) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const { maps, map, error } = useGoogleMap(host, {
    center: value.lat ? { lat: value.lat, lng: value.lng } : KOKRAJHAR,
    zoom: value.lat ? 17 : 14,
    gestureHandling: "greedy",
    draggableCursor: "crosshair",
  });

  // The newest value and handler, reachable from the map's own listeners,
  // which are registered once and live outside React.
  const latest = useRef({ value, onChange });
  useEffect(() => {
    latest.current = { value, onChange };
  }, [value, onChange]);

  // A click places the circle, or adds a corner to the outline.
  useEffect(() => {
    if (!maps || !map) return;
    const listener = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const { value: v, onChange: change } = latest.current;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      if (v.mode === "radius") change({ ...v, lat, lng });
      else change(polygonFence([...v.ring, [lng, lat]]));
    });
    return () => listener.remove();
  }, [maps, map]);

  // Draw the current shape; editing it reports back through onChange.
  useEffect(() => {
    if (!maps || !map) return;
    const listeners: google.maps.MapsEventListener[] = [];
    let shape: google.maps.Circle | google.maps.Polygon | null = null;
    const style = {
      strokeColor: MAP_COLOR.primary,
      strokeWeight: 2,
      fillColor: MAP_COLOR.primary,
      fillOpacity: 0.14,
    };

    if (value.mode === "radius") {
      if (value.lat || value.lng) {
        const circle = new maps.Circle({
          ...style,
          map,
          center: { lat: value.lat, lng: value.lng },
          radius: value.radius,
          editable: true,
          draggable: true,
        });
        const report = () => {
          const c = circle.getCenter();
          if (!c) return;
          const radius = Math.max(25, Math.min(1000, Math.round(circle.getRadius() / 5) * 5));
          latest.current.onChange({ mode: "radius", lat: c.lat(), lng: c.lng(), radius });
        };
        listeners.push(circle.addListener("dragend", report), circle.addListener("radius_changed", report));
        shape = circle;
      }
    } else if (value.ring.length > 0) {
      const polygon = new maps.Polygon({
        ...style,
        map,
        paths: value.ring.map(([lng, lat]) => ({ lat, lng })),
        editable: true,
      });
      const path = polygon.getPath();
      const report = () => {
        const ring = path.getArray().map((p) => [p.lng(), p.lat()] as [number, number]);
        latest.current.onChange(polygonFence(ring));
      };
      listeners.push(
        path.addListener("set_at", report),
        path.addListener("insert_at", report),
        polygon.addListener("rightclick", (e: google.maps.PolyMouseEvent) => {
          if (e.vertex == null) return;
          path.removeAt(e.vertex);
          report();
        }),
        // A click inside the outline adds a corner too, rather than being swallowed.
        polygon.addListener("click", (e: google.maps.PolyMouseEvent) => {
          const v = latest.current.value;
          if (e.vertex != null || e.edge != null || !e.latLng || v.mode !== "polygon") return;
          latest.current.onChange(polygonFence([...v.ring, [e.latLng.lng(), e.latLng.lat()]]));
        }),
      );
      shape = polygon;
    }

    return () => {
      for (const l of listeners) l.remove();
      shape?.setMap(null);
    };
    // Redrawn when the shape itself changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maps, map, JSON.stringify(value)]);

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
              map?.setCenter({ lat: latitude, lng: longitude });
              map?.setZoom(18);
              const v = latest.current.value;
              if (v.mode === "radius") onChange({ mode: "radius", lat: latitude, lng: longitude, radius: v.radius });
            })
          }
        >
          <LocateFixed data-icon="inline-start" />
          Find me
        </Button>
      </div>

      <MapFrame hostRef={host} ready={!!map} error={error} className="h-[340px] w-full rounded-none border-0 lg:h-[480px]" />

      <p className="border-t border-app-line-soft px-3 py-2.5 text-xs text-muted-foreground">
        {value.mode === "radius"
          ? "Click the map to place the site. Drag the centre to move it and the edge to resize. The shaded circle is where a guard may check in."
          : "Click to drop each corner of the boundary. Drag a corner to move it, pull a mid-point to add one, right-click a corner to remove it. Three points make an area."}
      </p>
    </div>
  );
}
