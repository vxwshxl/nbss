import { router, useFocusEffect } from "expo-router";
import { ChevronRight, LocateFixed, MapPin, MessageSquare, Navigation, Phone, Siren, Users, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { COMPANY, tel } from "@nbss/shared/company";
import { distanceMetres, formatDistance, toRing } from "@nbss/shared/geo";
import { SOS_KIND_LABEL, SOS_STATUS_LABEL } from "@nbss/shared/sos";

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
import { directionsUrl, dutyAreas, type DutyArea, type Friend, type MapAlert } from "@/lib/duty";
import { currentFix } from "@/lib/location";
import { TONES } from "@/theme/tones";
import { color, radius, shadow, space } from "@/theme/tokens";

const IST = "Asia/Kolkata";
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
const ago = (iso: string | null, now: number) => {
  if (!iso) return "no signal";
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`;
};
const first = (name: string) => name.split(/\s+/)[0] ?? name;

type Picked = { kind: "alert"; id: string } | { kind: "friend"; id: string } | null;

/**
 * The SOS tab, shaped like the Duty screen: a map of the areas where duties are
 * going on, the colleagues on duty with this guard, and any open SOS — its area
 * blinking red and the guard who raised it marked. Tapping a person (on the map
 * or in the list) shows who they are, how far, and Call / Directions / Open.
 *
 * There is no big button here: the floating red SOS, held for three seconds, is
 * the one way to raise an alert, on every screen.
 */
export function SosMap({ failed }: { failed?: string }) {
  const { profile } = useAuth();
  const live = useLivePosition();
  const { data, refreshing, reload } = useLoader(dutyAreas);
  const [picked, setPicked] = useState<Picked>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [sheetH, setSheetH] = useState(0);
  const [blink, setBlink] = useState(false);
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
  const hasSos = alerts.length > 0;

  // The SOS area pulses while an alert is open.
  useEffect(() => {
    if (!hasSos) return;
    const t = setInterval(() => setBlink((b) => !b), 700);
    return () => clearInterval(t);
  }, [hasSos]);

  const fences: MapFence[] = useMemo(
    () =>
      areas.map((a) => {
        const ring = fenceRing({ id: a.id, name: a.name, lat: a.lat, lng: a.lng, radiusM: a.geofence_radius_m, ring: toRing(a.polygon) });
        if (a.sos) return { id: a.id, name: `SOS · ${a.name}`, ring, tone: color.sos, fill: blink ? 0.42 : 0.12 };
        if (a.mine) return { id: a.id, name: a.name, ring, tone: MAP_COLOR.inside, frame: !hasSos };
        return { id: a.id, name: a.name, ring, tone: "#64748b", quiet: true, frame: !hasSos };
      }),
    [areas, blink, hasSos],
  );

  const people: MapPerson[] = useMemo(() => {
    const out: MapPerson[] = [];
    const raisers = new Set(alerts.map((a) => a.raised_by));
    for (const f of friends) {
      if (f.lat == null || f.lng == null || raisers.has(f.id)) continue;
      out.push({ id: `f:${f.id}`, lat: f.lat, lng: f.lng, label: first(f.name), tone: MAP_COLOR.inside, frame: !hasSos });
    }
    for (const a of alerts) {
      if (a.lat == null || a.lng == null) continue;
      out.push({ id: `a:${a.id}`, lat: a.lat, lng: a.lng, label: `SOS · ${a.mine ? "You" : first(a.raiser_name)}`, tone: color.sos, big: true });
    }
    return out;
  }, [friends, alerts, hasSos]);

  const fix = live.fix;
  const me = fix ? { ...fix, heading: live.heading } : null;
  const alert = picked?.kind === "alert" ? alerts.find((a) => a.id === picked.id) : undefined;
  const friend = picked?.kind === "friend" ? friends.find((f) => f.id === picked.id) : undefined;
  const away = (p: { lat: number | null; lng: number | null }) => (fix && p.lat != null && p.lng != null ? formatDistance(distanceMetres(fix, { lat: p.lat, lng: p.lng })) : null);

  const onPerson = (id: string) => setPicked(id.startsWith("a:") ? { kind: "alert", id: id.slice(2) } : { kind: "friend", id: id.slice(2) });

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <MapCanvas
          fences={fences}
          people={people}
          me={me}
          frameKey={`${frameKey}|${hasSos ? alerts.map((a) => a.id).join(",") : "calm"}|${areas.length}`}
          padding={{ top: 64, right: 24, bottom: sheetH + 16, left: 24 }}
          onPersonPress={onPerson}
        />
      </View>

      {/* What the map is saying, in one pill. */}
      <View style={styles.chipRow} pointerEvents="box-none">
        <View style={[styles.chip, hasSos && styles.chipSos]}>
          <View style={[styles.chipDot, { backgroundColor: hasSos ? "#fff" : color.live }, hasSos && blink && styles.dim]} />
          <Text variant="caption" weight="semibold" tone="inherit" style={{ color: hasSos ? "#fff" : color.foreground }}>
            {hasSos ? `${alerts.length} live SOS` : "All quiet"}
          </Text>
        </View>
      </View>

      <MapSheet
        initial="half"
        onSnap={(_, px) => setSheetH(px)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={color.sos} />}
        floating={
          <View style={styles.floatRow} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show everything"
              onPress={() => setFrameKey((k) => k + 1)}
              style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
            >
              <LocateFixed size={22} color={color.primary} strokeWidth={2.2} />
            </Pressable>
          </View>
        }
        header={
          alert ? (
            <AlertCard a={alert} distance={away(alert)} now={now} onClose={() => setPicked(null)} />
          ) : friend ? (
            <FriendCard f={friend} distance={away(friend)} now={now} onClose={() => setPicked(null)} />
          ) : (
            <View style={styles.gap1}>
              <Text variant="label" weight="semibold" tone={hasSos ? "danger" : "primary"}>
                {hasSos ? "Someone needs help" : "No SOS open"}
              </Text>
              <Text variant="title" weight="semibold">
                {hasSos ? (alerts.length === 1 ? `${alerts[0]!.mine ? "Your SOS" : alerts[0]!.raiser_name} at ${alerts[0]!.site_name}` : `${alerts.length} alerts open`) : "All quiet"}
              </Text>
              <Text variant="caption" tone="muted">
                {hasSos ? "Tap the red marker or a name below for details." : "To raise an SOS, hold the red button for 3 seconds. It works from every screen."}
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
        {alerts.length > 0 && (
          <Panel tone="rose" title="Live SOS" subtitle={`${alerts.length} open`} icon={Siren} bare>
            {alerts.map((a, i) => (
              <Row key={a.id} first={i === 0} onPress={() => setPicked({ kind: "alert", id: a.id })}>
                <View style={[styles.sosDot, blink && styles.dim]}>
                  <Siren size={16} color="#fff" strokeWidth={2.4} />
                </View>
                <View style={styles.flex}>
                  <Text variant="label" weight="semibold" numberOfLines={1}>
                    {a.mine ? "You" : a.raiser_name} · {SOS_KIND_LABEL[a.kind]}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {a.site_name} · {time(a.raised_at)} · {a.responders ? `${a.responders} coming` : SOS_STATUS_LABEL[a.status]}
                  </Text>
                </View>
                <Text variant="caption" weight="semibold" tone="muted">
                  {away(a) ?? ""}
                </Text>
              </Row>
            ))}
          </Panel>
        )}

        <Panel tone="emerald" title="On duty with you" subtitle={friends.length ? `${friends.length} checked in at your sites` : "Nobody else checked in at your sites"} icon={Users} bare>
          {friends.length === 0 && (
            <PanelRow first>
              <Text variant="label" tone="muted">
                Colleagues checked in at your sites appear here and on the map.
              </Text>
            </PanelRow>
          )}
          {friends.map((f, i) => (
            <Row key={f.id} first={i === 0} onPress={() => setPicked({ kind: "friend", id: f.id })}>
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
            </Row>
          ))}
        </Panel>

        <Panel tone="slate" title="Duties going on" subtitle={`${areas.length} ${areas.length === 1 ? "site" : "sites"}`} icon={MapPin} bare>
          {areas.map((a, i) => (
            <AreaRow key={a.id} a={a} first={i === 0} />
          ))}
        </Panel>

        {/* A call and an SMS travel on the mobile network, with no internet at all. */}
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button label="Call office" icon={Phone} variant="outline" fullWidth onPress={() => void Linking.openURL(`tel:${tel(COMPANY.phone)}`)} />
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
        <View style={styles.spacer} />
      </MapSheet>
    </View>
  );
}

function Row({ first, onPress, children }: { first?: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <PanelRow first={first} style={pressed && styles.rowPressed}>
          {children}
          <ChevronRight size={16} color={color.mutedForeground} strokeWidth={2} />
        </PanelRow>
      )}
    </Pressable>
  );
}

function AreaRow({ a, first }: { a: DutyArea; first: boolean }) {
  const t = a.sos ? TONES.rose : a.mine ? TONES.emerald : TONES.slate;
  return (
    <PanelRow first={first}>
      <View style={[styles.areaChip, { backgroundColor: t.chip }]}>
        <MapPin size={16} color={t.chipText} strokeWidth={2} />
      </View>
      <View style={styles.flex}>
        <Text variant="label" weight="semibold" numberOfLines={1}>
          {a.name}
          {a.mine ? <Text variant="caption" tone="primary" weight="semibold">{"  · your site"}</Text> : null}
        </Text>
        <Text variant="caption" tone="muted">
          {a.on_duty} on duty now{a.rostered > a.on_duty ? ` · ${a.rostered} rostered` : ""}
        </Text>
      </View>
      {a.sos && (
        <View style={styles.sosTag}>
          <Text variant="micro" weight="bold" tone="inherit" style={styles.sosTagText}>
            SOS
          </Text>
        </View>
      )}
    </PanelRow>
  );
}

function CardHead({ title, sub, tone, onClose, children }: { title: string; sub: string; tone: string; onClose: () => void; children?: React.ReactNode }) {
  return (
    <View style={styles.cardHead}>
      {children}
      <View style={styles.flex}>
        <Text variant="title" weight="semibold" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" weight="semibold" tone="inherit" style={{ color: tone }} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose} style={styles.close}>
        <X size={18} color={color.foreground} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

function Facts({ items }: { items: [string, string][] }) {
  return (
    <View style={styles.facts}>
      {items.map(([k, v]) => (
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
  );
}

function AlertCard({ a, distance, now, onClose }: { a: MapAlert; distance: string | null; now: number; onClose: () => void }) {
  return (
    <View style={styles.gap3}>
      <CardHead title={a.mine ? "Your SOS" : a.raiser_name} sub={`SOS · ${SOS_KIND_LABEL[a.kind]} · ${SOS_STATUS_LABEL[a.status]}`} tone={color.sos} onClose={onClose}>
        <View style={styles.sosAvatar}>
          <Siren size={20} color="#fff" strokeWidth={2.4} />
        </View>
      </CardHead>
      <Facts
        items={[
          ["Site", a.site_name],
          ["Raised", `${time(a.raised_at)} · ${ago(a.raised_at, now)}`],
          ["Distance", distance ?? "-"],
          ["Coming", String(a.responders)],
        ]}
      />
      {a.note ? (
        <Text variant="caption" tone="muted">
          “{a.note}”
        </Text>
      ) : null}
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button label="Open SOS" icon={Siren} variant="destructive" fullWidth onPress={() => router.push(`/sos/${a.id}`)} />
        </View>
        {!a.mine && a.raiser_phone ? (
          <View style={styles.flex}>
            <Button label="Call" icon={Phone} variant="outline" fullWidth onPress={() => void Linking.openURL(`tel:${tel(a.raiser_phone!)}`)} />
          </View>
        ) : null}
        {!a.mine && a.lat != null && a.lng != null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Directions"
            onPress={() => void Linking.openURL(directionsUrl({ lat: a.lat!, lng: a.lng! }))}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Navigation size={18} color={color.foreground} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function FriendCard({ f, distance, now, onClose }: { f: Friend; distance: string | null; now: number; onClose: () => void }) {
  return (
    <View style={styles.gap3}>
      <CardHead title={f.name} sub={`${f.code} · on duty at ${f.site_name}`} tone={color.primaryInk} onClose={onClose}>
        <Avatar name={f.name} size={40} />
      </CardHead>
      <Facts
        items={[
          ["Checked in", time(f.check_in_at)],
          ["Last heard", f.lat == null ? "No signal" : ago(f.heard_at, now)],
          ["Distance", distance ?? "-"],
          ["Battery", f.battery != null ? `${f.battery}%` : "-"],
        ]}
      />
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
  dim: { opacity: 0.35 },
  spacer: { height: 96 },
  chipRow: { position: "absolute", top: space[3], left: space[3], alignItems: "flex-start" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 30, paddingHorizontal: space[3], borderRadius: radius.full, backgroundColor: color.card, ...shadow.card },
  chipSos: { backgroundColor: color.sos },
  chipDot: { width: 9, height: 9, borderRadius: 5 },
  floatRow: { flexDirection: "row", justifyContent: "flex-end" },
  fab: { width: 52, height: 52, borderRadius: 26, backgroundColor: color.card, alignItems: "center", justifyContent: "center", ...shadow.raised },
  rowPressed: { backgroundColor: color.muted },
  sosDot: { width: 34, height: 34, borderRadius: 17, backgroundColor: color.sos, alignItems: "center", justifyContent: "center" },
  areaChip: { width: 34, height: 34, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  sosTag: { backgroundColor: color.sos, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  sosTagText: { color: "#fff" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space[3] },
  sosAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.sos, alignItems: "center", justifyContent: "center" },
  iconBtn: { width: 44, height: 44, borderRadius: radius.full, borderWidth: 1, borderColor: color.border, backgroundColor: color.card, alignItems: "center", justifyContent: "center" },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: color.muted, alignItems: "center", justifyContent: "center" },
  facts: { flexDirection: "row", flexWrap: "wrap", rowGap: space[2], borderRadius: radius.xl, backgroundColor: color.muted, padding: space[3] },
  fact: { width: "50%", gap: 1 },
});
