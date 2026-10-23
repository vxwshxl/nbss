import { useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import MapView, { Circle, Marker, Polygon, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from "react-native-maps";

import { Text } from "@/components/text";
import { font } from "@/theme/tokens";

import { MAP_COLOR, type MapPoint } from "./live-map/shared";

/**
 * Google Maps, on the phone: react-native-maps with the Google provider on
 * Android (Expo Go ships Google's key; a build uses ours from app.config.ts) and
 * Apple Maps on iPhone in Expo Go. Every map in the app is this one component —
 * the duty screen, the site map and the supervisors' live map — so they all look
 * and behave the same.
 *
 * Props are data, not commands: a moving dot does not re-frame the view. The
 * camera moves only when `frameKey` changes (the recenter button, a different
 * site), so a guard who has panned to look at something is left alone.
 */

export type MapFence = { id: string; name: string; ring: [number, number][]; tone: string };
export type MapPerson = MapPoint & { id: string; label?: string; tone: string };

export type MapCanvasProps = {
  fences?: MapFence[];
  people?: MapPerson[];
  me?: (MapPoint & { accuracyM?: number }) | null;
  /** A dashed line, from the guard to where they are heading. */
  route?: [MapPoint, MapPoint] | null;
  /** The path walked since check-in. */
  trail?: MapPoint[] | null;
  /** Changed to re-frame the view around everything drawn. */
  frameKey?: string;
  padding?: { top: number; right: number; bottom: number; left: number };
  onPersonPress?: (id: string) => void;
  style?: ViewStyle;
};

/** "#009164" + 0.15 → "rgba(0,145,100,0.15)" — fills need an alpha the hex does not carry. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const KOKRAJHAR = { latitude: 26.4015, longitude: 90.2717, latitudeDelta: 0.05, longitudeDelta: 0.05 };

export function MapCanvas({
  fences = [],
  people = [],
  me = null,
  route = null,
  trail = null,
  frameKey = "",
  padding,
  onPersonPress,
  style,
}: MapCanvasProps) {
  const map = useRef<MapView>(null);
  const ready = useRef(false);
  const framed = useRef<string | null>(null);

  const points = useMemo(() => {
    const pts: { latitude: number; longitude: number }[] = [];
    for (const f of fences) for (const [lng, lat] of f.ring) pts.push({ latitude: lat, longitude: lng });
    for (const p of people) pts.push({ latitude: p.lat, longitude: p.lng });
    if (me) pts.push({ latitude: me.lat, longitude: me.lng });
    return pts;
  }, [fences, people, me]);

  const drawn = points.length > 0;
  const key = drawn ? `${frameKey}|${me ? 1 : 0}` : null;

  const frame = () => {
    if (!map.current || !ready.current || !key || framed.current === key || points.length === 0) return;
    framed.current = key;
    const edge = padding ?? { top: 60, right: 40, bottom: 60, left: 40 };
    if (points.length === 1) {
      map.current.animateCamera({ center: points[0]!, zoom: 17 }, { duration: 400 });
    } else {
      map.current.fitToCoordinates(points, { edgePadding: edge, animated: true });
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(frame, [key, points.length]);

  return (
    <View style={[styles.fill, style]}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={KOKRAJHAR}
        mapPadding={padding}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
        onMapReady={() => {
          ready.current = true;
          frame();
        }}
      >
        {fences.map((f) => (
          <Polygon
            key={f.id}
            coordinates={f.ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
            strokeColor={f.tone}
            strokeWidth={2.5}
            fillColor={alpha(f.tone, 0.14)}
          />
        ))}
        {fences.map((f) => {
          const c = centre(f.ring);
          return (
            <Marker key={`label-${f.id}`} coordinate={c} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
              <View style={styles.pin}>
                <View style={[styles.pinLabel, { backgroundColor: f.tone }]}>
                  <Text style={styles.pinText} numberOfLines={1}>
                    {f.name}
                  </Text>
                </View>
                <View style={[styles.pinStick, { backgroundColor: f.tone }]} />
              </View>
            </Marker>
          );
        })}

        {trail && trail.length > 1 && (
          <Polyline
            coordinates={trail.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={alpha(MAP_COLOR.me, 0.75)}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}
        {route && (
          <Polyline
            coordinates={route.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={MAP_COLOR.route}
            strokeWidth={3}
            lineDashPattern={[2, 10]}
            lineCap="round"
          />
        )}

        {people.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            anchor={{ x: 0.5, y: 0.25 }}
            tracksViewChanges={false}
            onPress={onPersonPress ? () => onPersonPress(p.id) : undefined}
          >
            <View style={styles.who}>
              <View style={[styles.whoDot, { backgroundColor: p.tone }]} />
              {p.label ? (
                <View style={styles.whoLabel}>
                  <Text style={styles.whoText} numberOfLines={1}>
                    {p.label}
                  </Text>
                </View>
              ) : null}
            </View>
          </Marker>
        ))}

        {me && me.accuracyM && me.accuracyM < 500 ? (
          <Circle
            center={{ latitude: me.lat, longitude: me.lng }}
            radius={me.accuracyM}
            strokeWidth={0}
            fillColor={alpha(MAP_COLOR.me, 0.1)}
          />
        ) : null}
        {me && (
          <Marker coordinate={{ latitude: me.lat, longitude: me.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={1000}>
            <View style={styles.meHalo}>
              <View style={styles.meDot} />
            </View>
          </Marker>
        )}
      </MapView>
    </View>
  );
}

function centre(ring: [number, number][]): { latitude: number; longitude: number } {
  let lat = 0;
  let lng = 0;
  for (const [x, y] of ring) {
    lng += x;
    lat += y;
  }
  return { latitude: lat / Math.max(1, ring.length), longitude: lng / Math.max(1, ring.length) };
}

const styles = StyleSheet.create({
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#eef0ee", overflow: "hidden" },
  pin: { alignItems: "center" },
  pinLabel: { maxWidth: 180, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pinText: { color: "#fff", fontFamily: font.semibold, fontSize: 12 },
  pinStick: { width: 3, height: 10 },
  who: { alignItems: "center" },
  whoDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: "#fff" },
  whoLabel: { marginTop: 2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.95)" },
  whoText: { fontFamily: font.semibold, fontSize: 11, color: "#111" },
  meHalo: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: alpha(MAP_COLOR.me, 0.2) },
  meDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: MAP_COLOR.me, borderWidth: 3, borderColor: "#fff" },
});
