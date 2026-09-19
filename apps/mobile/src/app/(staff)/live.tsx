import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { freshness } from "@nbss/shared/location";
import { EVENTS, LIVE_MAP_CHANNEL, type PositionBatch } from "@nbss/shared/realtime";
import { SOS_KIND_LABEL } from "@nbss/shared/sos";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { StatusPill } from "@/components/status-pill";
import { Text } from "@/components/text";
import { useAuth } from "@/lib/auth";
import { liveAlerts, type LiveAlert } from "@/lib/duty";
import { supabase } from "@/lib/supabase";
import { color, space } from "@/theme/tokens";
import { router } from "expo-router";

/**
 * What a supervisor sees on their phone: who is out there, and anything on fire.
 *
 * Positions arrive as one broadcast every fifteen seconds rather than a row at a time.
 * That is the single most important cost decision in this system — Postgres Changes bills
 * per row per subscriber, so streaming two hundred guards' pings to three watching
 * supervisors would multiply into millions of messages a month. `broadcast_positions()`
 * assembles one message for everyone instead, so the bill tracks the number of people
 * watching rather than the number of guards walking about. See 0005.
 *
 * The map itself is the next piece; this is the same feed rendered as a list, which is
 * what a supervisor mostly wants anyway — "is anybody out of contact".
 */
export default function LiveRoute() {
  const { profile } = useAuth();

  const [batch, setBatch] = useState<PositionBatch | null>(null);
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setAlerts(await liveAlerts());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(LIVE_MAP_CHANNEL, { config: { private: true } })
      .on("broadcast", { event: EVENTS.positions }, ({ payload }) => {
        setBatch(payload as PositionBatch);
      })
      .on("broadcast", { event: EVENTS.sos }, () => {
        void load();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const now = Date.now();
  const positions = batch?.positions ?? [];

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.body}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={color.primary}
          onRefresh={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
        />
      }
    >
      {alerts.length > 0 && (
        <Card tone="danger" title={`${alerts.length} live alert${alerts.length > 1 ? "s" : ""}`}>
          {alerts.map((alert) => (
            <View key={alert.id} style={styles.alert}>
              <View style={styles.alertText}>
                <Text variant="body" semibold tone="danger">
                  {SOS_KIND_LABEL[alert.kind]} · {alert.site_name ?? "Unknown site"}
                </Text>
                <Text variant="caption" tone="muted">
                  {alert.raiser_name ?? "A guard"} ·{" "}
                  {new Date(alert.raised_at).toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                    timeZone: "Asia/Kolkata",
                  })}
                </Text>
              </View>
              <Button label="Open" variant="danger" onPress={() => router.push(`/sos/${alert.id}`)} />
            </View>
          ))}
        </Card>
      )}

      <Card
        title={`${positions.length} on duty`}
        subtitle={
          batch
            ? `Updated ${new Date(batch.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}`
            : "Waiting for the next position batch…"
        }
        bare
      >
        {positions.length === 0 ? (
          <View style={styles.empty}>
            <Text variant="body" medium>
              {batch ? "Nobody is on duty." : "Connecting…"}
            </Text>
            <Text variant="caption" tone="muted" style={styles.centered}>
              Positions arrive every fifteen seconds while guards are checked in.
            </Text>
          </View>
        ) : (
          positions.map((position) => {
            const age = freshness(new Date(position.recorded_at).getTime(), now);
            return (
              <View key={position.guard_id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text variant="body" semibold>
                    {position.guard_id.slice(0, 8)}
                  </Text>
                  <Text variant="caption" tone="muted" mono>
                    {position.inside_fence ? "Inside the boundary" : `${Math.round(position.distance_m ?? 0)} m out`}
                    {position.battery !== null ? ` · ${position.battery}%` : ""}
                  </Text>
                </View>
                <StatusPill
                  tone={age}
                  label={age === "live" ? "Live" : age === "stale" ? "No signal" : "Out of contact"}
                />
              </View>
            );
          })
        )}
      </Card>

      <Card title="Signed in as">
        <Text variant="body">{profile?.full_name ?? "—"}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.appBg },
  body: { padding: space[4], gap: space[4] },
  alert: { flexDirection: "row", alignItems: "center", gap: space[3] },
  alertText: { flex: 1, gap: 2 },
  empty: { padding: space[6], gap: space[2], alignItems: "center" },
  centered: { textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  rowText: { flex: 1, gap: 2 },
});
