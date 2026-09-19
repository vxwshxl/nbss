import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { distanceMetres, formatDistance } from "@nbss/shared/geo";
import { SOS_KIND_LABEL, SOS_STATUS_LABEL, isLive, type SosKind, type SosStatus } from "@nbss/shared/sos";
import { siteChannel, EVENTS } from "@nbss/shared/realtime";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { useAuth } from "@/lib/auth";
import { acknowledgeSos, closeSos } from "@/lib/duty";
import { currentFix } from "@/lib/location";
import { supabase } from "@/lib/supabase";
import { color, radius, space } from "@/theme/tokens";

type Alert = {
  id: string;
  site_id: string;
  raised_by: string;
  kind: SosKind;
  note: string | null;
  lat: number | null;
  lng: number | null;
  status: SosStatus;
  raised_at: string;
  raiser_name: string | null;
  site_name: string | null;
};

type Responder = { name: string; response: string; distanceM: number | null };

/**
 * The alarm.
 *
 * Deliberately the least decorated screen in the app. Everything on it is either
 * information somebody running towards a colleague needs, or a button they will press —
 * there is no navigation, no tab bar, and the route is declared `gestureEnabled: false`
 * so it cannot be swiped away by a hand that is busy.
 *
 * Two audiences see it and they need opposite things. The guard who raised it needs to
 * know somebody is coming and to be able to stand it down. Everybody else needs to know
 * where to go and to be able to say they are on their way. The same screen answers both
 * because in an emergency there is no time to have learnt two.
 */
export function SosAlarm({ alertId }: { alertId: string }) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();

  const [alert, setAlert] = useState<Alert | null | undefined>(undefined);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [myDistance, setMyDistance] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const pulse = useSharedValue(0);
  const buzzed = useRef(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("sos_alerts")
      .select("*, profiles!sos_alerts_raised_by_fkey(full_name), sites(name)")
      .eq("id", alertId)
      .maybeSingle();

    if (!data) {
      setAlert(null);
      return;
    }

    const { profiles, sites, ...row } = data as typeof data & {
      profiles?: { full_name: string } | { full_name: string }[] | null;
      sites?: { name: string } | { name: string }[] | null;
    };
    const raiser = Array.isArray(profiles) ? profiles[0] : profiles;
    const site = Array.isArray(sites) ? sites[0] : sites;

    setAlert({
      ...(row as Omit<Alert, "raiser_name" | "site_name">),
      raiser_name: raiser?.full_name ?? null,
      site_name: site?.name ?? null,
    });

    const { data: acks } = await supabase
      .from("sos_acknowledgements")
      .select("response, distance_m, profiles(full_name)")
      .eq("alert_id", alertId);

    setResponders(
      (acks ?? []).map((ack) => {
        const who = Array.isArray(ack.profiles) ? ack.profiles[0] : ack.profiles;
        return {
          name: who?.full_name ?? "Someone",
          response: ack.response,
          distanceM: ack.distance_m,
        };
      }),
    );
  }, [alertId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Live updates, over the site's own channel.
   *
   * `raise_sos`, `acknowledge_sos` and `close_sos` all publish to `site:<id>`, so the
   * screen learns that somebody answered without polling. The channel is private and
   * `may_read_site_channel` in 0005 decides who may hear it — staff, and any guard
   * currently punched in at that site.
   */
  useEffect(() => {
    if (!alert?.site_id) return;

    const channel = supabase
      .channel(siteChannel(alert.site_id), { config: { private: true } })
      .on("broadcast", { event: EVENTS.sos }, () => {
        void load();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [alert?.site_id, load]);

  /** How far this phone is from the alert, so the responder list can be honest. */
  useEffect(() => {
    if (!alert?.lat || !alert?.lng) return;
    void currentFix().then((fix) => {
      if (!fix) return;
      setMyDistance(
        distanceMetres(
          { lat: alert.lat as number, lng: alert.lng as number },
          { lat: fix.coords.latitude, lng: fix.coords.longitude },
        ),
      );
    });
  }, [alert?.lat, alert?.lng]);

  // The background breathes while the alarm is live and stops when it is closed, so the
  // screen's state is legible from across a room.
  const live = alert ? isLive(alert.status) : false;

  useEffect(() => {
    if (!live) {
      pulse.value = withTiming(0, { duration: 300 });
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [live, pulse]);

  // One heavy buzz on arrival, not a loop. The push that brought the phone here already
  // played the alarm sound; a second continuous vibration just makes the screen hard to
  // read and drains a battery that may be needed.
  useEffect(() => {
    if (!live || buzzed.current) return;
    buzzed.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [live]);

  const backgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: pulse.value > 0.5 ? color.sos : color.sosDeep,
    opacity: 1,
  }));

  if (alert === undefined) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: color.sosDeep }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (alert === null) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: color.appBg, paddingTop: insets.top }]}>
        <Text variant="bodyLarge" semibold>
          That alert is not available.
        </Text>
        <Text variant="caption" tone="muted" style={styles.centered}>
          It may have been closed, or it was not sent to you.
        </Text>
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const mine = alert.raised_by === profile?.id;
  const iResponded = responders.some((r) => r.name === profile?.full_name);

  return (
    <Animated.View style={[styles.root, live ? backgroundStyle : styles.closed]}>
      <View style={[styles.content, { paddingTop: insets.top + space[8], paddingBottom: insets.bottom + space[6] }]}>
        <View style={styles.top}>
          <Text variant="micro" tone="inverse" bold style={styles.eyebrow}>
            {live ? "EMERGENCY" : SOS_STATUS_LABEL[alert.status].toUpperCase()}
          </Text>

          <Text variant="hero" tone="inverse" bold>
            {SOS_KIND_LABEL[alert.kind]}
          </Text>

          <Text variant="bodyLarge" tone="inverse" semibold>
            {mine ? "You raised this" : (alert.raiser_name ?? "A guard")}
          </Text>
          <Text variant="body" tone="inverse">
            {alert.site_name ?? "Unknown site"}
            {myDistance !== null && !mine ? ` · ${formatDistance(myDistance)} from you` : ""}
          </Text>

          <Text variant="caption" tone="inverse" mono style={styles.dim}>
            {new Date(alert.raised_at).toLocaleTimeString("en-IN", {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
              timeZone: "Asia/Kolkata",
            })}{" "}
            IST
          </Text>

          {alert.note && (
            <View style={styles.note}>
              <Text variant="body" tone="inverse">
                “{alert.note}”
              </Text>
            </View>
          )}
        </View>

        {/* ───────────────────────────────────────────── who is coming */}
        <View style={styles.responders}>
          <Text variant="micro" tone="inverse" bold style={styles.eyebrow}>
            {responders.length === 0 ? "NOBODY HAS ANSWERED YET" : "RESPONDING"}
          </Text>
          {responders.map((responder) => (
            <Text key={responder.name} variant="body" tone="inverse" medium>
              {responder.name}
              {responder.distanceM !== null ? ` · ${formatDistance(responder.distanceM)} away` : ""}
              {responder.response === "cannot_respond" ? " · cannot come" : ""}
            </Text>
          ))}
        </View>

        {/* ───────────────────────────────────────────────── the actions */}
        <View style={styles.actions}>
          {live && !mine && !iResponded && (
            <>
              <Button
                label="I am on the way"
                size="lg"
                loading={busy === "ack"}
                onPress={async () => {
                  setBusy("ack");
                  await acknowledgeSos(alertId, "responding");
                  setBusy(null);
                  await load();
                }}
              />
              <Button
                label="I cannot come"
                variant="secondary"
                loading={busy === "no"}
                onPress={async () => {
                  setBusy("no");
                  // Recorded rather than ignored, and it does not stop the alarm — the
                  // control room needs to know this person is accounted for and is not
                  // one of the people arriving.
                  await acknowledgeSos(alertId, "cannot_respond");
                  setBusy(null);
                  await load();
                }}
              />
            </>
          )}

          {live && (mine || profile?.role === "admin" || profile?.role === "supervisor") && (
            <>
              <Button
                label="Situation resolved"
                variant="secondary"
                loading={busy === "resolved"}
                onPress={async () => {
                  setBusy("resolved");
                  await closeSos(alertId, "resolved");
                  setBusy(null);
                  await load();
                }}
              />
              <Button
                label="False alarm — stand down"
                variant="secondary"
                loading={busy === "false"}
                onPress={async () => {
                  setBusy("false");
                  await closeSos(alertId, "false_alarm");
                  setBusy(null);
                  await load();
                }}
              />
            </>
          )}

          {!live && (
            <Button
              label="Close"
              variant="secondary"
              onPress={() => {
                // `dismissTo` rather than `back`: the phone may have arrived here from a
                // cold start with nothing behind it, and `back` would leave a blank.
                if (router.canGoBack()) router.back();
                else router.replace("/");
              }}
            />
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  closed: { backgroundColor: color.appBg },
  center: { alignItems: "center", justifyContent: "center", gap: space[3], padding: space[6] },
  centered: { textAlign: "center" },
  content: { flex: 1, paddingHorizontal: space[5], gap: space[6] },
  top: { gap: space[1] },
  eyebrow: { letterSpacing: 1.2, opacity: 0.85 },
  dim: { opacity: 0.8 },
  note: {
    marginTop: space[3],
    padding: space[3],
    borderRadius: radius.lg,
    backgroundColor: "#ffffff22",
  },
  responders: { gap: space[1] },
  actions: { marginTop: "auto", gap: space[3] },
});
