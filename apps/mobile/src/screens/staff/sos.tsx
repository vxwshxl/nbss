import { router, useFocusEffect } from "expo-router";
import { ChevronRight, History, ShieldCheck, Siren } from "lucide-react-native";
import { useCallback, useEffect } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { istTime } from "@nbss/shared/company";
import { SOS_KIND_LABEL, SOS_STATUS_LABEL, type SosKind, type SosStatus } from "@nbss/shared/sos";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelRow } from "@/components/panel";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { useLoader } from "@/hooks/use-loader";
import { Notifications } from "@/lib/push";
import { supabase } from "@/lib/supabase";
import { color, radius } from "@/theme/tokens";

type Row = { id: string; kind: SosKind; status: SosStatus; raised_at: string; guard: string; site: string };
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

async function load(): Promise<Row[]> {
  const { data } = await supabase
    .from("sos_alerts")
    .select("id, kind, status, raised_at, profiles!sos_alerts_raised_by_fkey(full_name), sites(name)")
    .gte("raised_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
    .order("raised_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((a) => ({
    id: a.id,
    kind: a.kind as SosKind,
    status: a.status as SosStatus,
    raised_at: a.raised_at,
    guard: one(a.profiles as unknown as { full_name: string } | null)?.full_name ?? "A guard",
    site: one(a.sites as unknown as { name: string } | null)?.name ?? "A site",
  }));
}

/** Every SOS: the open ones to act on, then the last week's for the record. Tap one for its map. */
export function StaffSos() {
  const { data, refreshing, reload, refresh } = useLoader(load);
  useFocusEffect(
    useCallback(() => {
      void reload();
      const t = setInterval(() => void reload(), 20_000);
      return () => clearInterval(t);
    }, [reload]),
  );
  useEffect(() => {
    const sub = Notifications?.addNotificationReceivedListener((n) => {
      if ((n.request.content.data as { type?: string } | null)?.type === "sos") void reload();
    });
    return () => sub?.remove();
  }, [reload]);
  const all = data ?? [];
  const live = all.filter((a) => a.status === "active" || a.status === "acknowledged");
  const past = all.filter((a) => !(a.status === "active" || a.status === "acknowledged"));

  return (
    <Screen topInset={false} bottomInset={false} contentStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} tintColor={color.sos} onRefresh={() => void refresh()} />}>
      <PageHeader eyebrow="Security management" title="SOS" />
      {data && live.length === 0 && <EmptyState icon={ShieldCheck} title="No SOS open" body="Every site is quiet. A new SOS rings this phone and appears here." />}
      {live.length > 0 && (
        <Panel tone="rose" title={`${live.length} open`} icon={Siren} bare>
          {live.map((a, i) => (
            <Item key={a.id} a={a} first={i === 0} />
          ))}
        </Panel>
      )}
      {past.length > 0 && (
        <Panel tone="slate" title="Last 7 days" icon={History} bare>
          {past.map((a, i) => (
            <Item key={a.id} a={a} first={i === 0} />
          ))}
        </Panel>
      )}
    </Screen>
  );
}

function Item({ a, first }: { a: Row; first: boolean }) {
  const open = a.status === "active" || a.status === "acknowledged";
  return (
    <Pressable onPress={() => router.push(`/sos/${a.id}`)} accessibilityRole="button">
      {({ pressed }) => (
        <PanelRow first={first} style={pressed && styles.pressedRow}>
          <View style={[styles.icon, { backgroundColor: open ? color.sos : color.muted }]}>
            <Siren size={18} color={open ? "#fff" : color.mutedForeground} strokeWidth={2.2} />
          </View>
          <View style={styles.flex}>
            <Text variant="label" weight="semibold" numberOfLines={1}>
              {a.guard} · {SOS_KIND_LABEL[a.kind]}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {a.site} · {istTime(a.raised_at)} · {SOS_STATUS_LABEL[a.status]}
            </Text>
          </View>
          <ChevronRight size={18} color={color.mutedForeground} strokeWidth={2} />
        </PanelRow>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { gap: 20, paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  icon: { width: 38, height: 38, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  pressedRow: { backgroundColor: color.muted },
});
