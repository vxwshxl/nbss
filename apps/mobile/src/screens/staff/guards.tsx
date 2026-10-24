import { useFocusEffect } from "expo-router";
import { Phone, Search, Users } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Linking, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";

import { istTime, tel } from "@nbss/shared/company";

import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelRow } from "@/components/panel";
import { Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { StatusPill } from "@/components/status-pill";
import { Text } from "@/components/text";
import { useLoader } from "@/hooks/use-loader";
import { supabase } from "@/lib/supabase";
import { color, radius, space } from "@/theme/tokens";

type Guard = { id: string; name: string; code: string; phone: string | null; avatar: string | null; site: string | null; since: string | null };
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

async function load(): Promise<Guard[]> {
  const [people, open] = await Promise.all([
    supabase.from("profiles").select("id, full_name, employee_code, phone, avatar_url").eq("role", "guard").eq("active", true).order("full_name"),
    supabase.from("attendance").select("guard_id, check_in_at, sites(name)").is("check_out_at", null),
  ]);
  const on = new Map((open.data ?? []).map((a) => [a.guard_id, a]));
  return (people.data ?? []).map((p) => {
    const a = on.get(p.id);
    return {
      id: p.id,
      name: p.full_name,
      code: p.employee_code,
      phone: p.phone,
      avatar: p.avatar_url,
      site: a ? (one(a.sites as unknown as { name: string } | null)?.name ?? "a site") : null,
      since: a?.check_in_at ?? null,
    };
  });
}

/** Every guard: who is on duty and where, a search, and a call button. */
export function StaffGuards() {
  const { data, refreshing, reload, refresh } = useLoader(load);
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "on" | "off">("all");
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  const all = useMemo(() => data ?? [], [data]);
  const list = all
    .filter((g) => (show === "on" ? g.site : show === "off" ? !g.site : true))
    .filter((g) => !q.trim() || `${g.name} ${g.code} ${g.site ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  const onCount = all.filter((g) => g.site).length;

  return (
    <Screen topInset={false} bottomInset={false} contentStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} tintColor={color.primary} onRefresh={() => void refresh()} />}>
      <PageHeader eyebrow="Security management" title="Guards" />
      <View style={styles.search}>
        <Search size={18} color={color.mutedForeground} strokeWidth={2} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search name, code or site" placeholderTextColor={color.mutedForeground} style={styles.input} />
      </View>
      <Segmented
        value={show}
        onChange={setShow}
        options={[
          { value: "all", label: "All", count: all.length },
          { value: "on", label: "On duty", count: onCount },
          { value: "off", label: "Off duty", count: all.length - onCount },
        ]}
      />
      <Panel tone="indigo" title={`${list.length} guard${list.length === 1 ? "" : "s"}`} icon={Users} bare>
        {list.length === 0 && (
          <PanelRow first>
            <Text variant="label" tone="muted">
              Nobody matches.
            </Text>
          </PanelRow>
        )}
        {list.map((g, i) => (
          <PanelRow key={g.id} first={i === 0}>
            <Avatar name={g.name} uri={g.avatar} size={38} />
            <View style={styles.flex}>
              <Text variant="label" weight="semibold" numberOfLines={1}>
                {g.name}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {g.code}
                {g.site ? ` · ${g.site} since ${istTime(g.since!)}` : ""}
              </Text>
            </View>
            <StatusPill tone={g.site ? "live" : "neutral"} label={g.site ? "On duty" : "Off"} />
            {g.phone ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Call ${g.name}`} onPress={() => void Linking.openURL(`tel:${tel(g.phone!)}`)} style={styles.call}>
                <Phone size={18} color={color.primaryInk} strokeWidth={2.2} />
              </Pressable>
            ) : null}
          </PanelRow>
        ))}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16, paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  search: { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[3], minHeight: 48, borderRadius: radius.full, backgroundColor: color.card, borderWidth: 1, borderColor: color.border },
  input: { flex: 1, fontSize: 16, color: color.foreground },
  call: { width: 40, height: 40, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: color.accent },
});
