import { router, useFocusEffect } from "expo-router";
import { Building2, ChevronRight, LocateFixed, Phone, ShieldCheck, Siren, UserRoundCheck } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { COMPANY, istTime, tel } from "@nbss/shared/company";
import { toRing } from "@nbss/shared/geo";
import { SOS_KIND_LABEL } from "@nbss/shared/sos";

import { Avatar } from "@/components/avatar";
import { MAP_COLOR, fenceRing } from "@/components/live-map/shared";
import { MapCanvas, type MapFence } from "@/components/map-canvas";
import { MapSheet } from "@/components/map-sheet";
import { Panel, PanelRow } from "@/components/panel";
import { SolidButton } from "@/components/solid-button";
import { Text } from "@/components/text";
import { useLoader } from "@/hooks/use-loader";
import { useAuth } from "@/lib/auth";
import { liveAlerts } from "@/lib/duty";
import { Notifications } from "@/lib/push";
import { supabase } from "@/lib/supabase";
import { TONES } from "@/theme/tones";
import { color, radius, shadow, space } from "@/theme/tokens";

type Site = { id: string; name: string; address: string | null; district: string | null; lat: number; lng: number; geofence_radius_m: number; polygon: unknown };
type OnDuty = { id: string; site_id: string; guard_name: string; check_in_at: string };

const hours = (m: number) => (m % 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${Math.floor(m / 60)}h`);

/**
 * A client's app, shaped like a guard's Duty screen: their sites on a map (green while
 * someone is on duty, amber when nobody is), and a sheet with any SOS at their sites,
 * who is on duty at each one, and this month's man-hours.
 *
 * Guards are listed by name and check-in time, not tracked on the map: a client is
 * entitled to know their premises are covered, not to follow an employee around.
 */
export function ClientHome() {
  const { profile } = useAuth();
  const [sheetH, setSheetH] = useState(0);
  const [frame, setFrame] = useState(0);

  const load = useCallback(async () => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const me = profile?.id ?? "";
    const [sites, live, month, alerts] = await Promise.all([
      supabase.from("sites").select("id, name, address, district, lat, lng, geofence_radius_m, polygon").eq("client_id", me).eq("active", true).order("name"),
      supabase.from("client_attendance").select("id, site_id, guard_name, check_in_at").is("check_out_at", null).order("check_in_at"),
      supabase.from("client_attendance").select("worked_minutes, overtime_minutes").gte("check_in_at", monthStart.toISOString()),
      liveAlerts(),
    ]);
    const rows = month.data ?? [];
    return {
      sites: (sites.data ?? []) as Site[],
      onDuty: (live.data ?? []) as OnDuty[],
      minutes: rows.reduce((n, r) => n + (r.worked_minutes ?? 0), 0),
      overtime: rows.reduce((n, r) => n + (r.overtime_minutes ?? 0), 0),
      shifts: rows.length,
      alerts,
    };
  }, [profile?.id]);
  const { data, refreshing, reload, refresh } = useLoader(load);

  // Fresh on arrival, every half minute while open, and the moment an SOS push lands.
  useFocusEffect(
    useCallback(() => {
      void reload();
      const t = setInterval(() => void reload(), 30_000);
      return () => clearInterval(t);
    }, [reload]),
  );
  useEffect(() => {
    const sub = Notifications?.addNotificationReceivedListener((n) => {
      if ((n.request.content.data as { type?: string } | null)?.type === "sos") void reload();
    });
    return () => sub?.remove();
  }, [reload]);

  const sites = useMemo(() => data?.sites ?? [], [data]);
  const onDuty = useMemo(() => data?.onDuty ?? [], [data]);
  const alerts = data?.alerts ?? [];
  const staffed = new Set(onDuty.map((o) => o.site_id));
  const sosSites = new Set(alerts.map((a) => a.site_id));

  const fences: MapFence[] = useMemo(
    () =>
      sites.map((s) => ({
        id: s.id,
        name: s.name,
        ring: fenceRing({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, radiusM: s.geofence_radius_m, ring: toRing(s.polygon) }),
        tone: sosSites.has(s.id) ? color.sos : staffed.has(s.id) ? MAP_COLOR.inside : MAP_COLOR.outside,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sites, onDuty, alerts],
  );

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <MapCanvas fences={fences} frameKey={`${sites.length}|${frame}`} padding={{ top: 24, right: 24, bottom: sheetH + 16, left: 24 }} />
      </View>

      <MapSheet
        initial="half"
        onSnap={(_, px) => setSheetH(px)}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={color.primary} onRefresh={() => void refresh()} />}
        floating={
          <View style={styles.floatRow} pointerEvents="box-none">
            <Pressable accessibilityRole="button" accessibilityLabel="Show all my sites" onPress={() => setFrame((k) => k + 1)} style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
              <LocateFixed size={22} color={color.primary} strokeWidth={2.2} />
            </Pressable>
          </View>
        }
        header={
          <View style={styles.headGap}>
            <Text variant="label" weight="semibold" tone={alerts.length ? "danger" : "primary"}>
              {alerts.length ? `${alerts.length} SOS at your site${alerts.length > 1 ? "s" : ""}` : `Welcome, ${profile?.full_name.split(" ")[0] ?? ""}`}
            </Text>
            <Text variant="title" weight="semibold">
              {onDuty.length ? `${onDuty.length} guard${onDuty.length === 1 ? "" : "s"} on duty` : sites.length ? "Nobody on duty right now" : "No sites yet"}
            </Text>
            <View style={styles.counts}>
              <Count value={String(sites.length)} label="sites" tone={TONES.sky.chipText} />
              <Count value={hours(data?.minutes ?? 0)} label="man-hours" tone={TONES.emerald.chipText} />
              <Count value={hours(data?.overtime ?? 0)} label="overtime" tone={TONES.violet.chipText} />
            </View>
          </View>
        }
      >
        {alerts.length > 0 && (
          <Panel tone="rose" title="SOS at your site" subtitle="Our guards and the office are on it" icon={Siren}>
            {alerts.map((a) => (
              <View key={a.id} style={styles.alert}>
                <View style={styles.flex}>
                  <Text variant="label" weight="bold" tone="danger">
                    {SOS_KIND_LABEL[a.kind]} · {a.site_name ?? "your site"}
                  </Text>
                  <Text variant="caption" tone="muted">
                    Raised {istTime(a.raised_at)} · {a.status === "acknowledged" ? "help is on the way" : "waiting for an answer"}
                  </Text>
                </View>
                <View style={styles.open}>
                  <SolidButton label="Open" icon={Siren} tone="red" onPress={() => router.push(`/sos/${a.id}`)} />
                </View>
              </View>
            ))}
          </Panel>
        )}

        {sites.map((s) => {
          const here = onDuty.filter((o) => o.site_id === s.id);
          const t = sosSites.has(s.id) ? TONES.rose : here.length ? TONES.emerald : TONES.amber;
          return (
            <Panel key={s.id} tone={sosSites.has(s.id) ? "rose" : here.length ? "emerald" : "amber"} title={s.name} subtitle={[s.address, s.district].filter(Boolean).join(", ") || undefined} icon={Building2} bare>
              <PanelRow first>
                <View style={[styles.chip, { backgroundColor: t.chip }]}>
                  {here.length ? <UserRoundCheck size={16} color={t.chipText} strokeWidth={2.2} /> : <ShieldCheck size={16} color={t.chipText} strokeWidth={2.2} />}
                </View>
                <Text variant="label" weight="semibold" style={styles.flex}>
                  {here.length ? `${here.length} on duty now` : "Nobody checked in"}
                </Text>
              </PanelRow>
              {here.map((o) => (
                <PanelRow key={o.id}>
                  <Avatar name={o.guard_name} size={34} />
                  <View style={styles.flex}>
                    <Text variant="label" weight="semibold" numberOfLines={1}>
                      {o.guard_name}
                    </Text>
                    <Text variant="caption" tone="muted">
                      On duty since {istTime(o.check_in_at)} · verified at the boundary
                    </Text>
                  </View>
                </PanelRow>
              ))}
            </Panel>
          );
        })}

        {data && sites.length === 0 && (
          <Panel tone="sky" title="Book your first guards" icon={Building2}>
            <Text variant="body" tone="muted">
              Once NBSS deploys guards at your premises, your site appears here with who is on duty.
            </Text>
            <SolidButton label="Book guards" icon={ChevronRight} tone="green" onPress={() => router.navigate("/(client)/book")} />
          </Panel>
        )}

        <Panel tone="slate" title="Anything not right?" icon={Phone}>
          <Text variant="body" tone="muted">
            The deployment desk is staffed {COMPANY.deskHours}.
          </Text>
          <SolidButton label={`Call ${COMPANY.phone}`} icon={Phone} tone="green" onPress={() => void Linking.openURL(`tel:${tel(COMPANY.phone)}`)} />
        </Panel>
        <View style={styles.sheetEnd} />
      </MapSheet>
    </View>
  );
}

function Count({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <View style={styles.count}>
      <Text variant="label" weight="bold" tone="inherit" style={{ color: tone }} numberOfLines={1}>
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
  open: { width: 110 },
  chip: { width: 34, height: 34, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  floatRow: { flexDirection: "row", justifyContent: "flex-end" },
  fab: { width: 52, height: 52, borderRadius: 26, backgroundColor: color.card, alignItems: "center", justifyContent: "center", ...shadow.raised },
  sheetEnd: { height: 48 },
});
