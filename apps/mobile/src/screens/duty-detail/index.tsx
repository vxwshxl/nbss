import { router } from "expo-router";
import { ArrowLeft, CalendarDays, CalendarX2, Clock, MapPin, Navigation, NotebookPen, Pause, Play, Route as RouteIcon, UserRoundX } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { distanceMetres, formatDistance, toRing } from "@nbss/shared/geo";
import { shiftTypeLabel } from "@nbss/shared/shifts";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { fenceRing } from "@/components/live-map/shared";
import { MapCanvas, type MapPerson } from "@/components/map-canvas";
import { Panel, PanelRow } from "@/components/panel";
import { Screen } from "@/components/screen";
import { SolidButton } from "@/components/solid-button";
import { StatusPill } from "@/components/status-pill";
import { Text } from "@/components/text";
import { useNow } from "@/hooks/use-now";
import {
  directionsUrl,
  dutyOutcome,
  handoverNotes,
  myDuty,
  myRoute,
  OUTCOME_LABEL,
  withdrawReplacement,
  type HandoverNote,
  type RoutePoint,
  type MyDuty,
} from "@/lib/duty";
import { AskCover, clock, hm, OUTCOME_TONE } from "@/screens/duties";
import { color, radius, space } from "@/theme/tokens";

const IST = "Asia/Kolkata";
const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const REQUEST_LABEL = { open: "Waiting for the office", assigned: "Cover found", declined: "Declined by the office", withdrawn: "Withdrawn" } as const;

/**
 * One duty in full, pushed over My duties: where (map, address, directions), when,
 * which shift, what happened (check-in and out, hours, overtime, the walked path),
 * who covered or is being covered, the cover request, and the site's handover notes.
 */
export function DutyDetail({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const now = useNow(60_000);
  const [d, setD] = useState<MyDuty | null | undefined>(undefined);
  const [trail, setTrail] = useState<RoutePoint[]>([]);
  // Where the playback head is (an index into the route), or null when not playing.
  const [head, setHead] = useState<number | null>(null);
  const [notes, setNotes] = useState<HandoverNote[]>([]);
  const [asking, setAsking] = useState<MyDuty | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pulls, setPulls] = useState(0);
  const [pulling, setPulling] = useState(false);

  useEffect(() => {
    let live = true;
    void myDuty(id).then(async (duty) => {
      if (!live) return;
      setD(duty);
      if (!duty) return setPulling(false);
      const [t, n] = await Promise.all([
        duty.attendance?.id ? myRoute(duty.attendance.id) : Promise.resolve([]),
        handoverNotes(duty.site.id),
      ]);
      if (!live) return;
      setTrail(t);
      setNotes(n);
      setPulling(false);
    });
    return () => {
      live = false;
    };
  }, [id, pulls]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(guard)/duties"));

  const header = (
    <View style={[styles.top, { paddingTop: insets.top + space[2] }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={8} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <ArrowLeft size={20} color={color.foreground} strokeWidth={2} />
      </Pressable>
      <View style={styles.flex}>
        <Text variant="micro" weight="semibold" tone="primary" uppercase>
          Duty
        </Text>
        <Text variant="label" weight="semibold" numberOfLines={1}>
          {d ? d.site.name : " "}
        </Text>
      </View>
    </View>
  );

  if (d === null) {
    return (
      <View style={styles.fill}>
        {header}
        <EmptyState icon={CalendarDays} title="Duty not found" body="It may have been taken off the roster." />
      </View>
    );
  }

  const outcome = d ? dutyOutcome(d, now) : null;
  const site = d?.site;
  const mapSite = site ? { id: site.id, name: site.name, lat: site.lat, lng: site.lng, radiusM: site.geofence_radius_m, ring: toRing(site.polygon) } : null;
  const type = d ? shiftTypeLabel(d.shift_type) : null;
  const a = d?.attendance ?? null;
  const canAsk = !!d && d.status === "scheduled" && !d.replaced_by && new Date(d.ends_at).getTime() > now;
  const open = d?.request?.status === "open";

  const withdraw = async () => {
    if (!d?.request) return;
    const r = await withdrawReplacement(d.request.id);
    setNote(r.ok ? { tone: "ok", text: "Request withdrawn. The duty is yours again." } : { tone: "bad", text: r.error ?? "That did not go through." });
    setPulls((n) => n + 1);
  };

  return (
    <View style={styles.fill}>
      {header}
      <Screen
        topInset={false}
        contentStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={() => {
              setPulling(true);
              setPulls((n) => n + 1);
            }}
            tintColor={color.primary}
          />
        }
      >
        <View style={styles.mapPanel}>
          {mapSite ? (
            <MapCanvas
              style={styles.map}
              fences={[{ id: mapSite.id, name: mapSite.name, ring: fenceRing(mapSite), tone: color.primary }]}
              trail={trail.length > 1 ? (head == null ? trail : trail.slice(0, head + 1)) : null}
              people={routeMarks(trail, head, !!a?.check_out_at)}
              frameKey={`${mapSite.id}|${trail.length > 1 ? "route" : "site"}`}
              padding={{ top: 24, right: 24, bottom: 24, left: 24 }}
            />
          ) : (
            <View style={styles.map} />
          )}
        </View>

        {d && outcome && (
          <View style={styles.titleBlock}>
            <Text variant="sectionTitle" weight="semibold">
              {d.site.name}
            </Text>
            {d.site.address ? (
              <View style={styles.inline}>
                <MapPin size={14} color={color.mutedForeground} strokeWidth={2} />
                <Text variant="label" tone="muted" style={styles.flex}>
                  {[d.site.address, d.site.district].filter(Boolean).join(", ")}
                </Text>
              </View>
            ) : null}
            <View style={styles.pills}>
              <StatusPill tone={OUTCOME_TONE[outcome]} label={outcome === "on_duty" ? "On duty now" : OUTCOME_LABEL[outcome]} />
              {d.site.active === false && <StatusPill tone="neutral" label="Site closed" />}
            </View>
          </View>
        )}

        {note && (
          <Panel tone={note.tone === "ok" ? "emerald" : "rose"}>
            <Text variant="body">{note.text}</Text>
          </Panel>
        )}

        {d && (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button label="Directions" icon={Navigation} variant="outline" fullWidth onPress={() => void Linking.openURL(directionsUrl(d.site))} />
            </View>
            {canAsk && (
              <View style={styles.flex}>
                {open ? (
                  <Button label="Withdraw" icon={CalendarX2} variant="outline" fullWidth onPress={() => void withdraw()} />
                ) : (
                  <Button label="I can't come" icon={UserRoundX} variant="outline" fullWidth onPress={() => setAsking(d)} />
                )}
              </View>
            )}
          </View>
        )}

        {d && (
          <Panel tone="emerald" title="Shift" icon={CalendarDays} bare>
            <Field first label="Date" value={longDate(d.starts_at)} />
            <Field label="Duty" value={d.kind === "off_roster" ? "Not on the roster" : (type ?? "Duty")} />
            {d.kind !== "off_roster" && <Field label="Time" value={`${clock(d.starts_at)} – ${clock(d.ends_at)}`} />}
            {d.replacing && <Field label="Covering for" value={d.replacing} />}
            {d.replaced_by && <Field label="Handed to" value={d.replaced_by} />}
            {d.request && <Field label="Cover request" value={REQUEST_LABEL[d.request.status]} sub={d.request.reason ?? undefined} />}
            {d.notes ? <Field label="Note" value={d.notes} /> : null}
          </Panel>
        )}

        {trail.length > 1 && <RoutePanel route={trail} head={head} onHead={setHead} />}

        {d && (
          <Panel tone="sky" title="Attendance" icon={Clock} bare>
            <Field first label="Checked in" value={a?.check_in_at ? when(a.check_in_at) : "-"} />
            <Field label="Checked out" value={a?.check_out_at ? when(a.check_out_at) : a?.check_in_at ? "Still on duty" : "-"} />
            <Field label="Worked" value={a?.worked_minutes != null ? hm(a.worked_minutes) : "-"} />
            {a?.overtime_minutes ? <Field label="Overtime" value={hm(a.overtime_minutes)} /> : null}
            {a?.device_flag ? <Field label="Phone" value={a.device_flag === "shared_device" ? "Another guard's phone" : "Not your approved phone"} warn /> : null}
            {a?.review_note ? <Field label="Office note" value={a.review_note} /> : null}
          </Panel>
        )}

        {d && notes.length > 0 && (
          <Panel tone="amber" title="Handover notes" subtitle="Left at this site in the last 3 days" icon={NotebookPen} bare>
            {notes.map((n, i) => (
              <PanelRow key={n.id} first={i === 0} style={styles.noteRow}>
                <Text variant="caption" tone="muted">
                  {when(n.created_at)}
                </Text>
                <Text variant="label">{n.body}</Text>
              </PanelRow>
            ))}
          </Panel>
        )}
      </Screen>

      <AskCover
        duty={asking}
        onClose={() => setAsking(null)}
        onDone={(r) => {
          setNote(r);
          setPulls((n) => n + 1);
        }}
      />
    </View>
  );
}

const clockOf = (ms: number) => new Date(ms).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });

/** Start (S), end (E) and, while playing, where the guard was at that moment. */
function routeMarks(route: RoutePoint[], head: number | null, ended: boolean): MapPerson[] {
  if (route.length < 2) return [];
  const first = route[0]!;
  const last = route.at(-1)!;
  const marks: MapPerson[] = [{ id: "start", lat: first.lat, lng: first.lng, tone: "#059669", label: `In ${clockOf(first.at)}` }];
  if (ended) marks.push({ id: "end", lat: last.lat, lng: last.lng, tone: "#1f2937", label: `Out ${clockOf(last.at)}` });
  if (head != null) {
    const h = route[Math.min(head, route.length - 1)]!;
    // No label: the time is under the bar, and a fixed marker glides instead of being redrawn.
    marks.push({ id: "head", lat: h.lat, lng: h.lng, tone: "#2563eb", big: true });
  }
  return marks;
}

/**
 * The duty's route, as the console's Route history shows it: how far, how long, how
 * much of it outside the boundary, a bar of the shift (green inside, amber outside)
 * that can be tapped to jump to a moment, and Play to watch it from check-in.
 */
function RoutePanel({ route, head, onHead }: { route: RoutePoint[]; head: number | null; onHead: (i: number | null) => void }) {
  const [playing, setPlaying] = useState(false);
  const [barW, setBarW] = useState(0);
  const start = route[0]!.at;
  const end = route.at(-1)!.at;
  const span = Math.max(1, end - start);

  let walked = 0;
  let outside = 0;
  for (let i = 1; i < route.length; i++) {
    walked += distanceMetres(route[i - 1]!, route[i]!);
    if (route[i - 1]!.inside === false) outside += route[i]!.at - route[i - 1]!.at;
  }
  // Runs of inside / outside, for the bar.
  const runs: { inside: boolean; ms: number }[] = [];
  for (let i = 1; i < route.length; i++) {
    const inside = route[i - 1]!.inside !== false;
    const ms = route[i]!.at - route[i - 1]!.at;
    const lastRun = runs.at(-1);
    if (lastRun && lastRun.inside === inside) lastRun.ms += ms;
    else runs.push({ inside, ms });
  }

  // About twelve seconds from check-in to check-out, however long the shift.
  useEffect(() => {
    if (!playing) return;
    const step = Math.max(1, Math.ceil(route.length / 120));
    const t = setInterval(() => {
      const next = (head ?? -1) + step;
      if (next >= route.length - 1) {
        onHead(route.length - 1);
        setPlaying(false);
      } else onHead(next);
    }, 100);
    return () => clearInterval(t);
  }, [playing, head, route.length, onHead]);

  const at = head != null ? route[Math.min(head, route.length - 1)]! : null;
  const pos = at ? (at.at - start) / span : 0;

  const jump = (x: number) => {
    if (!barW) return;
    const target = start + (Math.max(0, Math.min(barW, x)) / barW) * span;
    let i = 0;
    while (i < route.length - 1 && route[i]!.at < target) i++;
    setPlaying(false);
    onHead(i);
  };

  return (
    <Panel tone="violet" title="Your route" subtitle={`${clockOf(start)} – ${clockOf(end)}`} icon={RouteIcon}>
      <View style={styles.routeStats}>
        <RouteStat value={formatDistance(walked)} label="walked" />
        <RouteStat value={hm(Math.round(span / 60_000))} label="tracked" />
        <RouteStat value={outside > 60_000 ? hm(Math.round(outside / 60_000)) : "0m"} label="outside" warn={outside > 60_000} />
      </View>

      <Pressable accessibilityRole="adjustable" accessibilityLabel="Route timeline. Tap to jump to a moment." onPress={(e) => jump(e.nativeEvent.locationX)} onLayout={(e) => setBarW(e.nativeEvent.layout.width)} style={styles.bar}>
        {runs.map((r, i) => (
          <View key={i} style={{ flex: r.ms, backgroundColor: r.inside ? "#10b981" : "#f59e0b" }} />
        ))}
        {at && <View pointerEvents="none" style={[styles.barHead, { left: `${pos * 100}%` }]} />}
      </Pressable>
      <View style={styles.barLegend}>
        <Text variant="caption" tone="muted">
          {clockOf(start)}
        </Text>
        <Text variant="caption" weight="semibold" tone={at ? "primary" : "muted"}>
          {at ? `${clockOf(at.at)} · ${at.inside === false ? "outside" : "inside"}` : "Green inside · amber outside"}
        </Text>
        <Text variant="caption" tone="muted">
          {clockOf(end)}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={styles.flex}>
          <SolidButton
            label={playing ? "Pause" : head != null && head >= route.length - 1 ? "Play again" : "Play route"}
            icon={playing ? Pause : Play}
            tone="blue"
            onPress={() => {
              if (playing) return setPlaying(false);
              if (head == null || head >= route.length - 1) onHead(0);
              setPlaying(true);
            }}
          />
        </View>
        {head != null && !playing && (
          <View style={styles.flex}>
            <Button label="Whole route" variant="outline" fullWidth onPress={() => onHead(null)} />
          </View>
        )}
      </View>
    </Panel>
  );
}

function RouteStat({ value, label, warn }: { value: string; label: string; warn?: boolean }) {
  return (
    <View style={styles.routeStat}>
      <Text variant="bodyLarge" weight="bold" tone={warn ? "danger" : "default"}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

function Field({ label, value, sub, first, warn }: { label: string; value: string; sub?: string; first?: boolean; warn?: boolean }) {
  return (
    <PanelRow first={first} style={styles.field}>
      <Text variant="label" tone="muted" style={styles.fieldLabel}>
        {label}
      </Text>
      <View style={styles.fieldValue}>
        <Text variant="label" weight="medium" tone={warn ? "danger" : "default"} style={styles.right}>
          {value}
        </Text>
        {sub ? (
          <Text variant="caption" tone="muted" style={styles.right}>
            {sub}
          </Text>
        ) : null}
      </View>
    </PanelRow>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.appBg },
  flex: { flex: 1, minWidth: 0 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingHorizontal: space[4],
    paddingBottom: space[2],
    backgroundColor: color.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.lineSoft,
  },
  back: { width: 38, height: 38, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: color.muted },
  pressed: { opacity: 0.6 },
  body: { gap: space[4], paddingBottom: space[10] },
  mapPanel: { height: 220, borderRadius: radius["2xl"], overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: color.lineSoft, backgroundColor: color.muted },
  map: { flex: 1, minHeight: 220 },
  titleBlock: { gap: space[1.5] },
  inline: { flexDirection: "row", alignItems: "flex-start", gap: space[1] + 2 },
  pills: { flexDirection: "row", gap: space[2], marginTop: space[1] },
  row: { flexDirection: "row", gap: space[2] },
  field: { alignItems: "flex-start" },
  fieldLabel: { width: 110 },
  fieldValue: { flex: 1, alignItems: "flex-end", gap: 2 },
  right: { textAlign: "right" },
  routeStats: { flexDirection: "row", gap: space[2] },
  routeStat: { flex: 1, alignItems: "center", paddingVertical: space[2], borderRadius: radius.lg, backgroundColor: color.muted },
  bar: { height: 14, borderRadius: 7, overflow: "hidden", flexDirection: "row", backgroundColor: color.muted },
  barHead: { position: "absolute", top: 0, bottom: 0, width: 3, marginLeft: -1.5, backgroundColor: "#1d4ed8" },
  barLegend: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space[2] },
  noteRow: { flexDirection: "column", alignItems: "flex-start", gap: 2 },
});
