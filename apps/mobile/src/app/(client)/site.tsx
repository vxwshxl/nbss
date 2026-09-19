import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import type { View as DbView } from "@nbss/shared/db";

import { Card } from "@/components/card";
import { Text } from "@/components/text";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { color, space } from "@/theme/tokens";

type Presence = DbView<"client_attendance">;

/**
 * What a client sees: that their site is staffed, and the man-hours behind the invoice.
 *
 * Read from `client_attendance`, not from `attendance`. The underlying rows carry each
 * guard's coordinates, accuracy readings and the object key of their check-in photograph,
 * and row level security filters rows rather than columns — so the view (0004) exposes
 * the ten columns a client may have and the table itself stays closed to them. A client
 * is entitled to know their premises are covered; following an individual employee around
 * a compound minute by minute is not theirs to do.
 */
export default function ClientSiteRoute() {
  const { profile } = useAuth();
  const [onDuty, setOnDuty] = useState<Presence[]>([]);
  const [monthMinutes, setMonthMinutes] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [live, month] = await Promise.all([
      supabase
        .from("client_attendance")
        .select("*")
        .is("check_out_at", null)
        .order("check_in_at", { ascending: false }),
      supabase
        .from("client_attendance")
        .select("worked_minutes")
        .gte("check_in_at", monthStart.toISOString()),
    ]);

    setOnDuty(live.data ?? []);
    setMonthMinutes((month.data ?? []).reduce((sum, row) => sum + (row.worked_minutes ?? 0), 0));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      <Card tone="accent">
        <Text variant="caption" tone="muted" medium>
          ON DUTY NOW
        </Text>
        <Text variant="hero" bold mono>
          {onDuty.length}
        </Text>
        <Text variant="caption" tone="muted">
          {Math.floor(monthMinutes / 60)} man-hours this month
        </Text>
      </Card>

      <Card title="Who is on site" bare>
        {onDuty.length === 0 ? (
          <View style={styles.empty}>
            <Text variant="body" medium>
              Nobody is checked in.
            </Text>
            <Text variant="caption" tone="muted" style={styles.centered}>
              Guards appear here from the moment they arrive and mark themselves present at
              the boundary.
            </Text>
          </View>
        ) : (
          onDuty.map((row) => (
            <View key={row.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text variant="body" semibold>
                  {row.guard_name ?? "—"}
                </Text>
                <Text variant="caption" tone="muted">
                  {row.site_name ?? "—"}
                </Text>
              </View>
              <Text variant="caption" tone="muted" mono>
                {row.check_in_at
                  ? new Date(row.check_in_at).toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                      timeZone: "Asia/Kolkata",
                    })
                  : "—"}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Card title="Signed in as">
        <Text variant="body">{profile?.full_name ?? "—"}</Text>
        <Text variant="caption" tone="muted">
          {profile?.employee_code ?? "—"}
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.appBg },
  body: { padding: space[4], gap: space[4] },
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
