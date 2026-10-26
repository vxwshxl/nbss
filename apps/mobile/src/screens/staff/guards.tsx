import { router } from "expo-router";
import { ChevronRight, Phone, Search, Users, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Linking, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";

import { istTime, tel } from "@nbss/shared/company";

import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelRow } from "@/components/panel";
import { Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { Select } from "@/components/select";
import { StatusPill } from "@/components/status-pill";
import { Text } from "@/components/text";
import { useLiveTables } from "@/hooks/use-live-tables";
import { useLoader } from "@/hooks/use-loader";
import { supabase } from "@/lib/supabase";
import { color, radius, space } from "@/theme/tokens";

type Guard = {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  avatar: string | null;
  /** A housekeeper works as a guard does; the list says which they are. */
  housekeeper: boolean;
  /** Checked in now: where, and since when. */
  dutySiteId: string | null;
  dutySite: string | null;
  since: string | null;
  /** Their standing posting. */
  postSiteId: string | null;
};
type SiteChip = { id: string; name: string; district: string | null };
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

async function load(): Promise<{ guards: Guard[]; sites: SiteChip[] }> {
  const [people, open, posts, sites] = await Promise.all([
    supabase.from("profiles").select("id, full_name, employee_code, phone, avatar_url, trade").eq("role", "guard").eq("active", true).order("full_name"),
    supabase.from("attendance").select("guard_id, site_id, check_in_at, sites(name)").is("check_out_at", null),
    supabase.from("site_postings").select("guard_id, site_id").eq("active", true).is("dates", null),
    supabase.from("sites").select("id, name, district").eq("active", true).order("name"),
  ]);
  const on = new Map((open.data ?? []).map((a) => [a.guard_id, a]));
  const post = new Map((posts.data ?? []).map((p) => [p.guard_id, p.site_id]));
  return {
    sites: (sites.data ?? []) as SiteChip[],
    guards: (people.data ?? []).map((p) => {
      const a = on.get(p.id);
      return {
        id: p.id,
        name: p.full_name,
        code: p.employee_code,
        phone: p.phone,
        avatar: p.avatar_url,
        housekeeper: p.trade === "housekeeping",
        dutySiteId: a?.site_id ?? null,
        dutySite: a ? (one(a.sites as unknown as { name: string } | null)?.name ?? "a site") : null,
        since: a?.check_in_at ?? null,
        postSiteId: post.get(p.id) ?? null,
      };
    }),
  };
}

/**
 * Every guard: on or off duty, filtered by site (where they are posted or on duty
 * now), searched by name, code or site. A tap opens their full page; the phone icon
 * calls. Current as it happens: a check-in from any phone or the website moves a guard
 * between the lists without a pull.
 */
export function StaffGuards() {
  const { data, refreshing, reload, refresh } = useLoader(load);
  useLiveTables(["attendance", "profiles", "site_postings", "sites"], reload);
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "on" | "off">("all");
  const [site, setSite] = useState<string | null>(null);

  const all = useMemo(() => data?.guards ?? [], [data]);
  const sites = data?.sites ?? [];
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const atSite = site ? all.filter((g) => g.dutySiteId === site || g.postSiteId === site) : all;
  const list = atSite
    .filter((g) => (show === "on" ? g.dutySite : show === "off" ? !g.dutySite : true))
    .filter((g) => {
      const t = q.trim().toLowerCase();
      return !t || `${g.name} ${g.code} ${g.dutySite ?? ""} ${g.postSiteId ? siteName.get(g.postSiteId) : ""}`.toLowerCase().includes(t);
    });
  const onCount = atSite.filter((g) => g.dutySite).length;

  return (
    <Screen topInset={false} bottomInset={false} contentStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} tintColor={color.primary} onRefresh={() => void refresh()} />}>
      <PageHeader eyebrow="Security management" title="Guards & housekeepers" />
      <View style={styles.search}>
        <Search size={18} color={color.mutedForeground} strokeWidth={2} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search name, code or site" placeholderTextColor={color.mutedForeground} style={styles.input} />
        {q ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear" hitSlop={8} onPress={() => setQ("")}>
            <X size={16} color={color.mutedForeground} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>

      <Select
        title="Site"
        value={site ?? "all"}
        onChange={(v) => setSite(v === "all" ? null : v)}
        options={[
          { value: "all", label: "All sites", hint: `${all.length} guards` },
          ...sites.map((s) => ({ value: s.id, label: s.name, hint: [s.district, `${all.filter((g) => g.dutySiteId === s.id || g.postSiteId === s.id).length} guards`].filter(Boolean).join(" · ") })),
        ]}
      />

      <Segmented
        value={show}
        stretch
        onChange={setShow}
        options={[
          { value: "all", label: "All", count: atSite.length },
          { value: "on", label: "On duty", count: onCount },
          { value: "off", label: "Off", count: atSite.length - onCount },
        ]}
      />

      <Panel tone="indigo" title={`${list.length} guard${list.length === 1 ? "" : "s"}`} subtitle={site ? siteName.get(site) : "Every site"} icon={Users} bare>
        {list.length === 0 && (
          <PanelRow first>
            <Text variant="label" tone="muted">
              {data ? "Nobody matches." : "Loading…"}
            </Text>
          </PanelRow>
        )}
        {list.map((g, i) => (
          <PanelRow key={g.id} first={i === 0}>
            {/* The row opens the guard; the phone beside it calls. Siblings, not nested. */}
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/person/[id]", params: { id: g.id } })} style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
              <Avatar name={g.name} uri={g.avatar} size={38} />
              <View style={styles.flex}>
                <Text variant="label" weight="semibold" numberOfLines={1}>
                  {g.name}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {g.code}
                  {g.housekeeper ? " · Housekeeper" : ""}
                  {g.dutySite ? ` · ${g.dutySite} since ${istTime(g.since!)}` : g.postSiteId ? ` · posted at ${siteName.get(g.postSiteId) ?? "a site"}` : " · not posted"}
                </Text>
              </View>
              <StatusPill tone={g.dutySite ? "live" : "neutral"} label={g.dutySite ? "On" : "Off"} />
            </Pressable>
            {g.phone ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Call ${g.name}`} hitSlop={4} onPress={() => void Linking.openURL(`tel:${tel(g.phone!)}`)} style={styles.call}>
                <Phone size={17} color={color.primaryInk} strokeWidth={2.2} />
              </Pressable>
            ) : (
              <ChevronRight size={16} color={color.mutedForeground} strokeWidth={2} />
            )}
          </PanelRow>
        ))}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14, paddingBottom: 120 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  main: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: space[3] },
  pressed: { opacity: 0.6 },
  search: { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[3], minHeight: 48, borderRadius: radius.full, backgroundColor: color.card, borderWidth: 1, borderColor: color.border },
  input: { flex: 1, fontSize: 16, color: color.foreground },
  call: { width: 38, height: 38, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: color.accent },
});
