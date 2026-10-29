import { History, LogIn, LogOut, MapPinOff, Navigation2, ShieldCheck, Siren, Timer, WifiOff } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { istTime } from "@nbss/shared/company";
import { duration, km, routeEvents, toPoints, trailStats, type RouteEvent, type TrailPoint, type TrailTuple } from "@nbss/shared/trail";

import { MAP_COLOR, fenceRing, type MapSite } from "@/components/live-map/shared";
import { MapCanvas } from "@/components/map-canvas";
import { Panel, PanelRow } from "@/components/panel";
import { Text } from "@/components/text";
import { supabase } from "@/lib/supabase";
import { color, radius, space } from "@/theme/tokens";

/**
 * One shift's route, as the website's Live tracking and Route history show it: the path
 * in the fence's colours, how far and how long outside, the stops and the quiet spells,
 * and the timeline. Tapping a moment moves the guard's dot there and dots the way ahead;
 * Back to now (or the moment again) returns. Re-read every half minute while the shift
 * is open.
 */
export function RouteCard({
  attendanceId,
  open,
  name,
  site,
  title,
}: {
  attendanceId: string;
  /** Still checked in: the route grows while the screen is open. */
  open: boolean;
  /** First name, for the dot's label. */
  name: string;
  site: MapSite | null;
  /** "Today's route", "Route · 27 Oct". */
  title: string;
}) {
  const [loaded, setLoaded] = useState<{ id: string; points: TrailPoint[] } | null>(null);
  const [moment, setMoment] = useState<{ id: string; i: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const read = async () => {
      const { data } = await supabase.rpc("guard_trail", { p_attendance_id: attendanceId });
      if (!cancelled) setLoaded({ id: attendanceId, points: toPoints((data as { points?: TrailTuple[] } | null)?.points) });
    };
    void read();
    const poll = open ? setInterval(() => void read(), 30_000) : null;
    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
    };
  }, [attendanceId, open]);

  const points = useMemo(() => (loaded?.id === attendanceId ? loaded.points : []), [loaded, attendanceId]);
  const stats = useMemo(() => (points.length > 1 ? trailStats(points) : null), [points]);
  const events = useMemo(() => routeEvents(points, stats, []), [points, stats]);
  const picked = moment?.id === attendanceId ? events[moment.i] : undefined;
  const at = picked ? points[picked.index] : points.at(-1);

  const fences = useMemo(() => (site ? [{ id: site.id, name: site.name, ring: fenceRing(site), tone: MAP_COLOR.inside, quiet: true }] : []), [site]);
  const path = useMemo(() => ({ points, upTo: picked?.index ?? null }), [points, picked?.index]);
  const dot = at
    ? [{ id: "guard", lat: at.lat, lng: at.lng, tone: at.inside === false ? MAP_COLOR.outside : MAP_COLOR.me, label: picked ? `${name} ${istTime(new Date(picked.at).toISOString())}` : name, frame: false }]
    : [];

  return (
    <Panel tone="sky" icon={Navigation2} title={title} subtitle={loaded?.id === attendanceId ? `${points.length} points` : "Loading the route…"} bare>
      <View style={styles.map}>
        <MapCanvas fences={fences} people={dot} path={path} frameKey={attendanceId} />
      </View>

      {picked && (
        <Pressable accessibilityRole="button" onPress={() => setMoment(null)} style={styles.moment}>
          <History size={14} color="#fff" strokeWidth={2.2} />
          <Text variant="caption" weight="semibold" tone="inverse" style={styles.flex} numberOfLines={1}>
            {istTime(new Date(picked.at).toISOString())} · {picked.text}
          </Text>
          <View style={styles.now}>
            <Text variant="caption" weight="bold">
              Back to now
            </Text>
          </View>
        </Pressable>
      )}

      <PanelRow first>
        <Fact label="Walked" value={km(stats?.distanceM ?? 0)} />
        <Fact label="Outside" value={duration(stats?.outsideMinutes ?? 0)} warn={(stats?.outsideMinutes ?? 0) >= 1} />
        <Fact label="Stops" value={String(stats?.stops.length ?? 0)} />
        <Fact label="No signal" value={String(stats?.gaps.length ?? 0)} warn={(stats?.gaps.length ?? 0) > 0} />
      </PanelRow>

      {points.length <= 1 && loaded?.id === attendanceId ? (
        <PanelRow>
          <Text variant="caption" tone="muted">
            No path yet beyond the check-in point.
          </Text>
        </PanelRow>
      ) : (
        events.map((e, i) => {
          const active = picked === e;
          const Icon = ICON[e.kind];
          return (
            <Pressable
              key={`${e.kind}-${e.at}-${i}`}
              accessibilityRole="button"
              onPress={() => setMoment(active || e.kind === "now" ? null : { id: attendanceId, i })}
              style={({ pressed }) => [styles.event, active && styles.eventActive, pressed && styles.pressed]}
            >
              <View style={[styles.icon, { backgroundColor: TONE[e.kind] }]}>
                <Icon size={13} color="#fff" strokeWidth={2.2} />
              </View>
              <View style={styles.flex}>
                <Text variant="label" weight="medium">
                  {e.text}
                </Text>
                <Text variant="caption" tone="muted">
                  {istTime(new Date(e.at).toISOString())}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
    </Panel>
  );
}

function Fact({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={styles.fact}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="label" weight="bold" tone="inherit" style={{ color: warn ? MAP_COLOR.outside : color.foreground }}>
        {value}
      </Text>
    </View>
  );
}

const ICON: Record<RouteEvent["kind"], typeof LogIn> = {
  in: LogIn,
  out: LogOut,
  now: Navigation2,
  left: MapPinOff,
  back: ShieldCheck,
  stop: Timer,
  gap: WifiOff,
  sos: Siren,
  sos_end: Siren,
};

const TONE: Record<RouteEvent["kind"], string> = {
  in: "#059669",
  out: "#1e293b",
  now: "#2563eb",
  left: "#f59e0b",
  back: "#10b981",
  stop: "#64748b",
  gap: "#e11d48",
  sos: "#dc2626",
  sos_end: "#f87171",
};

const styles = StyleSheet.create({
  map: { height: 300, overflow: "hidden" },
  flex: { flex: 1, minWidth: 0 },
  fact: { flex: 1, minWidth: 0, gap: 2 },
  moment: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    margin: space[3],
    marginBottom: 0,
    paddingVertical: space[1],
    paddingLeft: space[3],
    paddingRight: space[1],
    borderRadius: radius.lg,
    backgroundColor: "#0f172a",
  },
  now: { paddingHorizontal: space[2], paddingVertical: 4, borderRadius: 999, backgroundColor: "#fff" },
  event: { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[2] },
  eventActive: { backgroundColor: "#e0f2fe" },
  icon: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.6 },
});
