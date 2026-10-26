import { useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import MapView, { Circle, Marker, Polygon, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from "react-native-maps";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

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

export type MapFence = {
  id: string;
  name: string;
  ring: [number, number][];
  tone: string;
  /** Fill strength, 0–1 (default 0.14). Changing it is how an SOS area blinks. */
  fill?: number;
  /** A background area: thin line, small label. */
  quiet?: boolean;
  /** Left out of the auto-framing (default true). */
  frame?: boolean;
};
export type MapPerson = MapPoint & {
  id: string;
  label?: string;
  tone: string;
  /** Bigger, ringed dot: the person who raised an SOS. */
  big?: boolean;
  frame?: boolean;
};

export type MapCanvasProps = {
  fences?: MapFence[];
  people?: MapPerson[];
  /** The phone; `heading` (degrees from north) draws Google Maps' direction beam. */
  me?: (MapPoint & { accuracyM?: number; heading?: number | null; /** Left out of the framing (default true). */ frame?: boolean }) | null;
  /** A dashed line, from the guard to where they are heading. */
  route?: [MapPoint, MapPoint] | null;
  /** The path walked since check-in. */
  trail?: MapPoint[] | null;
  /** Changed to re-frame the view around everything drawn. */
  frameKey?: string;
  padding?: { top: number; right: number; bottom: number; left: number };
  onPersonPress?: (id: string) => void;
  /** A site tapped: its boundary or its name pin. */
  onFencePress?: (id: string) => void;
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
  onFencePress,
  style,
}: MapCanvasProps) {
  const map = useRef<MapView>(null);
  const ready = useRef(false);
  const framed = useRef<string | null>(null);

  const points = useMemo(() => {
    const pts: { latitude: number; longitude: number }[] = [];
    for (const f of fences) if (f.frame !== false) for (const [lng, lat] of f.ring) pts.push({ latitude: lat, longitude: lng });
    for (const p of people) if (p.frame !== false) pts.push({ latitude: p.lat, longitude: p.lng });
    if (me && me.frame !== false) pts.push({ latitude: me.lat, longitude: me.lng });
    return pts;
  }, [fences, people, me]);

  const drawn = points.length > 0;
  // Re-framed when the visible area changes too (the sheet snapping up or down),
  // so "centre on me" means the centre of what is actually visible above it.
  const key = drawn ? `${frameKey}|${me ? 1 : 0}|${Math.round((padding?.bottom ?? 0) / 24)}` : null;

  const frame = () => {
    if (!map.current || !ready.current || !key || framed.current === key || points.length === 0) return;
    framed.current = key;
    // `mapPadding` already reserves the space under the sheet and the top bar, so
    // the fit only adds a small margin. Passing the same padding twice (as before)
    // counted the sheet twice and pushed everything up, off centre.
    const margin = padding ? { top: 24, right: 24, bottom: 24, left: 24 } : { top: 60, right: 40, bottom: 60, left: 40 };
    // One point is framed as a ~90 m box around it rather than a camera centre:
    // a camera centre ignores the padding on iOS, a fitted box respects it on both.
    const coords =
      points.length === 1
        ? [
            { latitude: points[0]!.latitude - 0.0008, longitude: points[0]!.longitude - 0.0008 },
            { latitude: points[0]!.latitude + 0.0008, longitude: points[0]!.longitude + 0.0008 },
          ]
        : points;
    map.current.fitToCoordinates(coords, { edgePadding: margin, animated: true });
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
            strokeWidth={f.quiet ? 1.5 : 2.5}
            fillColor={alpha(f.tone, f.fill ?? (f.quiet ? 0.08 : 0.14))}
            tappable={Boolean(onFencePress)}
            onPress={onFencePress ? () => onFencePress(f.id) : undefined}
          />
        ))}
        {fences.map((f) => {
          const c = centre(f.ring);
          return (
            <Marker
              key={`label-${f.id}-${f.tone}`}
              coordinate={c}
              anchor={{ x: 0.5, y: 1 }}
              // Apple Maps ignores `anchor` and centres the view: lift it by half its
              // height so the stick, not the middle of the label, is on the site.
              centerOffset={{ x: 0, y: -((f.quiet ? PIN_QUIET_H : PIN_H) + PIN_STICK_H) / 2 }}
              tracksViewChanges={false}
              onPress={onFencePress ? () => onFencePress(f.id) : undefined}
            >
              <View style={styles.pin}>
                <View style={[styles.pinLabel, f.quiet && styles.pinQuiet, { backgroundColor: f.tone }]}>
                  <Text style={[styles.pinText, f.quiet && styles.pinTextQuiet]} numberOfLines={1}>
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
            key={`${p.id}-${p.tone}-${p.label ?? ""}`}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            // The dot is the exact centre of the marker (a spacer above matches the label
            // below), so it sits on the coordinate on both platforms: Apple Maps ignores
            // `anchor` and centres the view, and a fraction of a view whose label comes and
            // goes put the dot metres off the place an SOS was raised.
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={p.big ? 900 : 100}
            onPress={onPersonPress ? () => onPersonPress(p.id) : undefined}
          >
            <View style={styles.who}>
              {p.label ? <View style={styles.whoSpacer} /> : null}
              {p.big ? (
                <View style={[styles.bigRing, { borderColor: alpha(p.tone, 0.35) }]}>
                  <View style={[styles.bigDot, { backgroundColor: p.tone }]} />
                </View>
              ) : (
                <View style={[styles.whoDot, { backgroundColor: p.tone }]} />
              )}
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
          <Marker
            coordinate={{ latitude: me.lat, longitude: me.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            // Android (Google Maps): rotated natively and flat, so the beam stays right when
            // the map is turned. iOS (Apple Maps) ignores `rotation`, so there the view
            // turns itself and is redrawn as the compass moves — one marker, cheap.
            rotation={Platform.OS === "android" ? (me.heading ?? 0) : undefined}
            flat={Platform.OS === "android"}
            tracksViewChanges={Platform.OS !== "android"}
            zIndex={1000}
          >
            <View style={[styles.meBox, Platform.OS !== "android" && me.heading != null && { transform: [{ rotate: `${me.heading}deg` }] }]}>
              {me.heading != null && (
                <Svg width={64} height={64} style={StyleSheet.absoluteFill}>
                  <Defs>
                    <LinearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
                      <Stop offset="0" stopColor={MAP_COLOR.me} stopOpacity="0.55" />
                      <Stop offset="1" stopColor={MAP_COLOR.me} stopOpacity="0" />
                    </LinearGradient>
                  </Defs>
                  <Path d="M32 32 L14 2 A34 34 0 0 1 50 2 Z" fill="url(#beam)" />
                </Svg>
              )}
              <View style={styles.meHalo}>
                <View style={styles.meDot} />
              </View>
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

const WHO_LABEL_H = 17;
/** A site's name pin: fixed heights, so iOS can be told where its stick ends. */
const PIN_H = 24;
const PIN_QUIET_H = 18;
const PIN_STICK_H = 10;

const styles = StyleSheet.create({
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#eef0ee", overflow: "hidden" },
  pin: { alignItems: "center" },
  pinLabel: { maxWidth: 180, height: PIN_H, justifyContent: "center", paddingHorizontal: 10, borderRadius: 999 },
  pinText: { color: "#fff", fontFamily: font.semibold, fontSize: 12, lineHeight: 16 },
  pinStick: { width: 3, height: PIN_STICK_H },
  pinQuiet: { height: PIN_QUIET_H, paddingHorizontal: 7, opacity: 0.9 },
  pinTextQuiet: { fontSize: 10, lineHeight: 13 },
  bigRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 8, alignItems: "center", justifyContent: "center" },
  bigDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: "#fff" },
  who: { alignItems: "center" },
  whoDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: "#fff" },
  // A fixed height, so the spacer above the dot can match it exactly.
  whoLabel: { marginTop: 2, height: WHO_LABEL_H, justifyContent: "center", paddingHorizontal: 6, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.95)" },
  whoSpacer: { height: WHO_LABEL_H + 2 },
  whoText: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14, color: "#111" },
  meBox: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  meHalo: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: alpha(MAP_COLOR.me, 0.2) },
  meDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: MAP_COLOR.me, borderWidth: 3, borderColor: "#fff" },
});
