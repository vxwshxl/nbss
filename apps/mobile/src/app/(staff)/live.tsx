import { router } from "expo-router";
import { ChevronRight, LocateFixed, Maximize2, MapPin, Navigation, SatelliteDish, Siren, Users, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { istTime } from "@nbss/shared/company";
import { freshness } from "@nbss/shared/location";
import { EVENTS, LIVE_MAP_CHANNEL, type LivePosition, type PositionBatch } from "@nbss/shared/realtime";
import { SOS_KIND_LABEL } from "@nbss/shared/sos";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { MAP_COLOR, fenceRing } from "@/components/live-map/shared";
import { MapCanvas, type MapFence, type MapPerson } from "@/components/map-canvas";
import { MapSheet } from "@/components/map-sheet";
import { Panel, PanelRow } from "@/components/panel";
import { PermissionsPanel } from "@/components/permissions-panel";
import { StatusPill } from "@/components/status-pill";
import { Text } from "@/components/text";
import { useLivePosition } from "@/hooks/use-live-position";
import { useLiveTables } from "@/hooks/use-live-tables";
import { useLoader } from "@/hooks/use-loader";
import { useNow } from "@/hooks/use-now";
import { directionsUrl, liveAlerts, toFence, type Site } from "@/lib/duty";
import { supabase } from "@/lib/supabase";
import { color, radius, shadow, space } from "@/theme/tokens";

type Person = { id: string; full_name: string; employee_code: string; phone: string | null; avatar_url: string | null };
type Board = {
  sites: (Site & { client_name: string | null })[];
  names: Map<string, Person>;
  /** Guards posted to each site (the standing posting), by site id. */
  posted: Map<string, string[]>;
};

const SITE_COLUMNS = "id, name, client_name, district, address, lat, lng, geofence_radius_m, max_accuracy_m, shift_start, shift_end, polygon";

async function loadBoard(): Promise<Board> {
  const [sites, people, posts] = await Promise.all([
    supabase.from("sites").select(SITE_COLUMNS).eq("active", true).order("name"),
    supabase.from("profiles").select("id, full_name, employee_code, phone, avatar_url").eq("role", "guard").eq("active", true),
    supabase.from("site_postings").select("site_id, guard_id").eq("active", true),
  ]);
  const posted = new Map<string, string[]>();
  for (const p of posts.data ?? []) posted.set(p.site_id, [...(posted.get(p.site_id) ?? []), p.guard_id]);
  return {
    sites: (sites.data ?? []) as Board["sites"],
    names: new Map(((people.data ?? []) as Person[]).map((p) => [p.id, p])),
    posted,
  };
}

/** Everyone on duty now, straight from the table: the map is right the moment it opens. */
async function loadPositions(): Promise<Record<string, LivePosition>> {
  const { data } = await supabase
    .from("guard_positions")
    .select("guard_id, site_id, attendance_id, lat, lng, accuracy_m, heading, speed_mps, battery, charging, inside_fence, distance_m, mode, recorded_at, received_at");
  return Object.fromEntries(((data ?? []) as LivePosition[]).map((p) => [p.guard_id, p]));
}

/**
 * What a supervisor sees on their phone: every site and every guard on duty on a
 * full-screen map, and a sheet over it.
 *
 * The sheet shows the whole picture until a site is tapped; then it is that site:
 * who is on duty there, who is posted, any SOS, directions. A guard (on the map or in
 * a list) opens their full page.
 *
 * Kept current two ways. Positions stream over the live-map channel (each one as it is
 * stored, plus a 15-second batch) and are merged per guard. Everything else (a check-in
 * or out from the website or a phone, a guard posted, an SOS) arrives as a table change
 * and reloads the board, which also drops anyone who has gone off duty.
 */
export default function LiveRoute() {
  const [positions, setPositions] = useState<Record<string, LivePosition>>({});
  const [lastAt, setLastAt] = useState<string | null>(null);
  const [sheetH, setSheetH] = useState(0);
  const [frame, setFrame] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  // What the map frames: everything, the picked site alone, or where I am.
  const [focus, setFocus] = useState<"all" | "site" | "me">("all");
  const pick = (id: string | null) => {
    setPicked(id);
    setFocus(id ? "site" : "all");
  };
  const live = useLivePosition();
  const me = live.fix ? { lat: live.fix.lat, lng: live.fix.lng, accuracyM: live.fix.accuracyM, heading: live.heading } : null;
  const { data: alerts = [], refreshing, reload, refresh } = useLoader(liveAlerts);
  const { data: board, reload: reloadBoard } = useLoader(loadBoard);
  // Ticks on its own, so a guard whose phone died goes amber without waiting for a batch.
  const now = useNow();

  const reloadPositions = useCallback(async () => {
    const fresh = await loadPositions();
    setLastAt(new Date().toISOString());
    // The table is the truth for who is on duty; a newer streamed fix for the same guard wins.
    setPositions((cur) => {
      const next: Record<string, LivePosition> = {};
      for (const [id, p] of Object.entries(fresh)) {
        const mine = cur[id];
        next[id] = mine && mine.recorded_at > p.recorded_at ? mine : p;
      }
      return next;
    });
  }, []);

  const reloadAll = useCallback(async () => {
    await Promise.all([reload(), reloadBoard(), reloadPositions()]);
  }, [reload, reloadBoard, reloadPositions]);

  useLiveTables(["attendance", "sos_alerts", "sites", "site_postings"], reloadAll);

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

  // Only this side of Test / Live: the guards the (mode-filtered) profiles query returned.
  const list = useMemo(() => (board ? Object.values(positions).filter((p) => board.names.has(p.guard_id)) : []), [positions, board]);
  const site = board?.sites.find((s) => s.id === picked) ?? null;
  const sosSites = useMemo(() => new Set(alerts.map((a) => a.site_id)), [alerts]);

  const fences = useMemo<MapFence[]>(
    () =>
      (board?.sites ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        ring: fenceRing({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, radiusM: s.geofence_radius_m, ring: toFence(s).ring ?? null }),
        tone: sosSites.has(s.id) ? color.destructive : color.primary,
        quiet: s.id !== picked,
        // Framed: every site, or only the one tapped; none when centring on me.
        frame: focus === "all" || (focus === "site" && s.id === picked),
      })),
    [board, picked, sosSites, focus],
  );
  const dots = useMemo<MapPerson[]>(
    () =>
      list.map((p) => ({
        id: p.guard_id,
        lat: p.lat,
        lng: p.lng,
        label: board?.names.get(p.guard_id)?.full_name.split(" ")[0],
        tone: p.mode === "emergency" ? color.destructive : p.inside_fence ? MAP_COLOR.inside : MAP_COLOR.outside,
        frame: focus === "all",
      })),
    [list, board, focus],
  );

  const quiet = list.filter((p) => freshness(new Date(p.recorded_at).getTime(), now) !== "live").length;
  const inside = list.filter((p) => p.inside_fence).length;
  const openPerson = (id: string) => router.push({ pathname: "/person/[id]", params: { id } });

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <MapCanvas
          fences={fences}
          people={dots}
          // My dot shows always; it is framed only when "my location" is asked for.
          me={me && focus === "me" ? me : me ? { ...me, frame: false } : null}
          frameKey={board ? `sites|${frame}|${focus}|${picked ?? ""}` : ""}
          padding={{ top: 24, right: 24, bottom: sheetH + 16, left: 24 }}
          onPersonPress={openPerson}
          onFencePress={pick}
        />
      </View>

      <MapSheet
        initial="half"
        onSnap={(_, px) => setSheetH(px)}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={color.primary} onRefresh={() => void refresh().then(reloadAll)} />}
        floating={
          <View style={styles.floatRow} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show every site"
              onPress={() => {
                pick(null);
                setFrame((k) => k + 1);
              }}
              style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
            >
              <Maximize2 size={20} color={color.foreground} strokeWidth={2.2} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go to my location"
              onPress={() => {
                setFocus("me");
                setFrame((k) => k + 1);
              }}
              style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
            >
              <LocateFixed size={22} color={me ? color.primary : color.mutedForeground} strokeWidth={2.2} />
            </Pressable>
          </View>
        }
        header={
          site ? (
            <SiteHead site={site} onClose={() => pick(null)} />
          ) : (
            <View style={styles.headGap}>
              <Text variant="label" weight="semibold" tone="primary">
                Live{lastAt ? ` · updated ${istTime(lastAt)}` : " · loading…"}
              </Text>
              <Text variant="title" weight="semibold">
                {list.length} on duty · {board?.sites.length ?? 0} sites
              </Text>
              <View style={styles.counts}>
                <Count value={inside} label="inside" tone="#059669" />
                <Count value={list.length - inside} label="outside" tone="#d97706" />
                <Count value={quiet} label="no signal" tone="#64748b" />
                <Count value={alerts.length} label="SOS" tone={color.sos} />
              </View>
            </View>
          )
        }
      >
        {site && board ? (
          <SiteBody
            site={site}
            board={board}
            here={list.filter((p) => p.site_id === site.id)}
            alerts={alerts.filter((a) => a.site_id === site.id)}
            now={now}
            onPerson={openPerson}
          />
        ) : (
          <>
            {/* Location and alerts, so this phone can raise and hear an SOS: only while something is missing. */}
            <PermissionsPanel onlyIfMissing />
            {alerts.length > 0 && <SosPanel alerts={alerts} />}

            <Panel tone="emerald" icon={MapPin} title="Sites" subtitle="Tap one to see it" bare>
              {(board?.sites ?? []).map((s, i) => {
                const on = list.filter((p) => p.site_id === s.id).length;
                const posted = board?.posted.get(s.id)?.length ?? 0;
                return (
                  <Pressable key={s.id} accessibilityRole="button" onPress={() => pick(s.id)}>
                    {({ pressed }) => (
                      <PanelRow first={i === 0} style={pressed && styles.rowPressed}>
                        <View style={[styles.siteDot, { backgroundColor: sosSites.has(s.id) ? color.destructive : on ? MAP_COLOR.inside : color.border }]} />
                        <View style={styles.flex}>
                          <Text variant="label" weight="semibold" numberOfLines={1}>
                            {s.name}
                          </Text>
                          <Text variant="caption" tone="muted" numberOfLines={1}>
                            {[s.district, `${on} on duty`, `${posted} posted`].filter(Boolean).join(" · ")}
                          </Text>
                        </View>
                        <ChevronRight size={16} color={color.mutedForeground} strokeWidth={2} />
                      </PanelRow>
                    )}
                  </Pressable>
                );
              })}
            </Panel>
          </>
        )}
        <View style={styles.sheetEnd} />
      </MapSheet>
    </View>
  );
}

function SiteHead({ site, onClose }: { site: Board["sites"][number]; onClose: () => void }) {
  return (
    <View style={styles.siteHead}>
      <View style={styles.flex}>
        <Text variant="label" weight="semibold" tone="primary" numberOfLines={1}>
          {[site.client_name, site.district].filter(Boolean).join(" · ") || "Site"}
        </Text>
        <Text variant="title" weight="semibold" numberOfLines={2}>
          {site.name}
        </Text>
        {site.address ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {site.address}
          </Text>
        ) : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to every site" hitSlop={8} onPress={onClose} style={styles.close}>
        <X size={18} color={color.foreground} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

function SiteBody({
  site,
  board,
  here,
  alerts,
  now,
  onPerson,
}: {
  site: Board["sites"][number];
  board: Board;
  here: LivePosition[];
  alerts: Awaited<ReturnType<typeof liveAlerts>>;
  now: number;
  onPerson: (id: string) => void;
}) {
  const posted = (board.posted.get(site.id) ?? []).map((id) => board.names.get(id)).filter(Boolean) as Person[];
  const inside = here.filter((p) => p.inside_fence).length;
  return (
    <>
      <View style={styles.counts}>
        <Count value={here.length} label="on duty" tone="#059669" />
        <Count value={inside} label="inside" tone="#0284c7" />
        <Count value={posted.length} label="posted" tone="#7c3aed" />
        <Count value={alerts.length} label="SOS" tone={color.sos} />
      </View>
      <View style={styles.facts}>
        <Fact label="Shift" value={site.shift_start && site.shift_end ? `${site.shift_start.slice(0, 5)} – ${site.shift_end.slice(0, 5)}` : "Not set"} />
        <Fact label="Boundary" value={site.polygon ? "Drawn area" : `${site.geofence_radius_m} m circle`} />
      </View>
      <Button label="Directions" icon={Navigation} variant="outline" fullWidth onPress={() => void Linking.openURL(directionsUrl(site))} />

      {alerts.length > 0 && <SosPanel alerts={alerts} />}

      <Panel tone="indigo" icon={SatelliteDish} title={`${here.length} on duty here`} bare>
        {here.length === 0 ? (
          <PanelRow first>
            <Text variant="label" tone="muted">
              Nobody is checked in here.
            </Text>
          </PanelRow>
        ) : (
          here.map((p, i) => <GuardRow key={p.guard_id} p={p} person={board.names.get(p.guard_id)} now={now} first={i === 0} onPress={() => onPerson(p.guard_id)} />)
        )}
      </Panel>

      <Panel tone="violet" icon={Users} title={`${posted.length} posted`} subtitle="The standing posting" bare>
        {posted.length === 0 ? (
          <PanelRow first>
            <Text variant="label" tone="muted">
              No guard is posted here. Post one from the website.
            </Text>
          </PanelRow>
        ) : (
          posted.map((g, i) => (
            <Pressable key={g.id} accessibilityRole="button" onPress={() => onPerson(g.id)}>
              {({ pressed }) => (
                <PanelRow first={i === 0} style={pressed && styles.rowPressed}>
                  <Avatar name={g.full_name} uri={g.avatar_url} size={34} />
                  <View style={styles.flex}>
                    <Text variant="label" weight="semibold" numberOfLines={1}>
                      {g.full_name}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {g.employee_code}
                      {here.some((h) => h.guard_id === g.id) ? " · on duty" : ""}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={color.mutedForeground} strokeWidth={2} />
                </PanelRow>
              )}
            </Pressable>
          ))
        )}
      </Panel>
    </>
  );
}

function GuardRow({ p, person, site, now, first, onPress }: { p: LivePosition; person?: Person; site?: string; now: number; first: boolean; onPress: () => void }) {
  const age = freshness(new Date(p.recorded_at).getTime(), now);
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {({ pressed }) => (
        <PanelRow first={first} style={pressed && styles.rowPressed}>
          <Avatar name={person?.full_name ?? "Guard"} uri={person?.avatar_url} size={34} />
          <View style={styles.flex}>
            <Text weight="semibold" variant="label" numberOfLines={1}>
              {person?.full_name ?? "Guard"}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {[site, p.inside_fence ? "inside" : `${Math.round(p.distance_m ?? 0)} m out`, p.battery !== null ? `${p.battery}%` : null].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <StatusPill tone={p.mode === "emergency" ? "danger" : age} label={p.mode === "emergency" ? "SOS" : age === "live" ? "Live" : age === "stale" ? "No signal" : "Lost"} />
        </PanelRow>
      )}
    </Pressable>
  );
}

function SosPanel({ alerts }: { alerts: Awaited<ReturnType<typeof liveAlerts>> }) {
  return (
    <Panel tone="rose" title={`${alerts.length} live SOS`} icon={Siren} bare>
      {alerts.map((a, i) => (
        <Pressable key={a.id} accessibilityRole="button" onPress={() => router.push(`/sos/${a.id}`)}>
          {({ pressed }) => (
            <PanelRow first={i === 0} style={pressed && styles.rowPressed}>
              <View style={styles.sosIcon}>
                <Siren size={18} color="#fff" strokeWidth={2.2} />
              </View>
              <View style={styles.flex}>
                <Text weight="semibold" variant="label" tone="danger" numberOfLines={1}>
                  {SOS_KIND_LABEL[a.kind]} · {a.site_name ?? "Unknown site"}
                </Text>
                <Text variant="caption" tone="muted">
                  {a.raiser_name ?? "Someone"} · {istTime(a.raised_at)}
                </Text>
              </View>
              <ChevronRight size={16} color={color.mutedForeground} strokeWidth={2} />
            </PanelRow>
          )}
        </Pressable>
      ))}
    </Panel>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="label" weight="semibold" numberOfLines={1}>
        {value}
      </Text>
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
  rowPressed: { backgroundColor: color.muted },
  counts: { flexDirection: "row", gap: space[2], marginTop: space[2] },
  count: { flex: 1, alignItems: "center", paddingVertical: space[2], borderRadius: radius.lg, backgroundColor: color.muted },
  facts: { flexDirection: "row", gap: space[2] },
  fact: { flex: 1, gap: 1, padding: space[3], borderRadius: radius.lg, backgroundColor: color.muted },
  siteHead: { flexDirection: "row", gap: space[3], alignItems: "flex-start" },
  siteDot: { width: 10, height: 10, borderRadius: 5 },
  sosIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: color.sos, alignItems: "center", justifyContent: "center" },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: color.muted, alignItems: "center", justifyContent: "center" },
  floatRow: { flexDirection: "row", justifyContent: "flex-end", gap: space[2] },
  fab: { width: 52, height: 52, borderRadius: 26, backgroundColor: color.card, alignItems: "center", justifyContent: "center", ...shadow.raised },
  sheetEnd: { height: 96 },
});
