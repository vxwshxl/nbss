import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ChevronRight, MessageSquare, Phone, ShieldCheck, Siren } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { COMPANY, tel } from "@nbss/shared/company";
import { SOS_KIND_LABEL, SOS_STATUS_LABEL } from "@nbss/shared/sos";

import { Button } from "@/components/button";
import { currentFix } from "@/lib/location";
import { EmptyState } from "@/components/empty-state";
import { HoldButton } from "@/components/hold-button";
import { Panel } from "@/components/panel";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { useLoader } from "@/hooks/use-loader";
import { useAuth } from "@/lib/auth";
import { liveAlerts, raiseSos } from "@/lib/duty";
import { color, radius, space } from "@/theme/tokens";

/**
 * Alerts: every SOS still open that this guard was sent, newest first, each one
 * opening the map of who raised it and who is coming. The panic button lives here
 * too, so "something is wrong" has one obvious place to go.
 */
export default function AlertsRoute() {
  const { profile } = useAuth();
  const { data, reload, refreshing } = useLoader(liveAlerts);
  const { failed } = useLocalSearchParams<{ failed?: string }>();
  const [error, setError] = useState<string | null>(failed ?? null);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  useEffect(() => {
    const t = setInterval(() => void reload(), 20_000);
    return () => clearInterval(t);
  }, [reload]);

  const alerts = data ?? [];

  return (
    <Screen
      topInset={false}
      contentStyle={styles.body}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={color.sos} />}
    >
      {data && alerts.length === 0 && (
        <EmptyState icon={ShieldCheck} title="All quiet" body="No SOS is open. If one is raised at your site, it rings here and on your phone." />
      )}

      {alerts.map((a) => (
        <Pressable
          key={a.id}
          accessibilityRole="button"
          onPress={() => router.push(`/sos/${a.id}`)}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <View style={styles.icon}>
            <Siren size={22} color="#fff" strokeWidth={2.2} />
          </View>
          <View style={styles.flex}>
            <Text variant="label" weight="bold" numberOfLines={1}>
              {a.raised_by === profile?.id ? "Your SOS" : (a.raiser_name ?? "A guard")} · {SOS_KIND_LABEL[a.kind]}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {a.site_name ?? "A site"} · {new Date(a.raised_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })} ·{" "}
              {SOS_STATUS_LABEL[a.status]}
            </Text>
          </View>
          <ChevronRight size={20} color={color.mutedForeground} />
        </Pressable>
      ))}

      <Panel tone="rose" title="Need help?" subtitle="Hold for three seconds. Your location goes to everyone on duty here and the office.">
        <HoldButton
          label="Hold 3s for help"
          onComplete={() =>
            void raiseSos().then((r) => {
              if (r.ok) router.push(`/sos/${r.alertId}`);
              else setError(r.error);
            })
          }
        />
        {error && (
          <Text variant="caption" tone="danger">
            Not sent: {error}
          </Text>
        )}
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
                void currentFix().then((fix) => {
                  const where = fix ? ` Location: https://maps.google.com/?q=${fix.coords.latitude.toFixed(5)},${fix.coords.longitude.toFixed(5)}` : "";
                  void Linking.openURL(`sms:${tel(COMPANY.phone)}?body=${encodeURIComponent(`SOS from ${profile?.full_name ?? "a guard"}. Need help now.${where}`)}`);
                })
              }
            />
          </View>
        </View>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[4], paddingBottom: space[8] },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row", gap: space[2] },
  pressed: { opacity: 0.75 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    padding: space[4],
    borderRadius: radius["2xl"],
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: `${color.sos}55`,
  },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.sos, alignItems: "center", justifyContent: "center" },
});
