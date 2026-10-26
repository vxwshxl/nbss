import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ArrowLeft, BellOff, CheckCircle2, LocateFixed, MapPin, Navigation, Phone, Siren, UserRoundX } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { distanceMetres, formatDistance, toRing } from "@nbss/shared/geo";
import { isStaff } from "@nbss/shared/identity";
import { siteChannel, EVENTS } from "@nbss/shared/realtime";
import { SOS_KIND_LABEL, SOS_STATUS_LABEL, isLive, type SosKind, type SosStatus } from "@nbss/shared/sos";

import { Button } from "@/components/button";
import { SolidButton } from "@/components/solid-button";
import { circleRing } from "@/components/live-map/shared";
import { MapCanvas, type MapFence, type MapPerson } from "@/components/map-canvas";
import { MapSheet } from "@/components/map-sheet";
import { Text } from "@/components/text";
import { useLivePosition } from "@/hooks/use-live-position";
import { useLoader } from "@/hooks/use-loader";
import { useNow } from "@/hooks/use-now";
import { useAuth } from "@/lib/auth";
import { useOptionalLiveFeed } from "@/lib/live-feed";
import { acknowledgeSos, closeSos, directionsUrl } from "@/lib/duty";
import { supabase } from "@/lib/supabase";
import { color, radius, shadow, space } from "@/theme/tokens";

type Person = {
  id: string;
  name: string;
  phone: string | null;
  role: "raiser" | "responder" | "guard" | "staff";
  response: "responding" | "on_scene" | "cannot_respond" | null;
  lat: number | null;
  lng: number | null;
  heard_at: string | null;
  distance_m: number | null;
};

type SosMap = {
  alert: {
    id: string;
    status: SosStatus;
    kind: SosKind;
    note: string | null;
    lat: number | null;
    lng: number | null;
    raised_at: string;
    raised_by: string;
    closing_note: string | null;
  };
  site: { id: string; name: string; lat: number; lng: number; radius_m: number; polygon: unknown };
  people: Person[];
};

const RESPONSE_LABEL: Record<NonNullable<Person["response"]>, string> = {
  responding: "On the way",
  on_scene: "On scene",
  cannot_respond: "Can't come",
};

const TONE = { sos: color.sos, help: "#059669", guard: "#64748b" };

const IST = "Asia/Kolkata";
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
const first = (name: string) => name.split(" ")[0] ?? name;

/**
 * The SOS, as a map.
 *
 * Everyone who matters to this alert is on it: the guard who raised it (red), the
 * people answering (green, with how far away they are — the nearest help first),
 * the other guards on the site (grey) and you (blue). The sheet below says who is
 * coming and has the one or two buttons this person needs; it refreshes every ten
 * seconds and the moment anyone answers.
 *
 * Still not swipe-dismissable (the route is `gestureEnabled: false`), but there is a
 * Back button: a responder may need to open Directions or the dialler and come back.
 */
export type SosChoice = { id: string; who: string; site: string };

export function SosAlarm({
  alertId,
  embedded = false,
  choices = [],
  onChoose,
}: {
  alertId: string;
  embedded?: boolean;
  /** Every open SOS, when there is more than one: listed at the top of the sheet to switch between. */
  choices?: SosChoice[];
  onChoose?: (id: string) => void;
}) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const live = useLivePosition();
  const now = useNow(15_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [sheetH, setSheetH] = useState(0);
  const buzzed = useRef(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("sos_map", { p_alert_id: alertId });
    return (data as unknown as SosMap | null) ?? null;
  }, [alertId]);
  const { data, reload, refresh, refreshing } = useLoader(load);

  // The site's channel (raise, answer, close) for an instant refresh, and a slow
  // re-read behind it for responders moving towards the alert.
  const siteId = data?.site.id;
  useEffect(() => {
    if (!siteId) return;
    const channel = supabase
      .channel(siteChannel(siteId), { config: { private: true } })
      .on("broadcast", { event: EVENTS.sos }, () => void reload())
      .subscribe();
    // Responders walking towards the alert: their positions come in 15 s batches.
    const t = setInterval(() => void reload(), 30_000);
    return () => {
      clearInterval(t);
      void supabase.removeChannel(channel);
    };
  }, [siteId, reload]);

  // In the guard app the live feed hears about every answer and close on the guard's
  // own channel (on duty or not); this screen follows it.
  const feed = useOptionalLiveFeed();
  const feedData = feed?.data;
  useEffect(() => {
    if (feedData) void reload();
  }, [feedData, reload]);

  const alert = data?.alert;
  const isOpen = alert ? isLive(alert.status) : false;
  useEffect(() => {
    if (!isOpen || buzzed.current) return;
    buzzed.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  }, [isOpen]);

  const people = useMemo(() => data?.people ?? [], [data]);
  const raiser = people.find((p) => p.role === "raiser") ?? null;
  const responders = people.filter((p) => p.role === "responder");
  const coming = responders.filter((p) => p.response !== "cannot_respond");
  const others = people.filter((p) => p.role === "guard" || p.role === "staff");
  const me = profile ? people.find((p) => p.id === profile.id) : undefined;

  const fix = live.fix;
  const where = alert?.lat != null && alert.lng != null ? { lat: alert.lat, lng: alert.lng } : raiser?.lat != null && raiser.lng != null ? { lat: raiser.lat, lng: raiser.lng } : null;
  const myDistance = fix && where ? distanceMetres(where, fix) : null;

  const fences: MapFence[] = useMemo(() => {
    if (!data) return [];
    const ring = toRing(data.site.polygon);
    return [
      {
        id: data.site.id,
        name: data.site.name,
        ring: ring && ring.length > 2 ? (ring as [number, number][]) : circleRing({ lat: data.site.lat, lng: data.site.lng }, data.site.radius_m),
        tone: isOpen ? color.sos : color.primary,
      },
    ];
  }, [data, isOpen]);

  const markers: MapPerson[] = useMemo(() => {
    const out: MapPerson[] = [];
    for (const p of people) {
      if (p.lat == null || p.lng == null) continue;
      // You are the blue dot; the raiser stays a red pin even when it is you.
      if (p.id === profile?.id && p.role !== "raiser") continue;
      const tone = p.role === "raiser" ? TONE.sos : p.role === "responder" && p.response !== "cannot_respond" ? TONE.help : TONE.guard;
      const label =
        p.role === "raiser"
          ? `SOS · ${first(p.name)}`
          : p.role === "responder" && p.response !== "cannot_respond"
            ? `${first(p.name)}${p.distance_m != null ? ` · ${formatDistance(p.distance_m)}` : ""}`
            : first(p.name);
      out.push({ id: p.id, lat: p.lat, lng: p.lng, tone, label });
    }
    return out;
  }, [people, profile?.id]);

  if (data === undefined) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={color.sos} />
      </View>
    );
  }
  if (!data || !alert) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Text weight="semibold" variant="bodyLarge">
          That alert is not available.
        </Text>
        <Text variant="caption" tone="muted" style={styles.centred}>
          It may have been closed, or it was not sent to you.
        </Text>
        <Button label="Back" variant="secondary" onPress={leave} />
      </View>
    );
  }

  const mine = alert.raised_by === profile?.id;
  const canClose = isOpen && (mine || (profile ? isStaff(profile.role) : false));
  const answered = me?.response ?? null;

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    await fn();
    setBusy(null);
    await reload();
  };

  const statusLine = !isOpen
    ? `${SOS_STATUS_LABEL[alert.status]}${alert.closing_note ? ` · ${alert.closing_note}` : ""}`
    : coming.length === 0
      ? "Waiting for someone to answer"
      : `${coming.length} ${coming.length === 1 ? "person" : "people"} coming${coming[0]?.distance_m != null ? ` · nearest ${formatDistance(coming[0].distance_m)}` : ""}`;

  return (
    <View style={styles.root}>
      <MapCanvas
        fences={fences}
        people={markers}
        me={fix ? { ...fix, heading: live.heading } : null}
        frameKey={`sos|${frame}`}
        padding={{ top: (embedded ? 0 : insets.top) + 90, right: 40, bottom: Math.min(sheetH, 460) + 24, left: 40 }}
      />

      {/* The banner: what, where, since when — readable at arm's length. */}
      <View style={[styles.banner, { top: (embedded ? 0 : insets.top) + space[2] }]} pointerEvents="box-none">
        {!embedded && (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={leave} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <ArrowLeft size={20} color={color.foreground} strokeWidth={2.2} />
          </Pressable>
        )}
        <View style={[styles.pill, { backgroundColor: isOpen ? color.sos : color.card }]}>
          <Siren size={18} color={isOpen ? "#fff" : color.mutedForeground} strokeWidth={2.2} />
          <View style={styles.flex}>
            <Text variant="label" weight="bold" numberOfLines={1} style={{ color: isOpen ? "#fff" : color.foreground }}>
              SOS · {SOS_KIND_LABEL[alert.kind]} · {data.site.name}
            </Text>
            <Text variant="caption" numberOfLines={1} style={{ color: isOpen ? "#ffffffd9" : color.mutedForeground }}>
              {isOpen ? `Raised ${clock(alert.raised_at)} · ${Math.max(0, Math.round((now - new Date(alert.raised_at).getTime()) / 60_000))} min ago` : SOS_STATUS_LABEL[alert.status]}
            </Text>
          </View>
        </View>
      </View>

      <MapSheet
        initial="half"
        onSnap={(_, px) => setSheetH(px)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={color.sos} />}
        floating={
          <View style={styles.floatRow} pointerEvents="box-none">
            <Pressable accessibilityRole="button" accessibilityLabel="Show everyone" onPress={() => setFrame((n) => n + 1)} style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
              <LocateFixed size={22} color={color.sos} strokeWidth={2.2} />
            </Pressable>
          </View>
        }
        header={
          <View style={styles.headGap}>
            {choices.length > 1 && (
              <View style={styles.choices}>
                <Text variant="micro" weight="bold" tone="muted" uppercase>
                  {choices.length} SOS open · tap to switch
                </Text>
                {choices.map((c) => {
                  const on = c.id === alertId;
                  return (
                    <Pressable
                      key={c.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => onChoose?.(c.id)}
                      style={({ pressed }) => [styles.choice, on && styles.choiceOn, pressed && styles.pressed]}
                    >
                      <View style={[styles.choiceDot, on && styles.choiceDotOn]} />
                      <View style={styles.flex}>
                        <Text variant="label" weight="bold" numberOfLines={1}>
                          {c.who}
                        </Text>
                        <Text variant="caption" tone="muted" numberOfLines={2}>
                          {c.site}
                        </Text>
                      </View>
                      {on && (
                        <Text variant="micro" weight="bold" tone="inherit" style={styles.choiceTag}>
                          SHOWING
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
            <Text variant="title" weight="semibold" numberOfLines={1}>
              {mine ? "You raised this SOS" : `${raiser?.name ?? "A guard"} needs help`}
            </Text>
            <Text variant="label" weight="semibold" style={{ color: isOpen ? (coming.length ? TONE.help : color.sos) : color.mutedForeground }}>
              {statusLine}
            </Text>
            {!mine && myDistance !== null && (
              <Text variant="caption" tone="muted">
                {formatDistance(myDistance)} from you
              </Text>
            )}
            {alert.note && (
              <Text variant="body" style={styles.note}>
                “{alert.note}”
              </Text>
            )}

            <View style={styles.actions}>
              {isOpen && !mine && answered === null && (
                <>
                  <View style={styles.flex}>
                    <Button label="I'm on the way" icon={Navigation} fullWidth loading={busy === "go"} onPress={() => void act("go", () => acknowledgeSos(alertId, "responding"))} />
                  </View>
                  <View style={styles.flex}>
                    <Button label="Can't come" icon={UserRoundX} variant="outline" fullWidth loading={busy === "no"} onPress={() => void act("no", () => acknowledgeSos(alertId, "cannot_respond"))} />
                  </View>
                </>
              )}
              {isOpen && !mine && answered === "responding" && (
                <>
                  <View style={styles.flex}>
                    <Button label="I'm on scene" icon={MapPin} fullWidth loading={busy === "here"} onPress={() => void act("here", () => acknowledgeSos(alertId, "on_scene"))} />
                  </View>
                  {where && (
                    <View style={styles.flex}>
                      <Button label="Directions" icon={Navigation} variant="outline" fullWidth onPress={() => void Linking.openURL(directionsUrl(where))} />
                    </View>
                  )}
                </>
              )}
            </View>
            {isOpen && mine && (
              <View style={styles.closeBox}>
                <Text variant="micro" weight="bold" tone="muted" uppercase>
                  Safe now?
                </Text>
                <HoldToCancel busy={busy === "false"} onDone={() => void act("false", () => closeSos(alertId, "false_alarm"))} />
              </View>
            )}
            {canClose && !mine && (
              <View style={styles.closeBox}>
                <Text variant="micro" weight="bold" tone="muted" uppercase>
                  Close this alert
                </Text>
                <View style={styles.closeRow}>
                  <SolidButton label="Resolved" icon={CheckCircle2} tone="green" loading={busy === "resolved"} disabled={!!busy} onPress={() => void act("resolved", () => closeSos(alertId, "resolved"))} />
                  <SolidButton label="False alarm" icon={BellOff} tone="amber" loading={busy === "false"} disabled={!!busy} onPress={() => void act("false", () => closeSos(alertId, "false_alarm"))} />
                </View>
              </View>
            )}
          </View>
        }
      >
        {raiser && !mine && <PersonRow p={raiser} highlight="sos" />}

        <Section title={`Responding · ${responders.length}`}>
          {responders.length === 0 ? (
            <Text variant="body" tone="muted">
              Nobody has answered yet. Everyone on duty here, every supervisor and the client have been alerted.
            </Text>
          ) : (
            responders.map((p) => <PersonRow key={p.id} p={p} highlight={p.response === "cannot_respond" ? undefined : "help"} you={p.id === profile?.id} />)
          )}
        </Section>

        {others.length > 0 && (
          <Section title={`Also on site · ${others.length}`}>
            {others.map((p) => (
              <PersonRow key={p.id} p={p} you={p.id === profile?.id} />
            ))}
          </Section>
        )}
      </MapSheet>
    </View>
  );
}

const CANCEL_MS = 3000;

/**
 * The raiser's way out: hold for three seconds to cancel their own SOS (recorded as
 * a false alarm). A hold, not a tap, so it cannot be cancelled by accident while
 * running; the bar fills while held and empties if let go early.
 */
function HoldToCancel({ busy, onDone }: { busy: boolean; onDone: () => void }) {
  const fill = useSharedValue(0);
  const done = useRef(false);
  const bar = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Hold for three seconds to cancel your SOS"
      disabled={busy}
      delayLongPress={CANCEL_MS}
      onPressIn={() => {
        done.current = false;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        fill.set(withTiming(1, { duration: CANCEL_MS, easing: Easing.linear }));
      }}
      onPressOut={() => {
        if (done.current) return;
        cancelAnimation(fill);
        fill.set(withTiming(0, { duration: 180 }));
      }}
      onLongPress={() => {
        done.current = true;
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        onDone();
      }}
      style={styles.cancel}
    >
      <Animated.View style={[styles.cancelFill, bar]} />
      {busy ? <ActivityIndicator color="#fff" /> : <BellOff size={20} color="#fff" strokeWidth={2.4} />}
      <Text variant="label" weight="bold" tone="inherit" style={styles.closeText}>
        {busy ? "Cancelling…" : "Hold 3s to cancel my SOS"}
      </Text>
    </Pressable>
  );
}

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

function PersonRow({ p, highlight, you }: { p: Person; highlight?: "sos" | "help"; you?: boolean }) {
  const tone = highlight === "sos" ? TONE.sos : highlight === "help" ? TONE.help : TONE.guard;
  const sub = [
    p.role === "raiser" ? "Raised the SOS" : p.response ? RESPONSE_LABEL[p.response] : null,
    p.distance_m != null && p.role !== "raiser" ? `${formatDistance(p.distance_m)} away` : null,
    p.heard_at ? `seen ${clock(p.heard_at)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={[styles.row, highlight && { backgroundColor: `${tone}14`, borderColor: `${tone}55` }]}>
      <View style={[styles.avatar, { backgroundColor: tone }]}>
        <Text variant="caption" weight="bold" tone="inverse">
          {p.name
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </Text>
      </View>
      <View style={styles.flex}>
        <Text variant="label" weight="semibold" numberOfLines={1}>
          {p.name}
          {you ? " (you)" : ""}
        </Text>
        <Text variant="caption" numberOfLines={1} style={{ color: highlight ? tone : color.mutedForeground }}>
          {sub || "On duty here"}
        </Text>
        {p.phone && !you ? (
          <Text variant="caption" weight="semibold" mono numberOfLines={1} selectable>
            {p.phone}
          </Text>
        ) : null}
      </View>
      {p.phone && !you && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Call ${p.name}`} onPress={() => void Linking.openURL(`tel:${p.phone}`)} style={({ pressed }) => [styles.call, pressed && styles.pressed]}>
          <Phone size={18} color={color.primaryInk} strokeWidth={2.2} />
        </Pressable>
      )}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="eyebrow" weight="bold" tone="muted" uppercase>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.appBg },
  center: { alignItems: "center", justifyContent: "center", gap: space[3], padding: space[6] },
  centred: { textAlign: "center" },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.75 },

  banner: { position: "absolute", left: space[3], right: space[3], flexDirection: "row", alignItems: "center", gap: space[2] },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.card, alignItems: "center", justifyContent: "center", ...shadow.raised },
  pill: { flex: 1, flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 52, paddingHorizontal: space[3], borderRadius: radius.xl, ...shadow.raised },

  floatRow: { flexDirection: "row", justifyContent: "flex-end" },
  fab: { width: 52, height: 52, borderRadius: 26, backgroundColor: color.card, alignItems: "center", justifyContent: "center", ...shadow.raised },

  headGap: { gap: 4 },
  choices: { gap: space[2], marginBottom: space[3], paddingBottom: space[3], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  choice: { flexDirection: "row", alignItems: "center", gap: space[3], padding: space[3], borderRadius: radius.xl, borderWidth: 1, borderColor: color.border, backgroundColor: color.card },
  choiceOn: { borderColor: color.sos, backgroundColor: "#fff1f2" },
  choiceDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: color.sos },
  choiceDotOn: { backgroundColor: color.sos },
  choiceTag: { color: color.sos, letterSpacing: 0.6 },
  note: { marginTop: space[1], fontStyle: "italic" },
  actions: { flexDirection: "row", gap: space[2], marginTop: space[3] },
  closeBox: { marginTop: space[4], gap: space[2], padding: space[3], borderRadius: radius.xl, backgroundColor: color.muted },
  closeRow: { flexDirection: "row", gap: space[2] },
  closeText: { color: "#fff" },
  cancel: { minHeight: 56, borderRadius: radius.full, backgroundColor: "#d97706", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2], overflow: "hidden" },
  cancelFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#92400e" },

  section: { gap: space[2] },
  row: { flexDirection: "row", alignItems: "center", gap: space[3], padding: space[3], borderRadius: radius.xl, borderWidth: 1, borderColor: color.lineSoft, backgroundColor: color.card },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  call: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: color.accent },
});
