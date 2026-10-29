"use client";

import { useEffect, useRef, useState } from "react";

import { MapFrame, useGoogleMap } from "@/components/maps/use-google-map";
import { MAP_COLOR, circlePath, createHtmlMarker, esc } from "@/lib/google-maps";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toPoints, type TrailPoint, type TrailTuple } from "@/lib/tracking";
import { initials } from "@/lib/ui/initials";
import type { TrailSite } from "@/components/tracking/trail-map";

/** One colour per shift on the overview, repeated past the end. */
export const ROUTE_HUES = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#dc2626", "#4f46e5", "#0d9488"];

export type OverviewShift = { attendanceId: string; guardName: string; siteId: string; site: TrailSite; open: boolean };

/**
 * Route history before a shift is picked: every listed shift's path on one map, each in
 * its own colour with the guard's initials where it ends (where they are now, for a
 * shift still open), and every site's fence. Clicking a path or a guard picks that shift.
 */
export function RoutesOverview({ shifts, onPick, className }: { shifts: OverviewShift[]; onPick: (attendanceId: string) => void; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const { maps, map, error } = useGoogleMap(host, { zoom: 14, gestureHandling: "greedy" });
  const [trails, setTrails] = useState<Record<string, TrailPoint[]>>({});
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  // Each shift's path, read once (and again every minute for the ones still open).
  const ids = shifts.map((s) => `${s.attendanceId}:${s.open ? 1 : 0}`).join(",");
  useEffect(() => {
    if (!ids) return;
    const supabase = supabaseBrowser();
    let cancelled = false;
    const list = ids.split(",").map((x) => ({ id: x.split(":")[0]!, open: x.endsWith(":1") }));
    const read = async (which: typeof list) => {
      const got = await Promise.all(
        which.map(async ({ id }) => {
          const { data } = await supabase.rpc("guard_trail", { p_attendance_id: id });
          return [id, toPoints((data as { points?: TrailTuple[] } | null)?.points)] as const;
        }),
      );
      if (!cancelled) setTrails((cur) => ({ ...cur, ...Object.fromEntries(got) }));
    };
    void read(list);
    const poll = list.some((s) => s.open) ? setInterval(() => void read(list.filter((s) => s.open)), 60_000) : null;
    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
    };
  }, [ids]);

  // Fences, once per set of sites.
  const sites = [...new Map(shifts.map((s) => [s.siteId, s.site])).values()];
  const siteKey = shifts.map((s) => s.siteId).sort().join(",");
  useEffect(() => {
    if (!maps || !map) return;
    const drawn = sites.map(
      (site) =>
        new maps.Polygon({
          map,
          paths: site.ring?.length ? site.ring.map(([lng, lat]) => ({ lat, lng })) : circlePath(site, site.radiusM),
          strokeColor: MAP_COLOR.primary,
          strokeWeight: 2,
          fillColor: MAP_COLOR.primary,
          fillOpacity: 0.06,
          clickable: false,
        }),
    );
    return () => drawn.forEach((d) => d.setMap(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maps, map, siteKey]);

  // The paths and where each ends.
  const framed = useRef<string | null>(null);
  useEffect(() => {
    if (!maps || !map) return;
    const drawn: { setMap: (m: google.maps.Map | null) => void }[] = [];
    const bounds = new maps.LatLngBounds();
    shifts.forEach((s, i) => {
      const pts = trails[s.attendanceId];
      const hue = ROUTE_HUES[i % ROUTE_HUES.length]!;
      if (!pts?.length) {
        bounds.extend(s.site);
        return;
      }
      for (const p of pts) bounds.extend(p);
      const line = new maps.Polyline({ map, path: pts, strokeColor: hue, strokeOpacity: 0.75, strokeWeight: 3, zIndex: 2 });
      line.addListener("click", () => pick.current(s.attendanceId));
      drawn.push(line);
      const end = pts.at(-1)!;
      const m = createHtmlMarker(maps, {
        position: end,
        html: `<div class="gm-guard" style="--c:${hue}" ${s.open ? "data-live" : ""}><b>${esc(initials(s.guardName))}</b><span>${esc(s.guardName.split(" ")[0] ?? s.guardName)}</span></div>`,
        zIndex: 10,
        title: s.guardName,
        onClick: () => pick.current(s.attendanceId),
      });
      m.setMap(map);
      drawn.push(m);
    });
    // Framed once per list, when the paths first arrive, so later refreshes leave the view alone.
    const key = `${shifts.map((s) => s.attendanceId).join(",")}|${Object.keys(trails).length > 0}`;
    if (!bounds.isEmpty() && framed.current !== key) {
      framed.current = key;
      map.fitBounds(bounds, 60);
      maps.event.addListenerOnce(map, "idle", () => {
        if ((map.getZoom() ?? 0) > 18) map.setZoom(18);
      });
    }
    return () => drawn.forEach((d) => d.setMap(null));
  }, [maps, map, shifts, trails]);

  return <MapFrame hostRef={host} ready={!!map} error={error} height="100%" className={className} />;
}
