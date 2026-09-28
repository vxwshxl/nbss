import { MapPinned } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { IS_EXPO_GO } from "@/lib/runtime";
import { color, font, space } from "@/theme/tokens";

import {
  MAP_COLOR,
  TILE_URL,
  fenceRing,
  frameBounds,
  type LiveMapProps,
  type MapPoint,
} from "./shared";

export type { LiveMapProps, MapSite } from "./shared";
export { ATTRIBUTION } from "./shared";

/**
 * MapLibre is a native module, so Expo Go cannot load it: requiring it there
 * throws while the module registers. Loaded lazily so the duty screen still
 * works in Expo Go, with a plain panel where the map would be.
 */
type MapLibreModule = typeof import("@maplibre/maplibre-react-native");
let MapLibre: MapLibreModule | null = null;
if (!IS_EXPO_GO) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    MapLibre = require("@maplibre/maplibre-react-native") as MapLibreModule;
  } catch {
    MapLibre = null;
  }
}

/**
 * The live map on the duty screen: the guard as a blue dot, their post's
 * boundary, and a dashed line between the two until they are inside it.
 */
export function LiveMap(props: LiveMapProps) {
  if (!MapLibre) return <NoMap />;
  return <NativeMap lib={MapLibre} {...props} />;
}

function NativeMap({ lib, me, site, inside, frameKey, padding }: LiveMapProps & { lib: MapLibreModule }) {
  const { Map, Camera, GeoJSONSource, Layer, Marker, RasterSource } = lib;
  const camera = useRef<import("@maplibre/maplibre-react-native").CameraRef>(null);
  const tone = inside ? MAP_COLOR.inside : MAP_COLOR.outside;

  const fence = useMemo(
    () =>
      site
        ? ({
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [fenceRing(site)] },
          } as GeoJSON.Feature)
        : null,
    [site],
  );

  const route = useMemo(
    () =>
      me && site && !inside
        ? ({
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: [[me.lng, me.lat], [site.lng, site.lat]] },
          } as GeoJSON.Feature)
        : null,
    [me, site, inside],
  );

  // Framed once the guard's first fix arrives, and again whenever the screen
  // asks (the recenter button, a different site picked) — not on every step,
  // so a guard who pans to look around is not dragged back.
  const hasMe = me !== null;
  const bounds = frameBounds(me, site);
  const boundsRef = useRef(bounds);
  useEffect(() => {
    boundsRef.current = bounds;
  });
  useEffect(() => {
    const b = boundsRef.current;
    if (!b) return;
    try {
      camera.current?.fitBounds(b, { padding, duration: 700, easing: "ease" });
    } catch {
      // The camera is not ready until the style loads; onDidFinishLoadingStyle frames it.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey, hasMe, site?.id, padding.bottom]);

  const center: MapPoint = site ?? me ?? { lat: 26.14, lng: 91.74 };

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={{
        version: 8,
        sources: {},
        layers: [{ id: "paper", type: "background", paint: { "background-color": "#eef0ee" } }],
      }}
      attribution={false}
      logo={false}
      compass={false}
      touchPitch={false}
      touchRotate={false}
      onDidFinishLoadingStyle={() => {
        const b = boundsRef.current;
        if (b) camera.current?.fitBounds(b, { padding, duration: 0 });
      }}
    >
      <Camera ref={camera} initialViewState={{ center: [center.lng, center.lat], zoom: 16 }} minZoom={4} maxZoom={19} />

      <RasterSource id="osm" tiles={[TILE_URL]} tileSize={256} maxzoom={19}>
        {/* Muted, so the boundary and the dot are what the eye finds first. */}
        <Layer type="raster" id="osm" paint={{ "raster-saturation": -0.55, "raster-contrast": -0.08, "raster-brightness-min": 0.08 }} />
      </RasterSource>

      {fence && (
        <GeoJSONSource id="fence" data={fence}>
          <Layer type="fill" id="fence-fill" paint={{ "fill-color": tone, "fill-opacity": 0.14 }} />
          <Layer type="line" id="fence-line" paint={{ "line-color": tone, "line-width": 2.5 }} />
        </GeoJSONSource>
      )}

      {route && (
        <GeoJSONSource id="route" data={route}>
          <Layer
            type="line"
            id="route-line"
            layout={{ "line-cap": "round" }}
            paint={{ "line-color": MAP_COLOR.route, "line-width": 3, "line-dasharray": [0.1, 2] }}
          />
        </GeoJSONSource>
      )}

      {site && (
        <Marker lngLat={[site.lng, site.lat]} anchor="bottom">
          <SitePin name={site.name} tone={tone} />
        </Marker>
      )}

      {me && (
        <Marker lngLat={[me.lng, me.lat]} anchor="center">
          <MeDot />
        </Marker>
      )}
    </Map>
  );
}

/** The guard: a blue dot with a slow pulse, like every ride app's "you are here". */
export function MeDot() {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={dot.box}>
      <Animated.View
        style={[
          dot.halo,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          },
        ]}
      />
      <View style={dot.core} />
    </View>
  );
}

/** The post: its name on a pill, pinned to the centre of the site. */
export function SitePin({ name, tone }: { name: string; tone: string }) {
  return (
    <View style={pin.box}>
      <View style={[pin.label, { backgroundColor: tone }]}>
        <Text variant="caption" weight="semibold" tone="inverse" numberOfLines={1} style={pin.text}>
          {name}
        </Text>
      </View>
      <View style={[pin.stem, { backgroundColor: tone }]} />
      <View style={[pin.foot, { borderColor: tone }]} />
    </View>
  );
}

function NoMap() {
  return (
    <View style={[StyleSheet.absoluteFill, none.box]}>
      <MapPinned size={28} color={color.mutedForeground} strokeWidth={1.8} />
      <Text variant="label" tone="muted" style={none.text}>
        The map needs the full NBSS app.{"\n"}Distances below are still live.
      </Text>
    </View>
  );
}

const dot = StyleSheet.create({
  box: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 64, height: 64, borderRadius: 32, backgroundColor: MAP_COLOR.me },
  core: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: MAP_COLOR.me,
    borderWidth: 3,
    borderColor: "#ffffff",
  },
});

const pin = StyleSheet.create({
  box: { alignItems: "center" },
  label: { maxWidth: 200, paddingHorizontal: space[3], paddingVertical: 6, borderRadius: 999 },
  text: { fontFamily: font.semibold },
  stem: { width: 3, height: 14 },
  foot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, backgroundColor: "#ffffff", marginTop: -2 },
});

const none = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center", gap: space[2], backgroundColor: "#e8ebe8" },
  text: { textAlign: "center" },
});
