import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import MapView, { Circle, Marker, Polygon, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from "react-native-maps";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { runsByFence } from "@nbss/shared/trail";

import { Text } from "@/components/text";
import { font } from "@/theme/tokens";

import { MAP_COLOR, initialsOf, type MapPoint } from "./live-map/shared";

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
  /** The name on the chip under the circle (a first name). */
  label?: string;
  /** Beside the name, quieter: the battery ("48%") or a time. */
  sub?: string;
  /** In the circle; from `label` when not given. */
  initials?: string;
  /** Degrees from north: a pointer turns around the circle, as on the website. */
  heading?: number | null;
  tone: string;
  /** Bigger and ringed, with a dark chip: the person picked, or who raised an SOS. */
  big?: boolean;
  frame?: boolean;
};

export { initialsOf };

export type MapCanvasProps = {
  fences?: MapFence[];
  people?: MapPerson[];
  /** The phone; `heading` (degrees from north) draws Google Maps' direction beam. */
  me?: (MapPoint & { accuracyM?: number; heading?: number | null; /** Left out of the framing (default true). */ frame?: boolean }) | null;
  /** A dashed line, from the guard to where they are heading. */
  route?: [MapPoint, MapPoint] | null;
  /** The path walked since check-in. */
  trail?: MapPoint[] | null;
  /**
   * A shift's route, coloured by the fence: blue inside, orange outside. With `upTo`,
   * the part after that point is a faint dotted line (a moment from the timeline).
   */
  path?: { points: (MapPoint & { inside: boolean | null })[]; upTo?: number | null } | null;
  /**
   * Places drawn as the platform's own pins (Apple's balloon, Google's teardrop), with
   * an optional accuracy circle. The map itself puts their tip exactly on the point at
   * every zoom; a custom marker view on iPhone sits a few points off, which at a low
   * zoom is many metres.
   */
  pins?: { id: string; lat: number; lng: number; color: string; title?: string; accuracyM?: number; frame?: boolean }[];
  /** The phone's own blue dot, drawn by the map (exact at every zoom, on both platforms). */
  showsUserLocation?: boolean;
  /** Changed to re-frame the view around everything drawn. */
  frameKey?: string;
  /** When set, the camera frames just this point (a moment picked on a route), not everything drawn. */
  focus?: MapPoint | null;
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
  path = null,
  pins = [],
  showsUserLocation = false,
  frameKey = "",
  focus = null,
  padding,
  onPersonPress,
  onFencePress,
  style,
}: MapCanvasProps) {
  const map = useRef<MapView>(null);
  const ready = useRef(false);
  // Zoomed out past a few streets: names and site labels would pile on each other, so
  // (as on the website) the chips and site labels go until the map comes closer.
  const [far, setFar] = useState(false);
  const framed = useRef<string | null>(null);

  const points = useMemo(() => {
    const pts: { latitude: number; longitude: number }[] = [];
    for (const f of fences) if (f.frame !== false) for (const [lng, lat] of f.ring) pts.push({ latitude: lat, longitude: lng });
    for (const p of people) if (p.frame !== false) pts.push({ latitude: p.lat, longitude: p.lng });
    for (const p of path?.points ?? []) pts.push({ latitude: p.lat, longitude: p.lng });
    if (me && me.frame !== false) pts.push({ latitude: me.lat, longitude: me.lng });
    for (const p of pins) if (p.frame !== false) pts.push({ latitude: p.lat, longitude: p.lng });
    return pts;
  }, [fences, people, me, path, pins]);

  const drawn = points.length > 0;
  // Re-framed when the visible area changes too (the sheet snapping up or down),
  // so "centre on me" means the centre of what is actually visible above it.
  const key = drawn ? `${frameKey}|${me ? 1 : 0}|${Math.round((padding?.bottom ?? 0) / 24)}|${focus ? `${focus.lat.toFixed(6)},${focus.lng.toFixed(6)}` : ""}` : null;

  const frame = () => {
    if (!map.current || !ready.current || !key || framed.current === key || points.length === 0) return;
    framed.current = key;
    // `mapPadding` already reserves the space under the sheet and the top bar, so
    // the fit only adds a small margin. Passing the same padding twice (as before)
    // counted the sheet twice and pushed everything up, off centre.
    const margin = padding ? { top: 24, right: 24, bottom: 24, left: 24 } : { top: 60, right: 40, bottom: 60, left: 40 };
    // One point is framed as a ~90 m box around it rather than a camera centre:
    // a camera centre ignores the padding on iOS, a fitted box respects it on both.
    const only = focus ? { latitude: focus.lat, longitude: focus.lng } : points.length === 1 ? points[0]! : null;
    const coords = only
      ? [
          { latitude: only.latitude - 0.0008, longitude: only.longitude - 0.0008 },
          { latitude: only.latitude + 0.0008, longitude: only.longitude + 0.0008 },
        ]
      : points;
    // A focused point usually comes with the sheet sliding down; moving the camera while
    // the padding changes under it cancels the move on Android, so it waits for the sheet.
    if (only && focus) {
      setTimeout(() => map.current?.fitToCoordinates(coords, { edgePadding: margin, animated: true }), 450);
    } else {
      map.current.fitToCoordinates(coords, { edgePadding: margin, animated: true });
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
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
        onMapReady={() => {
          ready.current = true;
          frame();
        }}
        onRegionChangeComplete={(r) => setFar(r.latitudeDelta > FAR_DELTA)}
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
          // Zoomed out, a site is its boundary alone: no label, no dot.
          if (far) return null;
          return (
            <SettledMarker
              key={`label-${f.id}-${f.tone}`}
              coordinate={c}
              anchor={{ x: 0.5, y: 1 }}
              // Apple Maps ignores `anchor` and centres the view: lift it by half its
              // height so the stick, not the middle of the label, is on the site.
              centerOffset={{ x: 0, y: -((f.quiet ? PIN_QUIET_H : PIN_H) + PIN_STICK_H) / 2 }}
              onPress={onFencePress ? () => onFencePress(f.id) : undefined}
            >
              <View style={styles.pin}>
                <View style={[styles.pinLabel, f.quiet && styles.pinQuiet, { backgroundColor: f.tone }]}>
                  <Text style={[styles.pinText, f.quiet && styles.pinTextQuiet]} numberOfLines={1} clip>
                    {f.name}
                  </Text>
                </View>
                <View style={[styles.pinStick, { backgroundColor: f.tone }]} />
              </View>
            </SettledMarker>
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
        {path && path.points.length > 1 && <RoutePath points={path.points} upTo={path.upTo ?? null} />}
        {route && (
          <Polyline
            coordinates={route.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={MAP_COLOR.route}
            strokeWidth={3}
            lineDashPattern={[2, 10]}
            lineCap="round"
          />
        )}

        {/* Each guard is two markers of fixed size, as the website draws them: the circle
            (initials, the state colour, a pointer for the heading), centred exactly on
            the point, and the name chip hung under it. One marker holding both put the
            circle wherever the measured box happened to centre, which drifted off the
            point as the map zoomed out. */}
        {people.map((p) => {
          const g = geometry(p.big);
          return (
            <SettledMarker
              key={`${p.id}-${p.tone}-${p.big ? 1 : 0}-${Math.round((p.heading ?? -1) / 10)}`}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              centerOffset={{ x: 0, y: 0 }}
              zIndex={p.big ? 900 : 100}
              onPress={onPersonPress ? () => onPersonPress(p.id) : undefined}
            >
              <View style={{ width: g.box, height: g.box, alignItems: "center", justifyContent: "center" }}>
                {p.big && <View style={{ position: "absolute", width: g.halo, height: g.halo, borderRadius: g.halo / 2, backgroundColor: alpha(p.tone, 0.28) }} />}
                {p.heading != null && (
                  <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${Math.round(p.heading)}deg` }] }]}>
                    <View style={[styles.pointer, { top: g.box / 2 - g.circle / 2 - 10, left: g.box / 2 - 7, borderBottomColor: p.tone }]} />
                  </View>
                )}
                <View style={[styles.whoCircle, { width: g.circle, height: g.circle, borderRadius: g.circle / 2, backgroundColor: p.tone, borderWidth: p.big ? 3 : 2.5 }]}>
                  <Text style={[styles.whoInitials, p.big && styles.whoInitialsBig]} numberOfLines={1} clip>
                    {p.initials ?? initialsOf(p.label)}
                  </Text>
                </View>
              </View>
            </SettledMarker>
          );
        })}
        {people.map((p) => {
          // Zoomed out, only the one picked (or an SOS) keeps its name.
          if (!p.label || (far && !p.big)) return null;
          const g = geometry(p.big);
          return (
            <SettledMarker
              key={`label-${p.id}-${p.label}-${p.sub ?? ""}-${p.big ? 1 : 0}`}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              // The chip's box starts at the point with a gap of half the circle, so it hangs
              // under the circle: Android by the anchor, iPhone by the offset.
              anchor={{ x: 0.5, y: 0 }}
              centerOffset={{ x: 0, y: g.labelBox / 2 }}
              zIndex={p.big ? 899 : 99}
              onPress={onPersonPress ? () => onPersonPress(p.id) : undefined}
            >
              <View style={[styles.who, { height: g.labelBox }]}>
                <View style={{ height: g.labelBox - WHO_LABEL_H }} />
                {/* Name and battery as two texts, each with its own size: nested, the
                    battery took the body size and the chip measured wrong. */}
                <View style={[styles.whoLabel, p.big && styles.whoLabelBig]}>
                  <Text style={[styles.whoText, p.big && styles.whoTextBig]} numberOfLines={1} clip>
                    {p.label}
                  </Text>
                  {p.sub ? (
                    <Text style={[styles.whoSub, p.big && styles.whoSubBig]} numberOfLines={1} clip>
                      {p.sub}
                    </Text>
                  ) : null}
                </View>
              </View>
            </SettledMarker>
          );
        })}

        {me && me.accuracyM && me.accuracyM < 500 ? (
          <Circle
            center={{ latitude: me.lat, longitude: me.lng }}
            radius={me.accuracyM}
            // A colour as well as the width: Apple Maps draws an unset stroke thick and black.
            strokeColor={alpha(MAP_COLOR.me, 0.3)}
            strokeWidth={1}
            fillColor={alpha(MAP_COLOR.me, 0.1)}
          />
        ) : null}
        {pins.map((p) =>
          p.accuracyM && p.accuracyM < 500 ? (
            <Circle
              key={`acc-${p.id}`}
              center={{ latitude: p.lat, longitude: p.lng }}
              radius={p.accuracyM}
              strokeColor={alpha(p.color, 0.5)}
              strokeWidth={1}
              fillColor={alpha(p.color, 0.12)}
            />
          ) : null,
        )}
        {pins.map((p) => (
          <Marker key={`pin-${p.id}-${p.color}`} coordinate={{ latitude: p.lat, longitude: p.lng }} pinColor={p.color} title={p.title} tracksViewChanges={false} />
        ))}
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

/** How far out (degrees of latitude across the view) the map counts as zoomed out. */
const FAR_DELTA = 0.03;

/**
 * A marker drawn from a view, redrawn for its first moments and then frozen.
 * Frozen from the start (tracksViewChanges false), iOS snapshots the view before its
 * text has been measured and keeps that: a chip cut short ("ALONGBAR 7"). Tracking
 * for ever redraws every marker on every frame. Each new key starts tracking again.
 */
function SettledMarker(props: ComponentProps<typeof Marker>) {
  const [settling, setSettling] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setSettling(false), 700);
    return () => clearTimeout(t);
  }, []);
  return <Marker {...props} tracksViewChanges={settling} />;
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

const WHO_LABEL_H = 19;
/**
 * A guard's marker, in points: the circle, the box around it (room for the heading
 * pointer and the halo), and the name marker's height (a gap below the circle, then
 * the chip). As the website: 30 across, 42 when picked.
 */
function geometry(big?: boolean) {
  const circle = big ? 42 : 30;
  const halo = circle + 18;
  return { circle, halo, box: big ? 76 : 56, labelBox: (big ? halo : circle) / 2 + 3 + WHO_LABEL_H };
}

/** A shift's route in the fence's colours, the part after `upTo` dotted and faint. */
function RoutePath({ points, upTo }: { points: (MapPoint & { inside: boolean | null })[]; upTo: number | null }) {
  const cut = upTo == null ? points.length - 1 : Math.max(0, Math.min(upTo, points.length - 1));
  const walked = runsByFence(points.slice(0, cut + 1));
  const ahead = cut < points.length - 1 ? runsByFence(points.slice(cut)) : [];
  const coords = (path: MapPoint[]) => path.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  return (
    <>
      {ahead.map((r, i) => (
        <Polyline key={`a${i}`} coordinates={coords(r.path)} strokeColor={alpha(r.inside ? MAP_COLOR.me : MAP_COLOR.outside, 0.45)} strokeWidth={3} lineDashPattern={[3, 6]} lineCap="round" />
      ))}
      {walked.map((r, i) => (
        <Polyline key={`w${i}`} coordinates={coords(r.path)} strokeColor={r.inside ? MAP_COLOR.me : MAP_COLOR.outside} strokeWidth={4} lineCap="round" lineJoin="round" />
      ))}
    </>
  );
}
/** A site's name pin: fixed heights, so iOS can be told where its stick ends. */
const PIN_H = 24;
const PIN_QUIET_H = 18;
const PIN_STICK_H = 10;

const styles = StyleSheet.create({
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#eef0ee", overflow: "hidden" },
  pin: { alignItems: "center" },
  // No width cap: the site's whole name, on one line (the pin's height is fixed for iOS).
  pinLabel: { height: PIN_H, justifyContent: "center", paddingHorizontal: 10, borderRadius: 999 },
  pinText: { color: "#fff", fontFamily: font.semibold, fontSize: 12, lineHeight: 16 },
  pinStick: { width: 3, height: PIN_STICK_H },
  pinQuiet: { height: PIN_QUIET_H, paddingHorizontal: 7, opacity: 0.9 },
  pinTextQuiet: { fontSize: 10, lineHeight: 13 },
  who: { alignItems: "center" },
  whoCircle: { alignItems: "center", justifyContent: "center", borderColor: "#fff", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  whoInitials: { fontFamily: font.bold, fontSize: 11, lineHeight: 13, color: "#fff" },
  whoInitialsBig: { fontSize: 14, lineHeight: 17 },
  // Which way they face or walk, turned around the circle with the heading.
  pointer: { position: "absolute", width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderBottomWidth: 10, borderLeftColor: "transparent", borderRightColor: "transparent" },
  // A fixed height, so the spacer above the circle can match it exactly.
  whoLabel: { height: WHO_LABEL_H, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.96)", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  whoLabelBig: { backgroundColor: "#0f172a" },
  whoText: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14, color: "#111" },
  whoTextBig: { color: "#fff", fontSize: 12, lineHeight: 15 },
  whoSub: { fontFamily: font.medium, fontSize: 11, lineHeight: 14, color: "#555" },
  whoSubBig: { fontSize: 12, lineHeight: 15, color: "#cbd5e1" },
  meBox: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  meHalo: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: alpha(MAP_COLOR.me, 0.2) },
  meDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: MAP_COLOR.me, borderWidth: 3, borderColor: "#fff" },
});
