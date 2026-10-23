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
export function LiveMap({ me, site, inside, frameKey, padding, trail }: LiveMapProps) {
  const tone = inside ? MAP_COLOR.inside : MAP_COLOR.outside;
  const fences = useMemo(() => (site ? [{ id: site.id, name: site.name, ring: fenceRing(site), tone }] : []), [site, tone]);
  return (
    <MapCanvas
      fences={fences}
      me={me}
      trail={trail ?? null}
      route={me && site && !inside ? [me, site] : null}
      frameKey={`${frameKey}|${site?.id ?? ""}`}
      padding={padding}
    />
  );
}
