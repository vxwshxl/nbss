import { useFocusEffect } from "expo-router";
import { Building2, Clock, LocateFixed, MapPin, Navigation, Phone, Ruler, Users } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { COMPANY, istTime, tel } from "@nbss/shared/company";
import { checkFence, formatDistance } from "@nbss/shared/geo";
import { EVENTS, siteChannel, type PositionBatch } from "@nbss/shared/realtime";

import { MAP_COLOR, fenceRing } from "@/components/live-map/shared";
import { MapCanvas, type MapFence, type MapPerson } from "@/components/map-canvas";
import { MapSheet, type SheetSnap } from "@/components/map-sheet";
import { Text } from "@/components/text";
import { useLivePosition } from "@/hooks/use-live-position";
import { useLoader } from "@/hooks/use-loader";
import { useAuth } from "@/lib/auth";
import { allSites, directionsUrl, myPost, openPunch, toFence, type Site } from "@/lib/duty";
import { openSettings } from "@/lib/location";
import { supabase } from "@/lib/supabase";
import { color, radius, shadow, space } from "@/theme/tokens";

/**
 * The site map, laid out as Google Maps is: the map fills the screen, a status
 * bar floats at the top, and a sheet at the bottom drags between just its
 * header, half the screen, and the whole of it.
 *
 * It shows the guard's post with its boundary, where they are against it, and
 * every colleague checked in there, moving as the fifteen-second batch arrives
 * on `site:<id>`. Any other site can be picked from the list to look at it.
 */
export default function MapRoute() {
  const { profile } = useAuth();
  const live = useLivePosition();
  const [frame, setFrame] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [covered, setCovered] = useState(300);

  const { data, reload, refreshing } = useLoader(
    useCallback(async () => {
      const [punch, post, sites] = await Promise.all([openPunch(), myPost(), allSites()]);
      return { punch, post, sites };
    }, []),
  );

  // Back on the tab: the roster may have changed since.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const postId = data?.punch?.site_id ?? data?.post?.siteId ?? null;
  const siteId = picked ?? postId;
  const site = data?.sites.find((s) => s.id === siteId) ?? null;
  const isPost = Boolean(site && site.id === postId);
  const onDuty = Boolean(data?.punch);

  const colleagues = useColleagues(onDuty ? (data?.punch?.site_id ?? null) : null, profile?.id ?? null);

  const fix = live.fix;
  const verdict = site && fix ? checkFence(toFence(site), fix) : null;
  const inside = verdict?.inside ?? false;
  const tone = !site ? color.mutedForeground : inside ? MAP_COLOR.inside : MAP_COLOR.outside;

  const shown: Site[] = showAll || !site ? (data?.sites ?? []) : [site];
  const fences: MapFence[] = shown.map((s) => ({
    id: s.id,
    name: s.name,
    ring: fenceRing({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, radiusM: s.geofence_radius_m, ring: toFence(s).ring ?? null }),
    tone: s.id === site?.id ? tone : color.primary,
  }));

  const nearby = fix
    ? (data?.sites ?? [])
        .map((s) => ({ site: s, metres: checkFence(toFence(s), fix).distanceM }))
        .sort((a, b) => a.metres - b.metres)
    : (data?.sites ?? []).map((s) => ({ site: s, metres: Number.NaN }));

  const status =
    live.problem === "denied"
      ? "Location is off for NBSS"
      : live.problem === "off"
        ? "Turn on location"
        : !site
          ? data
            ? "No post on the roster"
            : "Loading"
          : !fix
            ? "Finding you…"
            : inside
              ? "You are inside the boundary"
              : `${formatDistance(verdict?.remainingM ?? 0)} to the boundary`;

  const onSnap = (_: SheetSnap, px: number) => setCovered(px);

  return (
    <View style={styles.root}>
      <MapCanvas
        fences={fences}
        people={colleagues}
        me={fix}
        route={site && fix && !inside ? [fix, site] : null}
        frameKey={`${frame}|${site?.id ?? "all"}|${showAll ? 1 : 0}`}
        padding={{ top: 120, right: 40, bottom: Math.min(covered, 420) + 24, left: 40 }}
      />

      {/* Floating status bar and chips, where Google Maps has its search box. */}
      <View style={styles.topBar} pointerEvents="box-none">
        <Pressable
          onPress={live.problem === "denied" ? openSettings : () => setFrame((n) => n + 1)}
          style={({ pressed }) => [styles.search, pressed && styles.pressed]}
        >
          <View style={[styles.dot, { backgroundColor: tone }]} />
          <Text variant="label" weight="semibold" numberOfLines={1} style={styles.flex}>
            {status}
          </Text>
          {fix && Number.isFinite(fix.accuracyM) && (
            <Text variant="caption" tone="muted">
              ±{Math.round(fix.accuracyM)} m
            </Text>
          )}
        </Pressable>
        <View style={styles.chips}>
          {postId && (
            <Chip
              label="My post"
              icon={MapPin}
              on={siteId === postId && !showAll}
              onPress={() => {
                setPicked(null);
                setShowAll(false);
                setFrame((n) => n + 1);
              }}
            />
          )}
          <Chip label="All sites" icon={Building2} on={showAll} onPress={() => setShowAll((v) => !v)} />
          {onDuty && <Chip label={`${colleagues.length} on site`} icon={Users} on={false} />}
        </View>
      </View>

      <MapSheet
        initial="half"
        onSnap={onSnap}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={color.primary} />}
        floating={
          <View style={styles.floatRow} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show me and the site"
              onPress={() => setFrame((n) => n + 1)}
              style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
            >
              <LocateFixed size={22} color={color.primary} strokeWidth={2.2} />
            </Pressable>
          </View>
        }
        header={
          <View style={styles.headGap}>
            <Text variant="title" weight="semibold" numberOfLines={1}>
              {site?.name ?? "Sites near you"}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {site
                ? [isPost ? (onDuty ? "On duty here" : "Your post") : "Site", site.client_name, site.district].filter(Boolean).join(" · ")
                : `${data?.sites.length ?? 0} active sites`}
            </Text>
            {site && (
              <Text variant="label" weight="semibold" style={{ color: inside ? color.primaryInk : MAP_COLOR.outside }}>
                {status}
              </Text>
            )}
            <View style={styles.actions}>
              {site && (
                <Action primary label="Directions" icon={Navigation} onPress={() => void Linking.openURL(directionsUrl(site))} />
              )}
              <Action label="Call office" icon={Phone} onPress={() => void Linking.openURL(`tel:${tel(COMPANY.phone)}`)} />
              {live.problem === "denied" && <Action label="Allow location" icon={LocateFixed} onPress={openSettings} />}
            </View>
          </View>
        }
      >
        {site && (
          <View style={styles.card}>
            {isPost && data?.post && (
              <Detail icon={Clock} label="Shift" value={`${istTime(data.post.startsAt)} to ${istTime(data.post.endsAt)}`} />
            )}
            <Detail
              icon={Ruler}
              label="Boundary"
              value={toFence(site).ring ? "Drawn on the map" : `${site.geofence_radius_m} m around the gate`}
            />
            {verdict && <Detail icon={MapPin} label="From the centre" value={formatDistance(verdict.distanceM)} />}
            {site.address ? <Detail icon={Building2} label="Address" value={site.address} /> : null}
          </View>
        )}

        {onDuty && (
          <Section title={`Colleagues on site · ${colleagues.length}`}>
            {colleagues.length === 0 ? (
              <Text variant="body" tone="muted">
                Nobody else is checked in here right now.
              </Text>
            ) : (
              colleagues.map((c) => (
                <View key={c.id} style={styles.listRow}>
                  <View style={[styles.dot, { backgroundColor: c.tone }]} />
                  <Text variant="body" weight="medium" style={styles.flex}>
                    {c.label ?? "Guard"}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {c.tone === MAP_COLOR.inside ? "Inside" : c.tone === color.destructive ? "SOS" : "Outside"}
                  </Text>
                </View>
              ))
            )}
          </Section>
        )}

        <Section title="Sites">
          {nearby.map(({ site: s, metres }) => (
            <Pressable
              key={s.id}
              onPress={() => {
                setPicked(s.id === postId ? null : s.id);
                setShowAll(false);
                setFrame((n) => n + 1);
              }}
              style={({ pressed }) => [styles.listRow, s.id === site?.id && styles.listOn, pressed && styles.pressed]}
            >
              <View style={styles.siteIcon}>
                <Building2 size={16} color={s.id === postId ? color.primary : color.mutedForeground} strokeWidth={2} />
              </View>
              <View style={styles.flex}>
                <Text variant="body" weight="medium" numberOfLines={1}>
                  {s.name}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {[s.id === postId ? "Your post" : null, s.district].filter(Boolean).join(" · ") || "Site"}
                </Text>
              </View>
              {Number.isFinite(metres) && (
                <Text variant="caption" weight="semibold" tone="muted">
                  {formatDistance(metres)}
                </Text>
              )}
            </Pressable>
          ))}
        </Section>
      </MapSheet>
    </View>
  );
}

/** Colleagues on duty at the site, from its position channel. Empty off duty. */
function useColleagues(siteId: string | null, me: string | null): MapPerson[] {
  const [batch, setBatch] = useState<PositionBatch | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!siteId) return;
    const channel = supabase
      .channel(siteChannel(siteId), { config: { private: true } })
      .on("broadcast", { event: EVENTS.positions }, ({ payload }) => setBatch(payload as PositionBatch))
      .subscribe();
    return () => {
      setBatch(null);
      void supabase.removeChannel(channel);
    };
  }, [siteId]);

  const others = useMemo(
    () => (siteId ? (batch?.positions ?? []).filter((p) => p.guard_id !== me && p.site_id === siteId) : []),
    [batch, me, siteId],
  );

  // First names where the guard may read them; a plain dot where not.
  const key = others
    .map((p) => p.guard_id)
    .filter((id) => !(id in names))
    .sort()
    .join();
  useEffect(() => {
    if (!key) return;
    const ids = key.split(",");
    void supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids)
      .then(({ data }) => {
        const found: Record<string, string> = Object.fromEntries(ids.map((id) => [id, ""]));
        for (const p of data ?? []) found[p.id] = p.full_name.split(" ")[0] ?? "";
        setNames((n) => ({ ...n, ...found }));
      });
  }, [key]);

  return others.map((p) => ({
    id: p.guard_id,
    lat: p.lat,
    lng: p.lng,
    label: names[p.guard_id] || undefined,
    tone: p.mode === "emergency" ? color.destructive : p.inside_fence ? MAP_COLOR.inside : MAP_COLOR.outside,
  }));
}

type Icon = typeof Clock;

function Chip({ label, icon: I, on, onPress }: { label: string; icon: Icon; on: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
    >
      <I size={15} color={on ? color.primaryForeground : color.foreground} strokeWidth={2} />
      <Text variant="caption" weight="semibold" style={{ color: on ? color.primaryForeground : color.foreground }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Action({ label, icon: I, onPress, primary }: { label: string; icon: Icon; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, primary && styles.actionOn, pressed && styles.pressed]}
    >
      <I size={17} color={primary ? color.primaryForeground : color.primaryInk} strokeWidth={2.2} />
      <Text variant="label" weight="semibold" style={{ color: primary ? color.primaryForeground : color.primaryInk }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Detail({ icon: I, label, value }: { icon: Icon; label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <I size={18} color={color.mutedForeground} strokeWidth={2} />
      <View style={styles.flex}>
        <Text variant="caption" tone="muted">
          {label}
        </Text>
        <Text variant="body" weight="medium">
          {value}
        </Text>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label" weight="semibold" tone="muted">
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.appBg },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  dot: { width: 10, height: 10, borderRadius: 5 },

  topBar: { position: "absolute", top: space[3], left: space[3], right: space[3], gap: space[2] },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    height: 50,
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    backgroundColor: color.card,
    ...shadow.raised,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    backgroundColor: color.card,
    ...shadow.card,
  },
  chipOn: { backgroundColor: color.primary },

  floatRow: { flexDirection: "row", justifyContent: "flex-end" },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: color.card,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.raised,
  },

  headGap: { gap: 3 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[3] },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.card,
  },
  actionOn: { backgroundColor: color.primary, borderColor: color.primary },

  card: { borderRadius: radius["2xl"], backgroundColor: color.appBg, paddingHorizontal: space[4], paddingVertical: space[1] },
  detail: { flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[3] },
  section: { gap: space[2] },
  listRow: { flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[2], paddingHorizontal: space[2], borderRadius: radius.lg },
  listOn: { backgroundColor: color.accent },
  siteIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: color.muted },
});
