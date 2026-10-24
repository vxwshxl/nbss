import { useEffect, useMemo, useState } from "react";

import { color } from "@/theme/tokens";

import { MapCanvas } from "@/components/map-canvas";

import { MAP_COLOR, fenceRing, type LiveMapProps } from "./shared";

export type { LiveMapProps, MapSite } from "./shared";
export { ATTRIBUTION } from "./shared";

/**
 * The duty screen's map: the guard as a blue dot, their post's boundary in
 * green (inside) or amber (not yet), a dashed line between the two until they
 * arrive, and the path walked since check-in. Google Maps, via MapCanvas.
 */
export function LiveMap({ me, site, inside, frameKey, padding, trail, areas = [], friends = [], onFriendPress, sos, onSosPress }: LiveMapProps) {
  const sosAreas = useMemo(() => new Set(sos?.areaIds ?? []), [sos]);
  const alarm = sosAreas.size > 0;
  // An SOS area pulses, as on the SOS tab.
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (!alarm) return;
    const t = setInterval(() => setBlink((b) => !b), 700);
    return () => clearInterval(t);
  }, [alarm]);
  const sosFill = blink ? 0.42 : 0.12;
  const tone = site && sosAreas.has(site.id) ? color.sos : inside ? MAP_COLOR.inside : MAP_COLOR.outside;
  const fences = useMemo(
    () => [
      ...areas
        .filter((a) => a.id !== site?.id)
        .map((a) =>
          sosAreas.has(a.id)
            ? { id: a.id, name: `SOS · ${a.name}`, ring: fenceRing(a), tone: color.sos, fill: sosFill, frame: false }
            : { id: a.id, name: a.name, ring: fenceRing(a), tone: "#64748b", quiet: true, frame: false },
        ),
      ...(site ? [{ id: site.id, name: sosAreas.has(site.id) ? `SOS · ${site.name}` : site.name, ring: fenceRing(site), tone, ...(sosAreas.has(site.id) ? { fill: sosFill } : {}) }] : []),
    ],
    [site, tone, areas, sosAreas, sosFill],
  );
  const people = useMemo(() => {
    const raised = new Set((sos?.raisers ?? []).map((r) => r.id));
    return [
      ...friends
        .filter((f) => !raised.has(f.id))
        .map((f) => ({ id: f.id, lat: f.lat, lng: f.lng, label: f.name.split(/\s+/)[0], tone: MAP_COLOR.inside, frame: false })),
      ...(sos?.raisers ?? []).map((r) => ({ id: `sos:${r.id}`, lat: r.lat, lng: r.lng, label: r.label, tone: color.sos, big: true, frame: false })),
    ];
  }, [friends, sos]);
  return (
    <MapCanvas
      fences={fences}
      people={people}
      onPersonPress={(id) => (id.startsWith("sos:") ? onSosPress?.() : onFriendPress?.(id))}
      me={me}
      trail={trail ?? null}
      route={me && site && !inside ? [me, site] : null}
      frameKey={`${frameKey}|${site?.id ?? ""}`}
      padding={padding}
    />
  );
}
