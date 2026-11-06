import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { Check, Crosshair, LocateFixed, MapPinPlus, Send, Trash2, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { color, radius, space } from "@/theme/tokens";

import { Button } from "./button";
import { showDialog } from "./dialog";
import { MapCanvas } from "./map-canvas";
import { Field } from "./field";
import { Panel } from "./panel";
import { Text } from "./text";

/** The server refuses a fix looser than this (send_location_pin, 0073). */
const MAX_ACCURACY_M = 100;
/** Good enough to stop looking: a building's gate, not the street. */
const GOOD_ACCURACY_M = 15;
/** How long the phone keeps improving the fix before it settles for the best one. */
const LOOK_FOR_MS = 45_000;

type Fix = { lat: number; lng: number; accuracy: number; at: number; mocked: boolean };
type Sent = { id: string; note: string | null; lat: number; lng: number; accuracy_m: number; created_at: string; site: { name: string } | null };

/** The last few pins this person sent, newest first. */
async function fetchSent(me: string): Promise<Sent[]> {
  const { data } = await supabase
    .from("location_pins")
    .select("id, note, lat, lng, accuracy_m, created_at, site:sites(name)")
    .eq("sent_by", me)
    .order("created_at", { ascending: false })
    .limit(5);
  type Row = Omit<Sent, "site"> & { site: Sent["site"] | Sent["site"][] };
  return ((data ?? []) as unknown as Row[]).map((r) => ({ ...r, site: Array.isArray(r.site) ? (r.site[0] ?? null) : r.site }));
}

/**
 * "Pin my location": the place this phone is standing, sent to the office so a site
 * can be registered there. For the sites that are hard to find on a map (a new
 * campus, a gate down an unnamed lane).
 *
 * The pin is always the phone's own GPS fix, never a point picked on a map: the
 * phone watches its position for up to 45 seconds, keeps the most precise fix, and
 * sends that. A fix the phone itself reports as mocked is refused, here and by the
 * server. Several can be sent; each can be deleted until a site is registered on it.
 */
export function LocationPinCard() {
  const { profile } = useAuth();
  const [phase, setPhase] = useState<"idle" | "locating" | "sending">("idle");
  const [fix, setFix] = useState<Fix | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<Sent[]>([]);
  const watch = useRef<Location.LocationSubscription | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [settled, setSettled] = useState(false);
  // Pressing "centre" bumps this, which re-frames the map on the fix.
  const [recentre, setRecentre] = useState(0);

  const me = profile?.id ?? null;
  const load = useCallback(async () => {
    if (me) setSent(await fetchSent(me));
  }, [me]);

  useEffect(() => {
    if (!me) return;
    let live = true;
    void fetchSent(me).then((rows) => live && setSent(rows));
    return () => {
      live = false;
    };
  }, [me]);

  const stopWatching = useCallback(() => {
    watch.current?.remove();
    watch.current = null;
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
  }, []);

  useEffect(() => stopWatching, [stopWatching]);

  async function start() {
    const services = await Location.hasServicesEnabledAsync().catch(() => true);
    if (!services) {
      showDialog("Location is off", "Turn on location for this phone, then try again.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    const perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
    if (!perm?.granted) {
      showDialog("Location not allowed", "Allow location for NBSS Kokrajhar to send where you are.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    setFix(null);
    setSettled(false);
    setPhase("locating");
    void Haptics.selectionAsync();
    stopWatching();
    watch.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0, mayShowUserSettingsDialog: true },
      (l) => {
        const next: Fix = {
          lat: l.coords.latitude,
          lng: l.coords.longitude,
          accuracy: l.coords.accuracy ?? 9999,
          at: l.timestamp,
          mocked: !!l.mocked,
        };
        setFix((best) => (!best || next.mocked || next.accuracy <= best.accuracy || Date.now() - best.at > 20_000 ? next : best));
        if (next.accuracy <= GOOD_ACCURACY_M && !next.mocked) {
          setSettled(true);
          stopWatching();
        }
      },
    );
    stopTimer.current = setTimeout(() => {
      setSettled(true);
      stopWatching();
    }, LOOK_FOR_MS);
  }

  function cancel() {
    stopWatching();
    setPhase("idle");
    setFix(null);
    setNote("");
  }

  async function send() {
    if (!fix) return;
    setPhase("sending");
    stopWatching();
    const { error } = await supabase.rpc("send_location_pin", {
      p_lat: fix.lat,
      p_lng: fix.lng,
      p_accuracy_m: Math.round(fix.accuracy * 10) / 10,
      // The fix's age by the phone's own clock, so a phone set to the wrong time cannot misdate it.
      p_age_s: Math.max(0, Math.round((Date.now() - fix.at) / 1000)),
      p_note: note.trim() || undefined,
      p_mocked: fix.mocked,
    });
    if (error) {
      setPhase("locating");
      // A fix that went stale while the note was typed: look again.
      if (/out of date/i.test(error.message)) void start();
      showDialog("Not sent", error.message);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase("idle");
    setFix(null);
    setNote("");
    showDialog("Location sent", "The office can now see this place on the map and register a site here.");
    void load();
  }

  function remove(pin: Sent) {
    showDialog("Delete this pin?", pin.note ?? "The location you sent is removed.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("location_pins").delete().eq("id", pin.id);
          if (error) showDialog("Not deleted", error.message);
          void load();
        },
      },
    ]);
  }

  const usable = !!fix && !fix.mocked && fix.accuracy <= MAX_ACCURACY_M;

  return (
    <Panel tone="amber" title="Pin my location" icon={MapPinPlus}>
      {phase === "idle" ? (
        <View style={styles.gap}>
          <Text variant="label" tone="muted">
            Standing at a site that is hard to find on a map? Send where you are now, and the office can register the site here.
          </Text>
          <Button label="Pin my location" icon={LocateFixed} onPress={() => void start()} fullWidth />
        </View>
      ) : (
        <View style={styles.gap}>
          <View style={styles.fixRow}>
            {phase === "sending" || (phase === "locating" && !settled) ? (
              <ActivityIndicator color={color.primary} />
            ) : (
              <Check size={18} color={usable ? color.primary : color.destructive} strokeWidth={2.4} />
            )}
            <View style={styles.flex}>
              <Text variant="label" weight="semibold">
                {!fix
                  ? "Finding where you are…"
                  : fix.mocked
                    ? "This phone reports a fake location"
                    : `GPS ±${Math.round(fix.accuracy)} m`}
              </Text>
              <Text variant="caption" tone="muted">
                {!fix
                  ? "Stay still, in the open if you can."
                  : fix.mocked
                    ? "Turn off any mock-location app. Only the phone's real position can be sent."
                    : fix.accuracy > MAX_ACCURACY_M
                      ? "Not precise enough yet. Step outside, away from walls."
                      : settled
                        ? `${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)}`
                        : "Getting more precise… you can send now."}
              </Text>
            </View>
          </View>
          {fix && !fix.mocked && (
            <View style={styles.map}>
              {/* Drag and pinch to look around; the map moves itself only when the fix
                  first arrives, when it settles, and on "centre". */}
              <MapCanvas
                showsUserLocation
                pins={[
                  // What Send sends, red; the ones already sent, amber until a site is registered on them.
                  { id: "fix", lat: fix.lat, lng: fix.lng, color: "#dc2626", title: "This location", accuracyM: fix.accuracy },
                  ...sent.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, color: p.site ? color.primary : "#d97706", title: p.note ?? "Sent earlier", frame: false })),
                ]}
                frameKey={`${settled ? 1 : 0}-${recentre}`}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Centre the map on me"
                hitSlop={6}
                onPress={() => setRecentre((n) => n + 1)}
                style={styles.centre}
              >
                <Crosshair size={18} color={color.primaryInk} strokeWidth={2.2} />
              </Pressable>
            </View>
          )}
          <Field label="What is here? (optional)" value={note} onChangeText={setNote} placeholder="Main gate, AieAfa Hospital" maxLength={200} />
          <View style={styles.row}>
            <Button label="Cancel" variant="outline" icon={X} onPress={cancel} style={styles.flex} disabled={phase === "sending"} />
            <Button label="Send" icon={Send} onPress={() => void send()} style={styles.flex} disabled={!usable} loading={phase === "sending"} />
          </View>
          {settled && !usable && fix && !fix.mocked && <Button label="Try again" variant="ghost" onPress={() => void start()} />}
        </View>
      )}

      {sent.length > 0 && (
        <View style={styles.sent}>
          <Text variant="caption" weight="semibold" tone="muted">
            Sent by you
          </Text>
          {sent.map((p) => (
            <View key={p.id} style={styles.sentRow}>
              <View style={styles.flex}>
                <Text variant="label" weight="medium" numberOfLines={1}>
                  {p.note || "No note"}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {new Date(p.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · ±{Math.round(p.accuracy_m)} m
                  {p.site ? ` · Site: ${p.site.name}` : ""}
                </Text>
              </View>
              {!p.site && (
                <Pressable accessibilityRole="button" accessibilityLabel="Delete this pin" hitSlop={10} onPress={() => remove(p)} style={styles.trash}>
                  <Trash2 size={18} color={color.destructive} strokeWidth={2} />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space[3] },
  row: { flexDirection: "row", gap: space[2] },
  flex: { flex: 1, minWidth: 0 },
  map: { height: 220, borderRadius: radius.xl, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: color.border },
  centre: {
    position: "absolute",
    right: space[2],
    bottom: space[2],
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  fixRow: { flexDirection: "row", alignItems: "center", gap: space[3], padding: space[3], borderRadius: radius.xl, backgroundColor: color.muted },
  sent: { marginTop: space[4], gap: space[1], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.lineSoft, paddingTop: space[3] },
  sentRow: { flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[2] },
  trash: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
});
