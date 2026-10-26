import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { router, usePathname } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Vibration, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SOS_KIND_LABEL } from "@nbss/shared/sos";

import { Nibo } from "@/components/nibo/nibo";
import { Text } from "@/components/text";
import { useLiveFeed } from "@/lib/live-feed";
import { color, radius, shadow, space } from "@/theme/tokens";

const SEEN_KEY = "nbss-sos-seen";
const SIREN = require("../../assets/sounds/sos-siren.wav");

/**
 * The alarm while the app is open: any SOS this person may see and has not opened yet,
 * whoever raised it (a guard, a supervisor, an admin), rings a siren on a loop with a
 * vibration, and Nibo calls it out under the header. Opening the alert, or the guard's
 * SOS tab that shows it, stops both. Their own SOS never rings at them.
 *
 * Loud on purpose: the audio session plays through the silent switch on iOS, and on
 * Android it is media audio, which the ringer's silent mode does not mute. With the app
 * closed, the SOS push does the same job on the "sos" channel (lib/push.ts).
 */
export function SosRinger({ staff = false }: { staff?: boolean }) {
  const feed = useLiveFeed();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [seen, setSeen] = useState<Set<string> | null>(null);

  // Opened before, on this phone: not rung again after a restart.
  useEffect(() => {
    void AsyncStorage.getItem(SEEN_KEY)
      .then((raw) => setSeen(new Set(raw ? (JSON.parse(raw) as string[]) : [])))
      .catch(() => setSeen(new Set()));
  }, []);

  const open = useMemo(() => (feed.data?.alerts ?? []).filter((a) => !a.mine), [feed.data]);

  // Looking at it counts as opened: the alert's own page, or the guard's SOS tab.
  useEffect(() => {
    if (!seen) return;
    const looked = open.filter((a) => pathname === `/sos/${a.id}` || (!staff && pathname === "/alerts")).map((a) => a.id);
    const fresh = looked.filter((id) => !seen.has(id));
    if (fresh.length === 0) return;
    const next = new Set([...seen, ...fresh]);
    // Saved first (only the ones still open are worth keeping), then the ringing stops.
    void AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...next].filter((id) => open.some((a) => a.id === id))))
      .catch(() => undefined)
      .then(() => setSeen(next));
  }, [pathname, open, seen, staff]);

  const ringing = seen ? open.filter((a) => !seen.has(a.id)) : [];
  const loud = ringing.length > 0;

  useEffect(() => {
    if (!loud) return;
    // A player of its own while it rings, released when it stops.
    const player = createAudioPlayer(SIREN);
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "doNotMix", shouldPlayInBackground: true })
      .catch(() => undefined)
      .then(() => {
        player.loop = true;
        player.volume = 1;
        player.play();
      });
    Vibration.vibrate([0, 700, 500], true);
    return () => {
      player.pause();
      player.remove();
      Vibration.cancel();
    };
  }, [loud]);

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.set(withRepeat(withSequence(withTiming(0.55, { duration: 450 }), withTiming(1, { duration: 450 })), -1));
  }, [pulse]);
  const glow = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  if (!loud) return null;
  const a = ringing[0]!;
  const go = () => router.push(`/sos/${a.id}`);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 64 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`SOS from ${a.raiser_name} at ${a.site_name}. Open it.`} onPress={go} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <Animated.View style={[styles.ring, glow]} />
        <View style={styles.nibo}>
          <Nibo size={44} mood="oops" />
        </View>
        <View style={styles.text}>
          <Text variant="micro" weight="bold" tone="inherit" style={styles.eyebrow}>
            {ringing.length > 1 ? `${ringing.length} SOS OPEN` : "SOS · TAP TO OPEN"}
          </Text>
          <Text variant="label" weight="bold" tone="inherit" style={styles.white} numberOfLines={1}>
            {a.raiser_name} needs help
          </Text>
          <Text variant="caption" tone="inherit" style={styles.sub} numberOfLines={1}>
            {a.site_name} · {SOS_KIND_LABEL[a.kind]}
          </Text>
        </View>
        <ChevronRight size={20} color="#ffffff" strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: space[3], right: space[3], zIndex: 1000 },
  card: { flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[2], paddingHorizontal: space[3], borderRadius: radius["2xl"], backgroundColor: color.sos, ...shadow.raised },
  ring: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: radius["2xl"], borderWidth: 3, borderColor: "#fecaca" },
  pressed: { opacity: 0.9 },
  nibo: { width: 48, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden" },
  text: { flex: 1, minWidth: 0, gap: 1 },
  eyebrow: { color: "#fecaca", letterSpacing: 1 },
  white: { color: "#ffffff" },
  sub: { color: "rgba(255,255,255,0.85)" },
});
