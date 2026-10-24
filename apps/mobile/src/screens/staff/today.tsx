import { useFocusEffect } from "expo-router";
import { CalendarClock, CircleCheckBig, Clock3, Phone, UserRoundX } from "lucide-react-native";
import { useCallback } from "react";
import { Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { istTime, tel } from "@nbss/shared/company";
import { shiftTypeLabel } from "@nbss/shared/shifts";

import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelRow } from "@/components/panel";
import { CardGrid, Screen } from "@/components/screen";
import { StatCard } from "@/components/stat-card";
import { Text } from "@/components/text";
import { useLoader } from "@/hooks/use-loader";
import { useNow } from "@/hooks/use-now";
import { supabase } from "@/lib/supabase";
import { color, radius } from "@/theme/tokens";

type Duty = { id: string; starts_at: string; ends_at: string; status: string; shift_type: string | null; guard: string; phone: string | null; site: string; grace: number; inAt: string | null };
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

async function load(): Promise<Duty[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86_400_000);
  const [shifts, open] = await Promise.all([
    supabase
      .from("shifts")
      .select("id, guard_id, starts_at, ends_at, status, shift_type, profiles!shifts_guard_id_fkey(full_name, phone), sites(name, grace_minutes)")
      .neq("status", "cancelled")
      .lt("starts_at", end.toISOString())
      .gt("ends_at", start.toISOString())
      .order("starts_at"),
    supabase.from("attendance").select("guard_id, shift_id, check_in_at").is("check_out_at", null),
  ]);
  const inAt = new Map((open.data ?? []).map((a) => [a.shift_id ?? a.guard_id, a.check_in_at]));
  return (shifts.data ?? []).map((s) => {
    const p = one(s.profiles as unknown as { full_name: string; phone: string | null } | null);
    const site = one(s.sites as unknown as { name: string; grace_minutes: number } | null);
    return {
      id: s.id,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      status: s.status,
      shift_type: s.shift_type,
      guard: p?.full_name ?? "A guard",
      phone: p?.phone ?? null,
      site: site?.name ?? "A site",
      grace: site?.grace_minutes ?? 10,
      inAt: inAt.get(s.id) ?? (s.guard_id ? (inAt.get(s.guard_id) ?? null) : null),
    };
  });
}

/** Today across every site: who has not arrived, who is on duty, who is coming, who is done. */
export function StaffToday() {
  const { data, refreshing, reload, refresh } = useLoader(load);
  const now = useNow(60_000);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  const all = data ?? [];
  const late = all.filter((d) => !d.inAt && d.status === "scheduled" && new Date(d.starts_at).getTime() + d.grace * 60_000 < now && new Date(d.ends_at).getTime() > now);
  const on = all.filter((d) => d.inAt);
  const coming = all.filter((d) => !d.inAt && d.status === "scheduled" && new Date(d.starts_at).getTime() + d.grace * 60_000 >= now);
  const done = all.filter((d) => !d.inAt && (d.status === "completed" || d.status === "missed" || new Date(d.ends_at).getTime() <= now));

  return (
    <Screen topInset={false} bottomInset={false} contentStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} tintColor={color.primary} onRefresh={() => void refresh()} />}>
      <PageHeader eyebrow="Shift management" title="Today" />
      <CardGrid columns={2}>
        <StatCard label="Not arrived" value={String(late.length)} hint="Past start + grace" icon={UserRoundX} tone={late.length ? "rose" : "slate"} />
        <StatCard label="On duty" value={String(on.length)} hint="Checked in now" icon={CircleCheckBig} tone="emerald" />
        <StatCard label="Coming up" value={String(coming.length)} hint="Later today" icon={CalendarClock} tone="sky" />
        <StatCard label="Done" value={String(done.length)} hint="Finished or missed" icon={Clock3} tone="violet" />
      </CardGrid>
      <Group title="Not arrived" tone="rose" rows={late} note={(d) => `Due ${istTime(d.starts_at)}`} />
      <Group title="On duty" tone="emerald" rows={on} note={(d) => `In since ${istTime(d.inAt!)}`} />
      <Group title="Coming up" tone="sky" rows={coming} note={(d) => `Starts ${istTime(d.starts_at)}`} />
      <Group title="Done" tone="slate" rows={done} note={(d) => (d.status === "missed" ? "Missed" : `Ended ${istTime(d.ends_at)}`)} />
    </Screen>
  );
}

function Group({ title, tone, rows, note }: { title: string; tone: "rose" | "emerald" | "sky" | "slate"; rows: Duty[]; note: (d: Duty) => string }) {
  if (rows.length === 0) return null;
  return (
    <Panel tone={tone} title={title} subtitle={`${rows.length}`} bare>
      {rows.map((d, i) => (
        <PanelRow key={d.id} first={i === 0}>
          <Avatar name={d.guard} size={36} />
          <View style={styles.flex}>
            <Text variant="label" weight="semibold" numberOfLines={1}>
              {d.guard}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {d.site} · {[shiftTypeLabel(d.shift_type), note(d)].filter(Boolean).join(" · ")}
            </Text>
          </View>
          {d.phone ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Call ${d.guard}`} onPress={() => void Linking.openURL(`tel:${tel(d.phone!)}`)} style={styles.call}>
              <Phone size={18} color={color.primaryInk} strokeWidth={2.2} />
            </Pressable>
          ) : null}
        </PanelRow>
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  body: { gap: 20, paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  call: { width: 40, height: 40, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: color.accent },
});
