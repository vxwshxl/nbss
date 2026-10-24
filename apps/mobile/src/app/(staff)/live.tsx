import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";

import { istTime } from "@nbss/shared/company";
import { freshness } from "@nbss/shared/location";
import { EVENTS, LIVE_MAP_CHANNEL, type PositionBatch } from "@nbss/shared/realtime";
import { SOS_KIND_LABEL } from "@nbss/shared/sos";
import { Map as MapIcon, Radio, Siren, SatelliteDish, WifiOff } from "lucide-react-native";

import { Button } from "@/components/button";
import { MAP_COLOR, fenceRing } from "@/components/live-map/shared";
import { MapCanvas, type MapFence, type MapPerson } from "@/components/map-canvas";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelRow } from "@/components/panel";
import { CardGrid, Screen } from "@/components/screen";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { Text } from "@/components/text";
import { useLayout } from "@/hooks/use-breakpoint";
import { useLoader } from "@/hooks/use-loader";
import { useNow } from "@/hooks/use-now";
import { allSites, liveAlerts, toFence } from "@/lib/duty";
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
  const { statColumns } = useLayout();

  const [batch, setBatch] = useState<PositionBatch | null>(null);

  const { data: alerts = [], refreshing, reload, refresh } = useLoader(liveAlerts);

  // Ticks on its own, so a guard whose phone died goes amber without waiting for a batch
  // that is never coming. See the comment in use-now.ts.
  const now = useNow();

  useEffect(() => {
    const channel = supabase
      .channel(LIVE_MAP_CHANNEL, { config: { private: true } })
      .on("broadcast", { event: EVENTS.positions }, ({ payload }) => {
        setBatch(payload as PositionBatch);
      })
      .on("broadcast", { event: EVENTS.sos }, () => {
        void reload();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reload]);

  const positions = useMemo(() => batch?.positions ?? [], [batch]);

  // Sites for the map, and every guard's name, so a row reads as a person.
  const { data: board } = useLoader(
    useCallback(async () => {
      const [sites, people] = await Promise.all([
        allSites(),
        supabase.from("profiles").select("id, full_name, employee_code").eq("role", "guard"),
      ]);
      return { sites, names: new Map((people.data ?? []).map((p) => [p.id, p])) };
    }, []),
  );
  const nameOf = (id: string) => board?.names.get(id)?.full_name ?? "Guard";

  const fences = useMemo<MapFence[]>(
    () =>
      (board?.sites ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        ring: fenceRing({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, radiusM: s.geofence_radius_m, ring: toFence(s).ring ?? null }),
        tone: color.primary,
      })),
    [board],
  );
  const dots = useMemo<MapPerson[]>(
    () =>
      positions.map((p) => ({
        id: p.guard_id,
        lat: p.lat,
        lng: p.lng,
        label: board?.names.get(p.guard_id)?.full_name.split(" ")[0],
        tone: p.mode === "emergency" ? color.destructive : p.inside_fence ? MAP_COLOR.inside : MAP_COLOR.outside,
      })),
    [positions, board],
  );

  return (
    <Screen
      topInset={false}
      bottomInset={false}
      contentStyle={styles.body}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={color.primary}
          onRefresh={() => void refresh()}
        />
      }
    >
      <PageHeader eyebrow="Operations" title="Live" />

      <CardGrid columns={statColumns}>
        <StatCard
          label="On duty"
          value={String(positions.length)}
          hint={batch ? `As at ${istTime(batch.at)}` : "Connecting…"}
          icon={Radio}
          tone={positions.length ? "emerald" : "slate"}
        />
        <StatCard
          label="Live alerts"
          value={String(alerts.length)}
          hint={alerts.length ? "Needs answering" : "Nothing outstanding"}
          icon={Siren}
          tone={alerts.length ? "rose" : "slate"}
        />
        <StatCard
          label="Inside boundary"
          value={String(positions.filter((p) => p.inside_fence).length)}
          hint="Of those reporting"
          icon={SatelliteDish}
          tone="teal"
        />
        <StatCard
          label="Out of contact"
          value={String(
            positions.filter((p) => freshness(new Date(p.recorded_at).getTime(), now) !== "live")
              .length,
          )}
          hint="No recent ping"
          icon={WifiOff}
          tone="amber"
        />
      </CardGrid>
      <Panel tone="teal" icon={MapIcon} title="Map" subtitle="Every site, and every guard on duty" bare>
        <View style={styles.map}>
          <MapCanvas fences={fences} people={dots} frameKey={board ? "sites" : ""} />
        </View>
      </Panel>

      {alerts.length > 0 && (
        <Panel tone="rose" title={`${alerts.length} live alert${alerts.length > 1 ? "s" : ""}`} icon={Siren}>
          {alerts.map((alert) => (
            <View key={alert.id} style={styles.alert}>
              <View style={styles.alertText}>
                <Text weight="semibold" variant="body" tone="danger">
                  {SOS_KIND_LABEL[alert.kind]} · {alert.site_name ?? "Unknown site"}
                </Text>
                <Text variant="caption" tone="muted">
                  {alert.raiser_name ?? "A guard"} ·{" "}
                  {istTime(alert.raised_at)}

                </Text>
              </View>
              <Button label="Open" variant="destructive" onPress={() => router.push(`/sos/${alert.id}`)} />
            </View>
          ))}
        </Panel>
      )}

      <Panel
        tone="indigo"
        icon={SatelliteDish}
        title={`${positions.length} on duty`}
        subtitle={
          batch ? `Updated ${istTime(batch.at)}` : "Waiting for the next position batch…"
        }
        bare
      >
        {positions.length === 0 ? (
          <EmptyState
            icon={SatelliteDish}
            title={batch ? "Nobody is on duty." : "Connecting…"}
            body="Positions arrive every fifteen seconds while guards are checked in."
          />
        ) : (
          positions.map((position) => {
            const age = freshness(new Date(position.recorded_at).getTime(), now);
            return (
              <PanelRow key={position.guard_id}>
                <View style={styles.rowText}>
                  <Text weight="semibold" variant="body">
                    {nameOf(position.guard_id)}
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
              </PanelRow>
            );
          })
        )}
      </Panel>

    </Screen>
  );
}

const styles = StyleSheet.create({
  // No padding here: <Screen> owns the gutter, and it grows on a tablet. A padding of its
  // own would double up and stop the layout being responsive.
  body: { gap: space[6] },
  alert: { flexDirection: "row", alignItems: "center", gap: space[3] },
  alertText: { flex: 1, gap: 2 },
  rowText: { flex: 1, gap: 2 },
  map: { height: 320, overflow: "hidden", borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
});
