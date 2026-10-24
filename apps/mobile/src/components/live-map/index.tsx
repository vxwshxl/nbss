import { useMemo } from "react";

import { MapCanvas } from "@/components/map-canvas";

import { MAP_COLOR, fenceRing, type LiveMapProps } from "./shared";

export type { LiveMapProps, MapSite } from "./shared";
export { ATTRIBUTION } from "./shared";

/**
 * The duty screen's map: the guard as a blue dot, their post's boundary in
 * green (inside) or amber (not yet), a dashed line between the two until they
 * arrive, and the path walked since check-in. Google Maps, via MapCanvas.
 */
export function LiveMap({ me, site, inside, frameKey, padding, trail, areas = [], friends = [], onFriendPress }: LiveMapProps) {
  const tone = inside ? MAP_COLOR.inside : MAP_COLOR.outside;
  const fences = useMemo(
    () => [
      ...areas
        .filter((a) => a.id !== site?.id)
        .map((a) => ({ id: a.id, name: a.name, ring: fenceRing(a), tone: "#64748b", quiet: true, frame: false })),
      ...(site ? [{ id: site.id, name: site.name, ring: fenceRing(site), tone }] : []),
    ],
    [site, tone, areas],
  );
  const people = useMemo(
    () => friends.map((f) => ({ id: f.id, lat: f.lat, lng: f.lng, label: f.name.split(/\s+/)[0], tone: MAP_COLOR.inside, frame: false })),
    [friends],
  );
  return (
    <MapCanvas
      fences={fences}
      people={people}
      onPersonPress={onFriendPress}
      me={me}
      trail={trail ?? null}
      route={me && site && !inside ? [me, site] : null}
      frameKey={`${frameKey}|${site?.id ?? ""}`}
      padding={padding}
    />
  );
}
