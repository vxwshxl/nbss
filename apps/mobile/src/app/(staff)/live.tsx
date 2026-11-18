import { fetchAll } from "@nbss/shared/paging";
import { router } from "expo-router";
import { ChevronRight, LocateFixed, Maximize2, MapPin, MessageCircle, Navigation, Navigation2, Phone, SatelliteDish, Siren, UserRound, Users, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { clock12, istTime, tel } from "@nbss/shared/company";
import { freshness } from "@nbss/shared/location";
import { seesAllSites } from "@nbss/shared/identity";
import { EVENTS, LIVE_MAP_CHANNEL, siteChannel, type LivePosition, type PositionBatch } from "@nbss/shared/realtime";
import { SOS_KIND_LABEL } from "@nbss/shared/sos";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { liveHeading, guardState, STATE_COLOR, MAP_COLOR, fenceRing, initialsOf } from "@/components/live-map/shared";
import { MapCanvas, type MapFence, type MapPerson } from "@/components/map-canvas";
import { MapSheet, type SheetSnap } from "@/components/map-sheet";
import { Panel, PanelRow } from "@/components/panel";
import { PermissionsPanel } from "@/components/permissions-panel";
import { RouteDetails, useRoute } from "@/components/route-card";
import { ShowMoreRow, useShowMore } from "@/components/show-more";
import { StatusPill } from "@/components/status-pill";
import { Text } from "@/components/text";
import { useLivePosition } from "@/hooks/use-live-position";
import { useLiveTables } from "@/hooks/use-live-tables";
import { useLoader } from "@/hooks/use-loader";
import { useNow } from "@/hooks/use-now";
import { directionsUrl, liveAlerts, toFence, type Site } from "@/lib/duty";
import { useAuth } from "@/lib/auth";
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
    fetchAll(supabase.from("profiles").select("id, full_name, employee_code, phone, avatar_url").eq("role", "guard").eq("active", true)),
    fetchAll(supabase.from("site_postings").select("site_id, guard_id").eq("active", true)),
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
 * who is on duty there, who is posted, any SOS, directions. A guard on duty (on the
 * map or in a list) is shown in place, as the website's Live tracking does: the map
 * zooms to them and draws their route so far, and the sheet becomes them (status,
 * call, the route's timeline). Their full page is a tap further. Someone not on duty
 * has no route to show and opens their full page straight away.
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
  // The guard being looked at in place, and the moment picked on their timeline.
  const [guard, setGuard] = useState<string | null>(null);
  const [moment, setMoment] = useState<number | null>(null);
  const [snapTo, setSnapTo] = useState<{ to: SheetSnap; key: number } | null>(null);
  // A summary card tapped: the people it counts, listed above the sites.
  const [group, setGroup] = useState<Group | null>(null);
  // What the map frames: everything, the picked site alone, the guard, or where I am.
  const [focusAsked, setFocus] = useState<"all" | "site" | "guard" | "group" | "me">("all");
  const pick = (id: string | null) => {
    setGuard(null);
    setMoment(null);
    setPicked(id);
    setGroup(null);
    setFocus(id ? "site" : "all");
  };
  const closeGuard = () => {
    setGuard(null);
    setMoment(null);
    setFocus(group ? "group" : picked ? "site" : "all");
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

  // The office hears every site on live-map; a supervisor may not open it (0077) and
  // listens on their own sites' channels, which carry the same batch for that site.
  const { role } = useAuth();
  const topics = (role && seesAllSites(role) ? [LIVE_MAP_CHANNEL] : (board?.sites ?? []).map((s) => siteChannel(s.id))).join(",");
  useEffect(() => {
    const channels = topics
      .split(",")
      .filter(Boolean)
      .map((topic) =>
        supabase
          .channel(topic, { config: { private: true } })
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
          .subscribe(),
      );
    return () => {
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [reload, topics]);

  // Only this side of Test / Live: the guards the (mode-filtered) profiles query returned.
  const list = useMemo(() => (board ? Object.values(positions).filter((p) => board.names.has(p.guard_id)) : []), [positions, board]);
  const site = board?.sites.find((s) => s.id === picked) ?? null;
  const focus = focusAsked === "guard" && guard && !positions[guard] ? (group ? "group" : picked ? "site" : "all") : focusAsked;
  // Gone off duty while looked at: the sheet and the map go back to where they were picked from.
  const gp = guard ? (positions[guard] ?? null) : null;
  const route = useRoute(gp?.attendance_id ?? null, true);
  const momentEvent = moment != null ? route.events[moment] : undefined;
  const momentAt = momentEvent ? route.points[momentEvent.index] : undefined;
  const path = useMemo(() => (gp ? { points: route.points, upTo: momentEvent?.index ?? null } : null), [gp, route.points, momentEvent?.index]);
  const sosSites = useMemo(() => new Set(alerts.map((a) => a.site_id)), [alerts]);

  const fences = useMemo<MapFence[]>(
    () =>
      (board?.sites ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        ring: fenceRing({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, radiusM: s.geofence_radius_m, ring: toFence(s).ring ?? null }),
        tone: sosSites.has(s.id) ? color.destructive : color.primary,
        quiet: guard ? s.id !== gp?.site_id : s.id !== picked,
        // Framed: every site, or only the one tapped, or the guard's; none when centring on me.
        frame: focus === "all" || (focus === "site" && s.id === picked) || (focus === "guard" && s.id === gp?.site_id),
      })),
    [board, picked, sosSites, focus, guard, gp?.site_id],
  );
  // Each guard's state as the website's Live tracking reads it: SOS, inside, outside,
  // signal late or no signal. Colours, counts and lists all come from this.
  const sosBy = useMemo(() => new Set(alerts.map((a) => a.raised_by)), [alerts]);
  const stateOf = useCallback((p: LivePosition) => guardState(p, sosBy.has(p.guard_id), now), [sosBy, now]);

  // The four counts do not overlap, as on the website: a quiet phone counts as
  // "no signal" whether or not its last fix was inside.
  const bucket = useCallback((p: LivePosition): Group => {
    const st = stateOf(p);
    return st === "stale" || st === "offline" ? "quiet" : st;
  }, [stateOf]);
  const inGroup = (p: LivePosition, g: Group) => bucket(p) === g;
  const counted = { inside: 0, outside: 0, quiet: 0, sos: 0 };
  for (const p of list) counted[bucket(p)]++;

  // A card picked (Inside, Outside, No signal, SOS): the map shows only those guards,
  // framed, and keeps up as they move between groups. The guard picked always shows.
  const dots = useMemo<MapPerson[]>(
    () =>
      list
        .filter((p) => !group || bucket(p) === group || p.guard_id === guard)
        .map((p) => {
        const state = stateOf(p);
        const full = board?.names.get(p.guard_id)?.full_name;
        const first = full?.split(" ")[0];
        const mine = p.guard_id === guard;
        // The guard looked at stands out; a moment on their timeline moves their dot there.
        const at = mine && momentAt ? momentAt : p;
        return {
          id: p.guard_id,
          lat: at.lat,
          lng: at.lng,
          label: first,
          initials: initialsOf(full),
          // As the website: the battery beside the name, or the moment's time when one is picked.
          sub: mine && momentEvent ? istTime(new Date(momentEvent.at).toISOString()) : p.battery != null ? `${p.battery}%` : undefined,
          // No pointer for a phone that has gone quiet: its heading is old news.
          heading: mine && momentAt ? null : liveHeading(state, p.heading),
          // Grey when it has gone quiet, as on the website; a picked moment shows where they were then.
          tone: mine && momentAt ? (momentAt.inside !== false ? MAP_COLOR.inside : MAP_COLOR.outside) : STATE_COLOR[state],
          big: mine,
          frame: focus === "all" || focus === "group" || (focus === "guard" && mine),
        };
      }),
    [list, board, focus, guard, momentAt, momentEvent, stateOf, group, bucket],
  );

  // The longest silent and the farthest out first: the ones to ring.
  const grouped = group
    ? list
        .filter((p) => inGroup(p, group))
        .sort((a, b) =>
          group === "quiet"
            ? a.recorded_at.localeCompare(b.recorded_at)
            : group === "outside"
              ? (b.distance_m ?? 0) - (a.distance_m ?? 0)
              : (board?.names.get(a.guard_id)?.full_name ?? "").localeCompare(board?.names.get(b.guard_id)?.full_name ?? ""),
        )
    : [];
  const siteNames = useMemo(() => new Map((board?.sites ?? []).map((s) => [s.id, s.name])), [board]);
  const toggleGroup = (g: Group) => {
    const next = group === g ? null : g;
    setGroup(next);
    setGuard(null);
    setMoment(null);
    setFocus(next ? "group" : "all");
    setSnapTo({ to: "half", key: Date.now() });
  };
  const openPerson = (id: string) => router.push({ pathname: "/person/[id]", params: { id } });
  // On duty: shown here, on the map. Otherwise there is no route to draw, so their page.
  const pickGuard = (id: string) => {
    if (!positions[id]) return openPerson(id);
    setGuard(id);
    setMoment(null);
    setFocus("guard");
    setSnapTo({ to: "half", key: Date.now() });
  };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <MapCanvas
          fences={fences}
          people={dots}
          path={path}
          // My dot shows always; it is framed only when "my location" is asked for.
          me={me && focus === "me" ? me : me ? { ...me, frame: false } : null}
          // The guard's route arrives a moment after the tap; framed again once it has.
          frameKey={board ? `sites|${frame}|${focus}|${picked ?? ""}|${guard ?? ""}|${group ?? ""}|${guard && route.ready ? "route" : ""}` : ""}
          padding={{ top: 24, right: 24, bottom: sheetH + 16, left: 24 }}
          onPersonPress={pickGuard}
          onFencePress={pick}
        />
      </View>

      <MapSheet
        initial="half"
        onSnap={(_, px) => setSheetH(px)}
        snapTo={snapTo}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={color.primary} onRefresh={() => void refresh().then(reloadAll)} />}
        floating={
          <View style={styles.floatRow} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={guard ? "Show their route" : "Show every site"}
              onPress={() => {
                if (guard) setFocus("guard");
                else pick(null);
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
          gp && board ? (
            <GuardHead p={gp} person={board.names.get(gp.guard_id)} site={board.sites.find((s) => s.id === gp.site_id)?.name} now={now} onClose={closeGuard} />
          ) : site ? (
            <SiteHead site={site} onClose={() => pick(null)} />
          ) : (
            <View style={styles.headGap}>
              <Text variant="label" weight="semibold" tone="primary">
                Live{lastAt ? ` · updated ${istTime(lastAt)}` : " · loading…"}
              </Text>
              <Text variant="title" weight="semibold">
                {list.length} on duty · {board?.sites.length ?? 0} {board?.sites.length === 1 ? "site" : "sites"}
              </Text>
              <View style={styles.counts}>
                <Count value={counted.inside} label="inside" tone="#059669" active={group === "inside"} onPress={() => toggleGroup("inside")} />
                <Count value={counted.outside} label="outside" tone="#d97706" active={group === "outside"} onPress={() => toggleGroup("outside")} />
                <Count value={counted.quiet} label="no signal" tone="#64748b" active={group === "quiet"} onPress={() => toggleGroup("quiet")} />
                <Count value={Math.max(counted.sos, alerts.length)} label="SOS" tone={color.sos} active={group === "sos"} onPress={() => toggleGroup("sos")} />
              </View>
            </View>
          )
        }
      >
        {gp && board ? (
          <GuardBody
            p={gp}
            person={board.names.get(gp.guard_id)}
            route={route}
            moment={moment}
            onMoment={setMoment}
            onProfile={() => openPerson(gp.guard_id)}
          />
        ) : site && board ? (
          <SiteBody
            site={site}
            board={board}
            here={list.filter((p) => p.site_id === site.id)}
            alerts={alerts.filter((a) => a.site_id === site.id)}
            now={now}
            onPerson={pickGuard}
          />
        ) : (
          <>
            {/* Location and alerts, so this phone can raise and hear an SOS: only while something is missing. */}
            <PermissionsPanel onlyIfMissing />
            {alerts.length > 0 && <SosPanel alerts={alerts} />}

            {group && board && (
              <PeoplePanel
                group={group}
                people={grouped}
                names={board.names}
                siteNames={siteNames}
                now={now}
                onPerson={pickGuard}
                onClose={() => toggleGroup(group)}
              />
            )}

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
                          <Text variant="label" weight="semibold" numberOfLines={2}>
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

type Group = "inside" | "outside" | "quiet" | "sos";
const GROUP: Record<Group, { title: string; tone: "emerald" | "amber" | "slate" | "rose"; empty: string }> = {
  inside: { title: "Inside their site", tone: "emerald", empty: "Nobody on duty is inside their site." },
  outside: { title: "Outside their site", tone: "amber", empty: "Everyone on duty is inside their site." },
  quiet: { title: "No signal", tone: "slate", empty: "Every phone on duty is reporting." },
  sos: { title: "In an SOS", tone: "rose", empty: "Nobody on duty is in an SOS." },
};

/** "Just now", "4 min ago", "2 h ago": how long since their phone was last heard. */
function heard(iso: string, now: number): string {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min ` : ""}ago`;
}

/** The people a summary card counts: name and when last heard, their site and battery. */
function PeoplePanel({
  group,
  people,
  names,
  siteNames,
  now,
  onPerson,
  onClose,
}: {
  group: Group;
  people: LivePosition[];
  names: Map<string, Person>;
  siteNames: Map<string, string>;
  now: number;
  onPerson: (id: string) => void;
  onClose: () => void;
}) {
  const g = GROUP[group];
  const page = useShowMore(people, group);
  return (
    <Panel
      tone={g.tone}
      icon={group === "sos" ? Siren : Users}
      title={`${people.length} · ${g.title}`}
      subtitle="Live · tap one to see them on the map"
      action={
        <Pressable accessibilityRole="button" accessibilityLabel="Close the list" hitSlop={8} onPress={onClose} style={styles.closeSmall}>
          <X size={16} color={color.foreground} strokeWidth={2} />
        </Pressable>
      }
      bare
    >
      {people.length === 0 ? (
        <PanelRow first>
          <Text variant="label" tone="muted">
            {g.empty}
          </Text>
        </PanelRow>
      ) : (
        page.visible.map((p, i) => {
          const person = names.get(p.guard_id);
          const age = freshness(new Date(p.recorded_at).getTime(), now);
          return (
            <Pressable key={p.guard_id} accessibilityRole="button" onPress={() => onPerson(p.guard_id)}>
              {({ pressed }) => (
                <PanelRow first={i === 0} style={pressed && styles.rowPressed}>
                  <Avatar name={person?.full_name ?? "Guard"} uri={person?.avatar_url} size={34} />
                  <View style={styles.flex}>
                    <View style={styles.nameRow}>
                      <Text variant="label" weight="semibold" numberOfLines={1} style={styles.shrink}>
                        {person?.full_name ?? "Guard"}
                      </Text>
                      <Text variant="caption" weight="medium" tone="inherit" style={{ color: age === "live" ? "#059669" : age === "stale" ? "#d97706" : color.mutedForeground }}>
                        {heard(p.recorded_at, now)}
                      </Text>
                    </View>
                    {person?.employee_code ? (
                      <Text variant="caption" weight="medium" tone="muted" mono>
                        {person.employee_code}
                      </Text>
                    ) : null}
                    <Text variant="caption" tone="muted" numberOfLines={2}>
                      {[
                        siteNames.get(p.site_id ?? "") ?? "A site",
                        group === "outside" ? `${Math.round(p.distance_m ?? 0)} m out` : null,
                        p.battery != null ? `${p.battery}%${p.charging ? " charging" : ""}` : "battery -",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={color.mutedForeground} strokeWidth={2} />
                </PanelRow>
              )}
            </Pressable>
          );
        })
      )}
      <ShowMoreRow rest={page.rest} onPress={page.more} />
    </Panel>
  );
}

function GuardHead({ p, person, site, now, onClose }: { p: LivePosition; person?: Person; site?: string; now: number; onClose: () => void }) {
  const age = freshness(new Date(p.recorded_at).getTime(), now);
  return (
    <View style={styles.siteHead}>
      <Avatar name={person?.full_name ?? "Guard"} uri={person?.avatar_url} size={44} />
      <View style={styles.flex}>
        <Text variant="label" weight="semibold" tone="primary" numberOfLines={1}>
          {site || "On duty"}
        </Text>
        <Text variant="title" weight="semibold" numberOfLines={1}>
          {person?.full_name ?? "Guard"}
        </Text>
        {person?.employee_code ? (
          <Text variant="label" weight="medium" tone="muted" mono>
            {person.employee_code}
          </Text>
        ) : null}
        <View style={styles.pillRow}>
          <StatusPill tone={p.mode === "emergency" ? "danger" : age} label={p.mode === "emergency" ? "SOS" : age === "live" ? "Live" : age === "stale" ? "No signal" : "Lost"} />
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {p.inside_fence ? "Inside" : `${Math.round(p.distance_m ?? 0)} m out`} · {istTime(p.recorded_at)}
          </Text>
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose} style={styles.close}>
        <X size={18} color={color.foreground} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

function GuardBody({
  p,
  person,
  route,
  moment,
  onMoment,
  onProfile,
}: {
  p: LivePosition;
  person?: Person;
  route: ReturnType<typeof useRoute>;
  moment: number | null;
  onMoment: (i: number | null) => void;
  onProfile: () => void;
}) {
  // The four actions in one row near the top, so none of them sits under the SOS
  // button in the corner while the sheet is half way up.
  return (
    <>
      <View style={styles.actions}>
        {person?.phone ? <Action icon={Phone} label="Call" strong onPress={() => void Linking.openURL(`tel:${tel(person.phone!)}`)} /> : null}
        {person?.phone ? <Action icon={MessageCircle} label="Message" onPress={() => void Linking.openURL(`sms:${tel(person.phone!)}`)} /> : null}
        <Action icon={Navigation} label="Directions" onPress={() => void Linking.openURL(directionsUrl(p))} />
        <Action icon={UserRound} label="Profile" onPress={onProfile} />
      </View>
      <View style={styles.facts}>
        <Fact label="Battery" value={p.battery != null ? `${p.battery}%${p.charging ? " · charging" : ""}` : "-"} />
        <Fact label="Last heard" value={istTime(p.recorded_at)} />
      </View>
      <Panel tone="sky" icon={Navigation2} title="Route so far" subtitle={route.ready ? `${route.points.length} points · tap a moment to see it on the map` : "Loading the route…"} bare>
        <RouteDetails route={route} moment={moment} onMoment={onMoment} />
      </Panel>
    </>
  );
}

function Action({ icon: Icon, label, strong, onPress }: { icon: typeof Phone; label: string; strong?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.action, strong && styles.actionStrong, pressed && styles.pressed]}>
      <Icon size={20} color={strong ? "#fff" : color.foreground} strokeWidth={2.2} />
      <Text variant="caption" weight="semibold" tone="inherit" style={{ color: strong ? "#fff" : color.foreground }}>
        {label}
      </Text>
    </Pressable>
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
        <Fact label="Shift" value={site.shift_start && site.shift_end ? `${clock12(site.shift_start)} – ${clock12(site.shift_end)}` : "Not set"} />
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
            {person?.employee_code ? (
              <Text variant="caption" weight="medium" tone="muted" mono>
                {person.employee_code}
              </Text>
            ) : null}
            <Text variant="caption" tone="muted" numberOfLines={2}>
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
                <Text weight="semibold" variant="label" tone="danger" numberOfLines={2}>
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

function Count({ value, label, tone, active, onPress }: { value: number; label: string; tone: string; active?: boolean; onPress?: () => void }) {
  const body = (
    <>
      <Text variant="bodyLarge" weight="bold" tone="inherit" style={{ color: tone }}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </>
  );
  if (!onPress) return <View style={styles.count}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${value} ${label}: show who`}
      onPress={onPress}
      style={({ pressed }) => [styles.count, active && { borderColor: tone, backgroundColor: color.card }, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.appBg },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  headGap: { gap: 4 },
  pressed: { opacity: 0.7 },
  rowPressed: { backgroundColor: color.muted },
  counts: { flexDirection: "row", gap: space[2], marginTop: space[2] },
  count: { flex: 1, alignItems: "center", paddingVertical: space[2], borderRadius: radius.lg, backgroundColor: color.muted, borderWidth: 1.5, borderColor: "transparent" },
  closeSmall: { width: 30, height: 30, borderRadius: 15, backgroundColor: color.muted, alignItems: "center", justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
  shrink: { flexShrink: 1 },
  facts: { flexDirection: "row", gap: space[2] },
  fact: { flex: 1, gap: 1, padding: space[3], borderRadius: radius.lg, backgroundColor: color.muted },
  siteHead: { flexDirection: "row", gap: space[3], alignItems: "flex-start" },
  pillRow: { flexDirection: "row", alignItems: "center", gap: space[2], marginTop: 2 },
  actions: { flexDirection: "row", gap: space[2] },
  action: { flex: 1, minHeight: 64, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, backgroundColor: color.card },
  actionStrong: { backgroundColor: color.primary, borderColor: color.primary },
  siteDot: { width: 10, height: 10, borderRadius: 5 },
  sosIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: color.sos, alignItems: "center", justifyContent: "center" },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: color.muted, alignItems: "center", justifyContent: "center" },
  floatRow: { flexDirection: "row", justifyContent: "flex-end", gap: space[2] },
  fab: { width: 52, height: 52, borderRadius: 26, backgroundColor: color.card, alignItems: "center", justifyContent: "center", ...shadow.raised },
  sheetEnd: { height: 96 },
});
