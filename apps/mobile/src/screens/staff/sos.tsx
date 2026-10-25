import { router } from "expo-router";
import { ChevronRight, LocateFixed, ShieldCheck, Siren } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { COMPANY, istTime } from "@nbss/shared/company";
import { SOS_KIND_LABEL, SOS_STATUS_LABEL, isLive, type SosKind, type SosStatus } from "@nbss/shared/sos";

import { MapCanvas, type MapFence, type MapPerson } from "@/components/map-canvas";
import { fenceRing } from "@/components/live-map/shared";
import { MapSheet } from "@/components/map-sheet";
import { Panel, PanelRow } from "@/components/panel";
import { Text } from "@/components/text";
import { useLiveTables } from "@/hooks/use-live-tables";
import { useLoader } from "@/hooks/use-loader";
import { toFence, type Site } from "@/lib/duty";
import { Notifications } from "@/lib/push";
import { supabase } from "@/lib/supabase";
import { color, radius, shadow, space } from "@/theme/tokens";

type Row = {
  id: string;
  kind: SosKind;
  status: SosStatus;
  raised_at: string;
  resolved_at: string | null;
  lat: number | null;
  lng: number | null;
  site_id: string;
  site: string;
  district: string | null;
  raiser: string;
};
type Period = "today" | "7" | "30" | "90" | "all";
type Show = "all" | "open" | "resolved" | "false_alarm";

const IST = COMPANY.timeZone ?? "Asia/Kolkata";
const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "all", label: "All time" },
];
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short" });

function since(p: Period): string | null {
  if (p === "all") return null;
  if (p === "today") {
    // Midnight in India: IST is a fixed UTC+5:30, with no daylight saving.
    const offset = 330 * 60_000;
    return new Date(Math.floor((Date.now() + offset) / 86_400_000) * 86_400_000 - offset).toISOString();
  }
  return new Date(Date.now() - Number(p) * 86_400_000).toISOString();
}

async function load(period: Period): Promise<{ rows: Row[]; sites: Site[] }> {
  let q = supabase
    .from("sos_alerts")
    .select("id, kind, status, raised_at, closed_at, lat, lng, site_id, profiles!sos_alerts_raised_by_fkey(full_name), sites(name, district)")
    .order("raised_at", { ascending: false })
    .limit(300);
  const from = since(period);
  if (from) q = q.gte("raised_at", from);
  // Open ones always show, however old.
  const [alerts, open, sites] = await Promise.all([
    q,
    supabase.from("sos_alerts").select("id, kind, status, raised_at, closed_at, lat, lng, site_id, profiles!sos_alerts_raised_by_fkey(full_name), sites(name, district)").in("status", ["active", "acknowledged"]),
    supabase.from("sites").select("id, name, client_name, district, address, lat, lng, geofence_radius_m, max_accuracy_m, shift_start, shift_end, polygon").eq("active", true),
  ]);
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const a of [...(open.data ?? []), ...(alerts.data ?? [])]) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    const s = one(a.sites as unknown as { name: string; district: string | null } | null);
    rows.push({
      id: a.id,
      kind: a.kind as SosKind,
      status: a.status as SosStatus,
      raised_at: a.raised_at,
      resolved_at: a.closed_at,
      lat: a.lat,
      lng: a.lng,
      site_id: a.site_id,
      site: s?.name ?? "A site",
      district: s?.district ?? null,
      raiser: one(a.profiles as unknown as { full_name: string } | null)?.full_name ?? "Someone",
    });
  }
  rows.sort((a, b) => b.raised_at.localeCompare(a.raised_at));
  return { rows, sites: (sites.data ?? []) as Site[] };
}

/**
 * Every SOS on a map, as the Live tab is laid out: the open ones red, the rest grey,
 * each where it was raised. The sheet holds the counts and the list, filtered by
 * status, period (today to all time) and site. A tap opens the alert's own page.
 * New, answered and closed alerts arrive as they happen.
 */
export function StaffSos() {
  const [period, setPeriod] = useState<Period>("30");
  const [show, setShow] = useState<Show>("all");
  const [site, setSite] = useState<string | null>(null);
  const [sheetH, setSheetH] = useState(0);
  const [frame, setFrame] = useState(0);
  const loader = useCallback(() => load(period), [period]);
  const { data, refreshing, reload, refresh } = useLoader(loader);
  useLiveTables(["sos_alerts"], reload);
  useEffect(() => {
    const sub = Notifications?.addNotificationReceivedListener((n) => {
      if ((n.request.content.data as { type?: string } | null)?.type === "sos") void reload();
    });
    return () => sub?.remove();
  }, [reload]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const atSite = site ? rows.filter((r) => r.site_id === site) : rows;
  const list = atSite.filter((r) =>
    show === "open" ? isLive(r.status) : show === "resolved" ? r.status === "resolved" : show === "false_alarm" ? r.status === "false_alarm" : true,
  );
  const open = rows.filter((r) => isLive(r.status));
  const siteIds = [...new Set(rows.map((r) => r.site_id))];

  // Plain values: the React Compiler memoises them.
  const fences: MapFence[] = (data?.sites ?? [])
    .filter((s) => siteIds.includes(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      ring: fenceRing({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, radiusM: s.geofence_radius_m, ring: toFence(s).ring ?? null }),
      tone: open.some((o) => o.site_id === s.id) ? color.destructive : "#64748b",
      quiet: true,
      frame: false,
    }));
  const pins: MapPerson[] = list
    .filter((r) => r.lat != null && r.lng != null)
    .map((r) => ({ id: r.id, lat: r.lat!, lng: r.lng!, tone: isLive(r.status) ? color.destructive : "#94a3b8", big: isLive(r.status), label: isLive(r.status) ? r.raiser.split(" ")[0] : undefined }));

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <MapCanvas fences={fences} people={pins} frameKey={`${period}|${show}|${site ?? ""}|${frame}|${pins.length}`} padding={{ top: 24, right: 24, bottom: sheetH + 16, left: 24 }} onPersonPress={(id) => router.push(`/sos/${id}`)} onFencePress={(id) => setSite(id === site ? null : id)} />
      </View>

      <MapSheet
        initial="half"
        onSnap={(_, px) => setSheetH(px)}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={color.sos} onRefresh={() => void refresh()} />}
        floating={
          <View style={styles.floatRow} pointerEvents="box-none">
            <Pressable accessibilityRole="button" accessibilityLabel="Show all" onPress={() => setFrame((k) => k + 1)} style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
              <LocateFixed size={22} color={color.sos} strokeWidth={2.2} />
            </Pressable>
          </View>
        }
        header={
          <View style={styles.head}>
            <Text variant="label" weight="semibold" tone="danger">
              {open.length ? `${open.length} open now` : "No SOS open"}
            </Text>
            <Text variant="title" weight="semibold">
              {list.length} SOS · {PERIODS.find((p) => p.value === period)?.label.toLowerCase()}
              {site ? ` · ${data?.sites.find((s) => s.id === site)?.name ?? ""}` : ""}
            </Text>
            <View style={styles.counts}>
              <Count value={open.length} label="open" tone={color.sos} />
              <Count value={atSite.filter((r) => r.status === "resolved").length} label="resolved" tone="#059669" />
              <Count value={atSite.filter((r) => r.status === "false_alarm").length} label="false" tone="#64748b" />
              <Count value={new Set(atSite.map((r) => r.site_id)).size} label="sites" tone="#0284c7" />
            </View>
          </View>
        }
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {PERIODS.map((p) => (
            <Chip key={p.value} label={p.label} on={period === p.value} onPress={() => setPeriod(p.value)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {(
            [
              ["all", "All"],
              ["open", "Open"],
              ["resolved", "Resolved"],
              ["false_alarm", "False alarm"],
            ] as const
          ).map(([v, l]) => (
            <Chip key={v} label={l} on={show === v} onPress={() => setShow(v)} />
          ))}
        </ScrollView>
        {siteIds.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="All sites" on={!site} onPress={() => setSite(null)} />
            {siteIds.map((id) => (
              <Chip key={id} label={rows.find((r) => r.site_id === id)?.site ?? "Site"} on={site === id} onPress={() => setSite(site === id ? null : id)} />
            ))}
          </ScrollView>
        )}

        {data && list.length === 0 ? (
          <View style={styles.empty}>
            <ShieldCheck size={28} color={color.live} strokeWidth={2} />
            <Text variant="label" weight="semibold">
              Nothing in this view
            </Text>
            <Text variant="caption" tone="muted" style={styles.centred}>
              A new SOS rings this phone and appears here at once.
            </Text>
          </View>
        ) : (
          <Panel tone={show === "open" || open.length ? "rose" : "slate"} title={`${list.length} alert${list.length === 1 ? "" : "s"}`} icon={Siren} bare>
            {list.map((a, i) => (
              <Pressable key={a.id} onPress={() => router.push(`/sos/${a.id}`)} accessibilityRole="button">
                {({ pressed }) => (
                  <PanelRow first={i === 0} style={pressed && styles.rowPressed}>
                    <View style={[styles.icon, { backgroundColor: isLive(a.status) ? color.sos : color.muted }]}>
                      <Siren size={17} color={isLive(a.status) ? "#fff" : color.mutedForeground} strokeWidth={2.2} />
                    </View>
                    <View style={styles.flex}>
                      <Text variant="label" weight="semibold" numberOfLines={1}>
                        {a.raiser} · {SOS_KIND_LABEL[a.kind]}
                      </Text>
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {[a.site, a.district, `${day(a.raised_at)} ${istTime(a.raised_at)}`].filter(Boolean).join(" · ")}
                      </Text>
                      <Text variant="caption" weight="semibold" tone={isLive(a.status) ? "danger" : "muted"}>
                        {SOS_STATUS_LABEL[a.status]}
                        {a.resolved_at ? ` · closed ${istTime(a.resolved_at)}` : ""}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={color.mutedForeground} strokeWidth={2} />
                  </PanelRow>
                )}
              </Pressable>
            ))}
          </Panel>
        )}
        <View style={styles.end} />
      </MapSheet>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text variant="caption" weight="semibold" tone="inherit" style={{ color: on ? color.primaryForeground : color.foreground }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
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
  flex: { flex: 1, minWidth: 0, gap: 1 },
  head: { gap: 4 },
  pressed: { opacity: 0.7 },
  rowPressed: { backgroundColor: color.muted },
  counts: { flexDirection: "row", gap: space[2], marginTop: space[2] },
  count: { flex: 1, alignItems: "center", paddingVertical: space[2], borderRadius: radius.lg, backgroundColor: color.muted },
  chips: { gap: space[2], paddingRight: space[4] },
  chip: { height: 32, paddingHorizontal: space[3], borderRadius: radius.full, justifyContent: "center", backgroundColor: color.card, borderWidth: 1, borderColor: color.border, maxWidth: 200 },
  chipOn: { backgroundColor: color.foreground, borderColor: color.foreground },
  icon: { width: 36, height: 36, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: space[2], paddingVertical: space[6] },
  centred: { textAlign: "center" },
  floatRow: { flexDirection: "row", justifyContent: "flex-end" },
  fab: { width: 52, height: 52, borderRadius: 26, backgroundColor: color.card, alignItems: "center", justifyContent: "center", ...shadow.raised },
  end: { height: 96 },
});
