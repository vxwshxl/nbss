import { router } from "expo-router";
import { LocateFixed, SatelliteDish, Siren } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { istTime } from "@nbss/shared/company";
import { freshness } from "@nbss/shared/location";
import { EVENTS, LIVE_MAP_CHANNEL, type LivePosition, type PositionBatch } from "@nbss/shared/realtime";
import { SOS_KIND_LABEL } from "@nbss/shared/sos";

import { MAP_COLOR, fenceRing } from "@/components/live-map/shared";
import { MapCanvas, type MapFence, type MapPerson } from "@/components/map-canvas";
import { MapSheet } from "@/components/map-sheet";
import { Panel, PanelRow } from "@/components/panel";
import { SolidButton } from "@/components/solid-button";
import { StatusPill } from "@/components/status-pill";
import { Text } from "@/components/text";
import { useLoader } from "@/hooks/use-loader";
import { useNow } from "@/hooks/use-now";
import { allSites, liveAlerts, toFence } from "@/lib/duty";
import { supabase } from "@/lib/supabase";
import { color, radius, shadow, space } from "@/theme/tokens";

/**
 * What a supervisor sees on their phone, laid out like the guard's Duty screen: every
 * site and every guard on duty on a full-screen map, and a sheet over it with the
 * counts, any live SOS, and the list of who is out there.
 *
 * Positions arrive over the live-map channel: each one the moment it is stored (0034),
 * plus a 15-second batch to catch up. Both are merged per guard, so one guard's update
 * never replaces everyone else's.
 */
export default function LiveRoute() {
  const [positions, setPositions] = useState<Record<string, LivePosition>>({});
  const [lastAt, setLastAt] = useState<string | null>(null);
  const [sheetH, setSheetH] = useState(0);
  const [frame, setFrame] = useState(0);
  const { data: alerts = [], refreshing, reload, refresh } = useLoader(liveAlerts);
  // Ticks on its own, so a guard whose phone died goes amber without waiting for a batch.
  const now = useNow();

  useEffect(() => {
    const channel = supabase
      .channel(LIVE_MAP_CHANNEL, { config: { private: true } })
      .on("broadcast", { event: EVENTS.positions }, ({ payload }) => {
        const batch = payload as PositionBatch;
        setLastAt(batch.at);
        setPositions((cur) => {
          const next = { ...cur };
          for (const p of batch.positions ?? []) next[p.guard_id] = { ...next[p.guard_id], ...p };
          return next;
        });
      })
      .on("broadcast", { event: EVENTS.sos }, () => void reload())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reload]);

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

  const list = useMemo(() => Object.values(positions), [positions]);
  const fences = useMemo<MapFence[]>(
    () =>
      (board?.sites ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        ring: fenceRing({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, radiusM: s.geofence_radius_m, ring: toFence(s).ring ?? null }),
        tone: color.primary,
        quiet: true,
      })),
    [board],
  );
  const dots = useMemo<MapPerson[]>(
    () =>
      list.map((p) => ({
        id: p.guard_id,
        lat: p.lat,
        lng: p.lng,
        label: board?.names.get(p.guard_id)?.full_name.split(" ")[0],
        tone: p.mode === "emergency" ? color.destructive : p.inside_fence ? MAP_COLOR.inside : MAP_COLOR.outside,
      })),
    [list, board],
  );

  const quiet = list.filter((p) => freshness(new Date(p.recorded_at).getTime(), now) !== "live").length;
  const inside = list.filter((p) => p.inside_fence).length;

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <MapCanvas fences={fences} people={dots} frameKey={board ? `sites|${frame}` : ""} padding={{ top: 24, right: 24, bottom: sheetH + 16, left: 24 }} />
      </View>

      <MapSheet
        initial="half"
        onSnap={(_, px) => setSheetH(px)}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={color.primary} onRefresh={() => void refresh()} />}
        floating={
          <View style={styles.floatRow} pointerEvents="box-none">
            <Pressable accessibilityRole="button" accessibilityLabel="Show every site" onPress={() => setFrame((k) => k + 1)} style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
              <LocateFixed size={22} color={color.primary} strokeWidth={2.2} />
            </Pressable>
          </View>
        }
        header={
          <View style={styles.headGap}>
            <Text variant="label" weight="semibold" tone="primary">
              Live{lastAt ? ` · updated ${istTime(lastAt)}` : " · connecting…"}
            </Text>
            <Text variant="title" weight="semibold">
              {list.length} on duty
            </Text>
            <View style={styles.counts}>
              <Count value={inside} label="inside" tone="#059669" />
              <Count value={list.length - inside} label="outside" tone="#d97706" />
              <Count value={quiet} label="no signal" tone="#64748b" />
              <Count value={alerts.length} label="SOS" tone={color.sos} />
            </View>
          </View>
        }
      >
        {alerts.length > 0 && (
          <Panel tone="rose" title={`${alerts.length} live SOS`} icon={Siren}>
            {alerts.map((alert) => (
              <View key={alert.id} style={styles.alert}>
                <View style={styles.flex}>
                  <Text weight="semibold" variant="body" tone="danger">
                    {SOS_KIND_LABEL[alert.kind]} · {alert.site_name ?? "Unknown site"}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {alert.raiser_name ?? "A guard"} · {istTime(alert.raised_at)}
                  </Text>
                </View>
                <View style={styles.open}>
                  <SolidButton label="Open" icon={Siren} tone="red" onPress={() => router.push(`/sos/${alert.id}`)} />
                </View>
              </View>
            ))}
          </Panel>
        )}

        <Panel tone="indigo" icon={SatelliteDish} title={`${list.length} on duty`} subtitle="Newest positions first" bare>
          {list.length === 0 ? (
            <PanelRow first>
              <Text variant="label" tone="muted">
                {lastAt ? "Nobody is on duty." : "Connecting… positions arrive as guards move."}
              </Text>
            </PanelRow>
          ) : (
            [...list]
              .sort((a, b) => (b.received_at ?? b.recorded_at).localeCompare(a.received_at ?? a.recorded_at))
              .map((p, i) => {
                const age = freshness(new Date(p.recorded_at).getTime(), now);
                return (
                  <PanelRow key={p.guard_id} first={i === 0}>
                    <View style={styles.flex}>
                      <Text weight="semibold" variant="body">
                        {nameOf(p.guard_id)}
                      </Text>
                      <Text variant="caption" tone="muted" mono>
                        {p.inside_fence ? "Inside the boundary" : `${Math.round(p.distance_m ?? 0)} m out`}
                        {p.battery !== null ? ` · ${p.battery}%` : ""}
                      </Text>
                    </View>
                    <StatusPill tone={age} label={age === "live" ? "Live" : age === "stale" ? "No signal" : "Out of contact"} />
                  </PanelRow>
                );
              })
          )}
        </Panel>
        <View style={styles.sheetEnd} />
      </MapSheet>
    </View>
  );
}

function Count({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <View style={styles.count}>
      <Text variant="bodyLarge" weight="bold" tone="inherit" style={{ color: tone }}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.appBg },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  headGap: { gap: 4 },
  pressed: { opacity: 0.7 },
  counts: { flexDirection: "row", gap: space[2], marginTop: space[2] },
  count: { flex: 1, alignItems: "center", paddingVertical: space[2], borderRadius: radius.lg, backgroundColor: color.muted },
  alert: { flexDirection: "row", alignItems: "center", gap: space[3] },
  open: { width: 120 },
  floatRow: { flexDirection: "row", justifyContent: "flex-end" },
  fab: { width: 52, height: 52, borderRadius: 26, backgroundColor: color.card, alignItems: "center", justifyContent: "center", ...shadow.raised },
  sheetEnd: { height: 48 },
});
