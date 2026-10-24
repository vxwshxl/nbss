import { useFocusEffect } from "expo-router";
import { ChevronRight, LocateFixed, MessageSquare, Navigation, Phone, Users, X } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { COMPANY, tel } from "@nbss/shared/company";
import { distanceMetres, formatDistance, toRing } from "@nbss/shared/geo";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { MAP_COLOR, fenceRing } from "@/components/live-map/shared";
import { MapCanvas, type MapFence, type MapPerson } from "@/components/map-canvas";
import { MapSheet } from "@/components/map-sheet";
import { Panel, PanelRow } from "@/components/panel";
import { Text } from "@/components/text";
import { useLivePosition } from "@/hooks/use-live-position";
import { useLoader } from "@/hooks/use-loader";
import { useAuth } from "@/lib/auth";
import { directionsUrl, dutyAreas, type Friend } from "@/lib/duty";
import { currentFix } from "@/lib/location";
import { SosAlarm } from "@/screens/sos-alarm";
import { color, radius, shadow, space } from "@/theme/tokens";

const IST = "Asia/Kolkata";
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
const ago = (iso: string | null, now: number) => {
  if (!iso) return "no signal";
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`;
};
const first = (name: string) => name.split(/\s+/)[0] ?? name;

/**
 * The SOS tab. One place, two states:
 *
 *   An SOS is open (yours, or one you were sent): the tab IS that SOS — the map with
 *   the area in red, who raised it, who is coming, and the buttons. With several open,
 *   they are listed at the top of the sheet to switch between (names and sites wrap
 *   there, which chips over the map could not).
 *
 *   All quiet: the map of the duties going on, the colleagues on duty with you (tap
 *   one to call or get directions), and Call office / SMS location, which work
 *   without internet.
 *
 * Raising an SOS is never done here: the floating red button, held for three
 * seconds, does that from every screen.
 */
export function SosMap({ failed }: { failed?: string }) {
  const { profile } = useAuth();
  const live = useLivePosition();
  const { data, refreshing, reload, refresh } = useLoader(dutyAreas);
  const [pickedAlert, setPickedAlert] = useState<string | null>(null);
  const [pickedFriend, setPickedFriend] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [sheetH, setSheetH] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      void reload();
      const t = setInterval(() => {
        void reload();
        setNow(Date.now());
      }, 10_000);
      return () => clearInterval(t);
    }, [reload]),
  );

  const areas = useMemo(() => data?.areas ?? [], [data]);
  const friends = useMemo(() => data?.friends ?? [], [data]);
  const alerts = useMemo(() => data?.alerts ?? [], [data]);

  const fences: MapFence[] = useMemo(
    () =>
      areas.map((a) => {
        const ring = fenceRing({ id: a.id, name: a.name, lat: a.lat, lng: a.lng, radiusM: a.geofence_radius_m, ring: toRing(a.polygon) });
        return a.mine ? { id: a.id, name: a.name, ring, tone: MAP_COLOR.inside } : { id: a.id, name: a.name, ring, tone: "#64748b", quiet: true };
      }),
    [areas],
  );
  const people: MapPerson[] = useMemo(
    () => friends.flatMap((f) => (f.lat != null && f.lng != null ? [{ id: f.id, lat: f.lat, lng: f.lng, label: first(f.name), tone: MAP_COLOR.inside }] : [])),
    [friends],
  );

  // An SOS is open: show it, right here.
  const shown = alerts.find((a) => a.id === pickedAlert) ?? alerts[0];
  if (shown) {
    return (
      <View style={styles.root}>
        <SosAlarm
          key={shown.id}
          alertId={shown.id}
          embedded
          choices={alerts.map((a) => ({ id: a.id, who: a.mine ? "Your SOS" : a.raiser_name, site: a.site_name }))}
          onChoose={setPickedAlert}
        />
      </View>
    );
  }

  const fix = live.fix;
  const friend = friends.find((f) => f.id === pickedFriend);
  const away = (p: { lat: number | null; lng: number | null }) => (fix && p.lat != null && p.lng != null ? formatDistance(distanceMetres(fix, { lat: p.lat, lng: p.lng })) : null);

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <MapCanvas
          fences={fences}
          people={people}
          me={fix ? { ...fix, heading: live.heading } : null}
          frameKey={`${frameKey}|${areas.length}`}
          padding={{ top: 64, right: 24, bottom: sheetH + 16, left: 24 }}
          onPersonPress={setPickedFriend}
        />
      </View>

      <View style={styles.chipRow} pointerEvents="box-none">
        <View style={styles.chip}>
          <View style={[styles.chipDot, { backgroundColor: color.live }]} />
          <Text variant="caption" weight="semibold">
            All quiet
          </Text>
        </View>
      </View>

      <MapSheet
        initial="half"
        onSnap={(_, px) => setSheetH(px)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={color.primary} />}
        floating={
          <View style={styles.floatRow} pointerEvents="box-none">
            <Pressable accessibilityRole="button" accessibilityLabel="Show everything" onPress={() => setFrameKey((k) => k + 1)} style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
              <LocateFixed size={22} color={color.primary} strokeWidth={2.2} />
            </Pressable>
          </View>
        }
        header={
          friend ? (
            <FriendCard f={friend} distance={away(friend)} now={now} onClose={() => setPickedFriend(null)} />
          ) : (
            <View style={styles.gap1}>
              <Text variant="label" weight="semibold" tone="primary">
                No SOS open
              </Text>
              <Text variant="title" weight="semibold">
                All quiet
              </Text>
              <Text variant="label" tone="muted">
                Need help? Hold the red SOS button for 3 seconds.
              </Text>
              {failed ? (
                <Text variant="caption" weight="semibold" tone="danger">
                  Not sent: {failed}. Call or SMS the office below.
                </Text>
              ) : null}
            </View>
          )
        }
      >
        {/* A call and an SMS travel on the mobile network, with no internet at all. */}
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button label="Call office" icon={Phone} fullWidth onPress={() => void Linking.openURL(`tel:${tel(COMPANY.phone)}`)} />
          </View>
          <View style={styles.flex}>
            <Button
              label="SMS location"
              icon={MessageSquare}
              variant="outline"
              fullWidth
              onPress={() =>
                void currentFix().then((f) => {
                  const where = f ? ` Location: https://maps.google.com/?q=${f.coords.latitude.toFixed(5)},${f.coords.longitude.toFixed(5)}` : "";
                  void Linking.openURL(`sms:${tel(COMPANY.phone)}?body=${encodeURIComponent(`SOS from ${profile?.full_name ?? "a guard"}. Need help now.${where}`)}`);
                })
              }
            />
          </View>
        </View>

        <Panel tone="emerald" title="On duty with you" subtitle={friends.length ? `${friends.length} at your sites` : "Nobody else checked in at your sites"} icon={Users} bare>
          {friends.length === 0 && (
            <PanelRow first>
              <Text variant="label" tone="muted">
                Colleagues checked in at your sites show here and on the map.
              </Text>
            </PanelRow>
          )}
          {friends.map((f, i) => (
            <Pressable key={f.id} onPress={() => setPickedFriend(f.id)} accessibilityRole="button">
              {({ pressed }) => (
                <PanelRow first={i === 0} style={pressed && styles.rowPressed}>
                  <Avatar name={f.name} size={34} />
                  <View style={styles.flex}>
                    <Text variant="label" weight="semibold" numberOfLines={1}>
                      {f.name}
                    </Text>
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {f.site_name} · {f.lat == null ? "no signal" : ago(f.heard_at, now)}
                    </Text>
                  </View>
                  <Text variant="caption" weight="semibold" tone="muted">
                    {away(f) ?? ""}
                  </Text>
                  <ChevronRight size={16} color={color.mutedForeground} strokeWidth={2} />
                </PanelRow>
              )}
            </Pressable>
          ))}
        </Panel>
        <View style={styles.spacer} />
      </MapSheet>
    </View>
  );
}

function FriendCard({ f, distance, now, onClose }: { f: Friend; distance: string | null; now: number; onClose: () => void }) {
  return (
    <View style={styles.gap3}>
      <View style={styles.cardHead}>
        <Avatar name={f.name} size={40} />
        <View style={styles.flex}>
          <Text variant="title" weight="semibold" numberOfLines={1}>
            {f.name}
          </Text>
          <Text variant="caption" weight="semibold" tone="primary" numberOfLines={1}>
            On duty at {f.site_name}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose} style={styles.close}>
          <X size={18} color={color.foreground} strokeWidth={2} />
        </Pressable>
      </View>
      <View style={styles.facts}>
        {(
          [
            ["Checked in", time(f.check_in_at)],
            ["Last heard", f.lat == null ? "No signal" : ago(f.heard_at, now)],
            ["Distance", distance ?? "-"],
            ["Battery", f.battery != null ? `${f.battery}%` : "-"],
          ] as const
        ).map(([k, v]) => (
          <View key={k} style={styles.fact}>
            <Text variant="caption" tone="muted">
              {k}
            </Text>
            <Text variant="label" weight="semibold" numberOfLines={1}>
              {v}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.row}>
        {f.phone ? (
          <View style={styles.flex}>
            <Button label="Call" icon={Phone} fullWidth onPress={() => void Linking.openURL(`tel:${tel(f.phone!)}`)} />
          </View>
        ) : null}
        {f.lat != null && f.lng != null ? (
          <View style={styles.flex}>
            <Button label="Directions" icon={Navigation} variant="outline" fullWidth onPress={() => void Linking.openURL(directionsUrl({ lat: f.lat!, lng: f.lng! }))} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.appBg },
  flex: { flex: 1, minWidth: 0 },
  gap1: { gap: 2 },
  gap3: { gap: space[3] },
  row: { flexDirection: "row", gap: space[2], alignItems: "center" },
  pressed: { opacity: 0.7 },
  spacer: { height: 96 },
  chipRow: { position: "absolute", top: space[3], left: space[3], alignItems: "flex-start" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 30, paddingHorizontal: space[3], borderRadius: radius.full, backgroundColor: color.card, ...shadow.card },
  chipDot: { width: 9, height: 9, borderRadius: 5 },
  floatRow: { flexDirection: "row", justifyContent: "flex-end" },
  fab: { width: 52, height: 52, borderRadius: 26, backgroundColor: color.card, alignItems: "center", justifyContent: "center", ...shadow.raised },
  rowPressed: { backgroundColor: color.muted },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space[3] },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: color.muted, alignItems: "center", justifyContent: "center" },
  facts: { flexDirection: "row", flexWrap: "wrap", rowGap: space[2], borderRadius: radius.xl, backgroundColor: color.muted, padding: space[3] },
  fact: { width: "50%", gap: 1 },
});
