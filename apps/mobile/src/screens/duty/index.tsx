import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  Clock3,
  LocateFixed,
  NotebookPen,
  LogIn,
  MapPin,
  MapPinOff,
  Navigation,
  Phone,
  SignalLow,
  TriangleAlert,
  Users,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COMPANY, istTime, tel } from "@nbss/shared/company";
import { shiftTypeLabel } from "@nbss/shared/shifts";
import { checkFence, distanceMetres, formatDistance, toRing } from "@nbss/shared/geo";

import { Button } from "@/components/button";
import { InfoButton } from "@/components/info";
import { LiveMap, type MapSite } from "@/components/live-map";
import { MapSheet } from "@/components/map-sheet";
import { Avatar } from "@/components/avatar";
import { Panel, PanelRow } from "@/components/panel";
import { PhoneSetup } from "@/components/phone-setup";
import { SolidButton } from "@/components/solid-button";
import { Text } from "@/components/text";
import { useLivePosition } from "@/hooks/use-live-position";
import { useLiveTables } from "@/hooks/use-live-tables";
import { useLoader } from "@/hooks/use-loader";
import { useNow } from "@/hooks/use-now";
import {
  allSites,
  checkArrival,
  directionsUrl,
  dutyAreas,
  eta,
  handoverNotes,
  myPost,
  myTrail,
  openPunch,
  punchIn,
  punchOut,
  raiseSos,
  rosteredSites,
  toFence,
  type Arrival,
  type Site,
} from "@/lib/duty";
import {
  checkTracking,
  isTracking,
  openSettings,
  requestTracking,
  type PermissionState,
} from "@/lib/location";
import { useLiveFeed } from "@/lib/live-feed";
import { feedLocations, sendHeading, syncStatus } from "@/lib/location-task";
import { CAN_RECEIVE_PUSH, IS_EXPO_GO, IS_WEB, runtimeLimitation } from "@/lib/runtime";
import { color, radius, shadow, space } from "@/theme/tokens";

/**
 * The screen a guard actually uses, laid out like a ride app: the map on top —
 * where they are, where their post is, the boundary they have to be inside — and
 * a sheet underneath with the one thing to do next.
 *
 * Check-in checks before it asks. One fresh fix is compared with the post's
 * boundary first, and a guard who is not there is told where to go (directions,
 * or "you are at the other site") instead of pressing a button that the server
 * will only refuse. The server still decides: `punch_in` runs the same maths on
 * the same fix and is the only thing that records anything.
 *
 * The permission Panel is not boilerplate. On Android 11 and later "Allow all the
 * time" cannot be requested from a dialog at all — only in Settings — and a guard
 * who stops at "While using the app" goes silent the moment the phone locks, which
 * on a supervisor's map looks the same as a guard who went home.
 */
export function Duty() {
  const live = useLivePosition();
  const now = useNow(30_000);

  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  // Kept after the sheet closes, so it slides away with its words still on it.
  const [arrival, setArrival] = useState<Exclude<Arrival, { kind: "ready" }> | null>(null);
  const [showArrival, setShowArrival] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [sheetH, setSheetH] = useState(0);
  const [askedPermission, setAskedPermission] = useState<PermissionState | null>(null);

  const load = useCallback(async () => {
    const [punch, permission, tracking, post, rostered, all, areas] = await Promise.all([
      openPunch(),
      checkTracking(),
      isTracking(),
      myPost(),
      rosteredSites(),
      allSites(),
      dutyAreas(),
    ]);
    // Your post first, then the other sites where duties are going on now. Closed
    // sites and sites with nobody rostered stay off the map; only when there is
    // nothing at all (no roster yet) is every open site offered.
    const seen = new Set(rostered.map((s) => s.id));
    const busy = new Set(areas.areas.map((a) => a.id));
    const others = all.filter((s) => !seen.has(s.id) && busy.has(s.id));
    const sites = rostered.length + others.length > 0 ? [...rostered, ...others] : all;
    const noteSite = punch?.site_id ?? post?.siteId ?? null;
    const [notes, trail] = await Promise.all([
      noteSite ? handoverNotes(noteSite) : Promise.resolve([]),
      punch ? myTrail(punch.id) : Promise.resolve([]),
    ]);
    return { punch, permission, tracking, post, sites, notes, trail, areas };
  }, []);

  const { data, refreshing, reload, refresh } = useLoader(load);
  // A change from the office (posted to a site, a duty moved, attendance corrected on the
  // website) shows at once rather than at the next pull.
  useLiveTables(["attendance", "shifts", "site_postings", "sites"], reload);

  // Colleagues and SOS, from the live feed: pushed over the socket, not polled.
  const areasNow = useLiveFeed().data ?? data?.areas;
  const mapAreas: MapSite[] = (areasNow?.areas ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    lat: a.lat,
    lng: a.lng,
    radiusM: a.geofence_radius_m,
    ring: toRing(a.polygon),
  }));
  const mapSos = {
    areaIds: (areasNow?.areas ?? []).filter((a) => a.sos).map((a) => a.id),
    raisers: (areasNow?.alerts ?? []).flatMap((x) =>
      x.lat != null && x.lng != null ? [{ id: x.raised_by, lat: x.lat, lng: x.lng, label: `SOS · ${x.mine ? "You" : x.raiser_name.split(/\s+/)[0]}` }] : [],
    ),
  };
  const mapFriends = (areasNow?.friends ?? []).flatMap((f) => (f.lat != null && f.lng != null ? [{ id: f.id, name: f.name, lat: f.lat, lng: f.lng }] : []));

  const punch = data?.punch ?? null;
  const post = data?.post ?? null;
  const sites = data?.sites ?? [];
  const tracking = data?.tracking ?? false;
  const permission = askedPermission ?? data?.permission ?? null;
  const fix = live.fix;
  const onDuty = Boolean(punch);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handover, setHandover] = useState("");

  /**
   * While on duty and this screen is open, its own fixes go into the same outbox
   * as the background task. In Expo Go that is the only thing sending at all; in a
   * build it fills in while the background stream warms up. The policy in the
   * outbox drops anything too close to the last point, so nothing is sent twice.
   */
  const fedAt = useRef(0);
  useEffect(() => {
    if (!onDuty || !fix || IS_WEB || fix.at === fedAt.current) return;
    fedAt.current = fix.at;
    // The compass rides along, so the console's arrow points the way the guard faces
    // while the app is open; in the background the GPS course is sent instead.
    void feedLocations([{ lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM, heading: live.heading, at: fix.at }]);
  }, [onDuty, fix, live.heading]);

  // Turning on the spot sends no new point, so the heading goes on its own.
  useEffect(() => {
    if (onDuty && !IS_WEB) sendHeading(live.heading);
  }, [onDuty, live.heading]);

  // The blue line of where they have been, refreshed every minute on duty.
  useEffect(() => {
    if (!onDuty) return;
    const t = setInterval(() => void reload(), 60_000);
    return () => clearInterval(t);
  }, [onDuty, reload]);

  /* ─────────────────────────── which site the map and the sheet are about */
  const byId = (id: string | null | undefined) => (id ? sites.find((s) => s.id === id) : undefined);
  const distances = fix
    ? sites
        .map((site) => ({ site, ...checkFence(toFence(site), fix) }))
        .sort((a, b) => Number(b.inside) - Number(a.inside) || a.distanceM - b.distanceM)
    : [];
  const here = distances.find((d) => d.inside)?.site;

  let target: Site | undefined;
  let targetKind: "duty" | "picked" | "post" | "here" | "nearest";
  if (onDuty) {
    target = byId(punch?.site_id);
    targetKind = "duty";
  } else if (byId(picked)) {
    target = byId(picked);
    targetKind = "picked";
  } else if (byId(post?.siteId)) {
    target = byId(post?.siteId);
    targetKind = "post";
  } else if (here) {
    target = here;
    targetKind = "here";
  } else {
    target = distances[0]?.site ?? sites[0];
    targetKind = "nearest";
  }

  // Colleagues checked in at the site this screen is about.
  const onSite = (areasNow?.friends ?? []).filter((f) => target && f.site_id === target.id);

  const verdict = target && fix ? checkFence(toFence(target), fix) : null;
  const inside = verdict?.inside ?? false;

  // A buzz the moment they step inside their post, like a ride app's "you have arrived".
  const wasInside = useRef(inside);
  useEffect(() => {
    if (inside && !wasInside.current && !onDuty) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
    wasInside.current = inside;
  }, [inside, onDuty]);

  const mapSite: MapSite | null = target
    ? {
        id: target.id,
        name: target.name,
        lat: target.lat,
        lng: target.lng,
        radiusM: target.geofence_radius_m,
        ring: toFence(target).ring ?? null,
      }
    : null;

  /* ─────────────────────────────────────────────────────────── actions */
  const doCheckIn = async (site: Site, known?: Extract<Arrival, { fix: unknown }>["fix"]) => {
    setBusy(site.id);
    setMessage(null);
    setShowArrival(false);

    let fixForPunch = known;
    if (!fixForPunch) {
      const result = await checkArrival(site, sites);
      if (result.kind !== "ready") {
        setBusy(null);
        setArrival(result);
        setShowArrival(true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
        return;
      }
      fixForPunch = result.fix;
    }

    // Asked here rather than on mount: a prompt that appears when a guard is starting
    // their shift has an obvious reason.
    setAskedPermission(await requestTracking());
    const result = await punchIn(site.id, fixForPunch);
    setBusy(null);
    setPicked(null);
    setMessage(
      result.ok
        ? {
            tone: result.tracking === false ? "bad" : "ok",
            text:
              result.tracking === false
                ? `${result.message} Your location is NOT being shared. Tell your supervisor.`
                : result.message,
          }
        : { tone: "bad", text: result.error },
    );
    if (result.ok) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    await reload();
  };

  const doPunchOut = async () => {
    setHandoverOpen(false);
    setBusy("out");
    setMessage(null);
    const result = await punchOut(handover);
    if (result.ok) setHandover("");
    setBusy(null);
    setMessage(result.ok ? { tone: "ok", text: result.message } : { tone: "bad", text: result.error });
    await reload();
  };

  const [sosFailed, setSosFailed] = useState<{ fix: { lat: number; lng: number } | null } | null>(null);
  const doRaiseSos = async () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    setMessage({ tone: "bad", text: "Sending SOS…" });
    const result = await raiseSos();
    if (!result.ok) {
      setMessage({ tone: "bad", text: result.error });
      // No internet: a phone call and an SMS still go through on the mobile network.
      setSosFailed({ fix: result.fix ?? null });
      return;
    }
    setMessage(null);
    router.push(`/sos/${result.alertId}`);
  };

  const directions = (site: Pick<Site, "lat" | "lng">) => void Linking.openURL(directionsUrl(site));
  const callDesk = () => void Linking.openURL(`tel:${tel(COMPANY.phone)}`);

  if (data === undefined) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  const since = punch?.check_in_at ? new Date(punch.check_in_at) : null;
  // Clamped: the clock ticks every 30 s, so just after checking in it can trail the server.
  const elapsed = since ? Math.max(0, Math.floor((now - since.getTime()) / 60000)) : 0;
  const remaining = verdict?.remainingM ?? null;
  const time = remaining === null ? null : eta(remaining);
  const others = distances.filter((d) => d.site.id !== target?.id).slice(0, 5);

  const eyebrow = {
    duty: `On duty · since ${since ? istTime(since) : "-"} IST`,
    picked: "Checking in at",
    post: post
      ? `${post.replacing ? `Replacing ${post.replacing}` : "Your duty"} · ${shiftTypeLabel(post.shiftType) ? `${shiftTypeLabel(post.shiftType)} · ` : ""}${istTime(post.startsAt)} – ${istTime(post.endsAt)}`
      : "Your duty",
    here: "You are at",
    nearest: "Nearest site",
  }[targetKind];

  return (
    <View style={styles.root}>
      {/* ───────────────────────────────────────────────────────── the map */}
      <View style={StyleSheet.absoluteFill}>
        <LiveMap
          me={fix ? { ...fix, heading: live.heading } : null}
          site={mapSite}
          inside={inside}
          trail={onDuty ? (data?.trail ?? null) : null}
          areas={mapAreas}
          friends={mapFriends}
          onFriendPress={() => router.navigate("/(guard)/alerts")}
          sos={mapSos}
          onSosPress={() => router.navigate("/(guard)/alerts")}
          // Re-framed on the recenter button, and when the guard has moved a few
          // hundred metres — the blue dot never walks off the edge on its own.
          frameKey={`${frameKey}:${fix ? `${Math.round(fix.lat * 300)},${Math.round(fix.lng * 300)}` : "-"}`}
          padding={{ top: 80, right: 48, bottom: sheetH + 32, left: 48 }}
        />
      </View>

      {/* The one-line answer to "am I there?", floating over the map. */}
      <View style={styles.chipRow} pointerEvents="box-none">
        <StatusChip
          problem={live.problem}
          hasFix={Boolean(fix)}
          onDuty={onDuty}
          inside={inside}
          remainingM={remaining}
          accuracyM={fix?.accuracyM ?? null}
          onPress={live.problem === "denied" ? openSettings : live.retry}
        />
      </View>


      {/* ──────────────────────────────────────────────────────── the sheet */}
      <MapSheet
        initial="half"
        onSnap={(_, px) => setSheetH(px)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={color.primary} />}
        floating={
          <View style={styles.floatRow} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show me and my site"
              onPress={() => setFrameKey((k) => k + 1)}
              style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
            >
              <LocateFixed size={22} color={color.primary} strokeWidth={2.2} />
            </Pressable>
          </View>
        }
        header={
          <View style={styles.gap1}>
            <Text variant="label" weight="semibold" tone={onDuty || inside ? "primary" : "muted"}>
              {eyebrow}
            </Text>
            <Text variant="title" weight="semibold" numberOfLines={2}>
              {target?.name ?? "No site to show yet"}
            </Text>
            {target && (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {[target.client_name, target.district].filter(Boolean).join(" · ") || target.address || "-"}
              </Text>
            )}
            {!onDuty && post && target && post.siteId !== target.id && (
              <Text variant="caption" weight="semibold" tone="danger">
                Not your post. A supervisor approves this check-in.
              </Text>
            )}
            {onDuty ? (
              <View style={[styles.gap2, styles.headActions]}>
                <View style={styles.row2}>
                  <View style={styles.flex}>
                    <SolidButton label="Check out" icon={Clock3} tone="ink" loading={busy === "out"} onPress={() => setHandoverOpen(true)} />
                  </View>
                  <View style={styles.flex}>
                    <SolidButton label="Call desk" icon={Phone} tone="green" onPress={callDesk} />
                  </View>
                </View>
              </View>
            ) : (
              target && (
                <View style={styles.headActions}>
                  <Button
                    label={busy === target.id ? "Checking your location…" : "Check in"}
                    icon={LogIn}
                    size="lg"
                    fullWidth
                    variant={inside ? "default" : "secondary"}
                    loading={busy === target.id}
                    onPress={() => void doCheckIn(target)}
                  />
                </View>
              )
            )}
          </View>
        }
      >
        {/* How far, how long. */}
        {!onDuty && target && (
          <View style={[styles.trip, inside && styles.tripHere]}>
            <Figure
              value={remaining === null ? "-" : inside ? "Inside" : formatDistance(remaining)}
              label={inside ? "the boundary" : "to the boundary"}
              strong={inside}
            />
            <View style={styles.tripRule} />
            <Figure value={time ? (inside ? "Now" : time.value) : "-"} label={inside ? "ready to check in" : time?.unit ?? "min"} />
            <View style={styles.tripRule} />
            <Figure
              value={fix ? `±${Math.round(fix.accuracyM)} m` : "-"}
              label={fix && fix.accuracyM > target.max_accuracy_m ? "GPS weak" : "GPS"}
            />
          </View>
        )}

        {message && (
          <Panel tone={message.tone === "ok" ? "emerald" : "rose"}>
            <Text variant="body">{message.text}</Text>
          </Panel>
        )}

        {/* ────────────────────────────────────────────── off duty: go, check in */}
        {!onDuty && target && (
          <View style={styles.gap2}>
            <View style={styles.row2}>
              <View style={styles.flex}>
                <Button label="Directions" icon={Navigation} variant="outline" fullWidth onPress={() => directions(target)} />
              </View>
              <View style={styles.flex}>
                <Button label="Call desk" icon={Phone} variant="outline" fullWidth onPress={callDesk} />
              </View>
            </View>
            {targetKind === "picked" && (
              <Button label="Back to my post" variant="link" onPress={() => setPicked(null)} />
            )}
          </View>
        )}

        {/* ─────────────────────────────── on duty: the shift, help, check out */}
        {onDuty && (
          <View style={[styles.trip, inside ? styles.tripHere : styles.tripAway]}>
            <Figure
              value={`${Math.floor(elapsed / 60)}h ${String(elapsed % 60).padStart(2, "0")}m`}
              label={punch?.status === "late" ? "on shift · late" : "on shift"}
              strong
            />
            <View style={styles.tripRule} />
            <Figure
              value={!fix ? "-" : inside ? "Inside" : formatDistance(remaining ?? 0)}
              label={!fix ? "finding you" : inside ? "the boundary" : "outside, go back"}
            />
            <View style={styles.tripRule} />
            {IS_WEB ? (
              <Figure value={fix ? `±${Math.round(fix.accuracyM)} m` : "-"} label="GPS" />
            ) : (
              <Figure value={tracking ? "Sharing" : "Off"} label="location" />
            )}
          </View>
        )}

        {/* Who else is on this site right now: name, how recently heard, how far, Call. */}
        {target && onSite.length > 0 && (
          <Panel tone="emerald" title="On site with you" subtitle={`${onSite.length} more at ${target.name}`} icon={Users} bare>
            {onSite.map((f, i) => {
              const away = fix && f.lat != null && f.lng != null ? formatDistance(distanceMetres(fix, { lat: f.lat, lng: f.lng })) : null;
              const mins = f.heard_at ? Math.max(0, Math.round((now - new Date(f.heard_at).getTime()) / 60_000)) : null;
              return (
                <PanelRow key={f.id} first={i === 0}>
                  <Avatar name={f.name} size={36} />
                  <View style={styles.flex}>
                    <Text variant="label" weight="semibold" numberOfLines={1}>
                      {f.name}
                    </Text>
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {[f.lat == null || mins == null ? "No signal" : mins < 1 ? "Here now" : `Seen ${mins} min ago`, away && `${away} away`, f.inside === false && "outside the boundary"].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  {f.phone ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${f.name}`}
                      onPress={() => void Linking.openURL(`tel:${tel(f.phone!)}`)}
                      style={({ pressed }) => [styles.callChip, pressed && styles.pressed]}
                    >
                      <Phone size={18} color={color.primaryInk} strokeWidth={2.2} />
                    </Pressable>
                  ) : null}
                </PanelRow>
              );
            })}
          </Panel>
        )}

        {onDuty && !IS_WEB && <LastSynced />}

        <PhoneSetup onDuty={onDuty} />

        {(data?.notes ?? []).length > 0 && (
          <Panel tone="amber" title="From the last shift" icon={NotebookPen}>
            {(data?.notes ?? []).map((n) => (
              <Text key={n.id} variant="body">
                {n.body}
                <Text variant="caption" tone="muted">{`  · ${istTime(new Date(n.created_at))}`}</Text>
              </Text>
            ))}
          </Panel>
        )}

        {IS_EXPO_GO && (
          <Panel
            tone="amber"
            title="Test build"
            icon={TriangleAlert}
            action={
              <InfoButton title="What does not work in a test build">
                {[
                  runtimeLimitation() ?? "",
                  CAN_RECEIVE_PUSH
                    ? "Everything else works normally: checking in and out, raising an SOS, and the live feed while the app is open."
                    : "You can still raise an SOS from this phone and everyone else will get it. This phone is the one that will not receive one.",
                  "A development build fixes all of it. Nothing here is a fault with the app itself.",
                ]}
              </InfoButton>
            }
          >
            <Text variant="body" tone="muted">
              Only shows in Expo Go. Background location is off here; the installed app has it.
            </Text>
          </Panel>
        )}

        {onDuty && permission && !permission.ok && (
          <Panel
            tone="rose"
            title="Location is not being shared"
            icon={TriangleAlert}
            action={
              <InfoButton title="Why this matters">
                {[
                  permission.need === "services"
                    ? "Location is switched off on this phone entirely, so nothing can read your position: not this app and not the control room."
                    : permission.need === "foreground"
                      ? "This app has not been allowed to read your location at all, so your check-in cannot be verified against the site boundary."
                      : "This app can only read your location while the screen is on. The moment the phone locks, the control room stops seeing you, which on their map looks the same as a guard who has gone home.",
                  permission.need === "background"
                    ? "Open Permissions → Location and choose “Allow all the time”. Android does not let an app ask for this in a dialog, so it has to be done in Settings."
                    : "It takes a moment to grant, and it stops again the second you check out. You are never tracked off duty.",
                ]}
              </InfoButton>
            }
          >
            <Text variant="body" tone="muted">
              {permission.need === "services"
                ? "Turn location on to be seen by the control room."
                : permission.need === "background"
                  ? "Allowed only while the screen is on."
                  : "Not allowed to read your location."}
            </Text>
            <Button
              label={permission.need === "services" ? "Open settings" : "Allow location"}
              variant="default"
              fullWidth
              onPress={() => {
                if (permission.need !== "services" && permission.canAsk) {
                  void requestTracking().then(setAskedPermission);
                } else openSettings();
              }}
            />
          </Panel>
        )}

        {/* ────────────────────────── somewhere else tonight: every other site */}
        {!onDuty && others.length > 0 && (
          <View style={styles.gap2}>
            <Text variant="eyebrow" weight="bold" tone="muted" uppercase>
              Checking in somewhere else?
            </Text>
            <View style={styles.list}>
              {others.map(({ site, inside: in_, remainingM }, i) => (
                <Pressable
                  key={site.id}
                  accessibilityRole="button"
                  onPress={() => setPicked(site.id)}
                  style={({ pressed }) => [styles.listRow, i > 0 && styles.listRule, pressed && styles.pressed]}
                >
                  <View style={[styles.listIcon, in_ && styles.listIconHere]}>
                    <MapPin size={16} color={in_ ? color.primary : color.mutedForeground} strokeWidth={2} />
                  </View>
                  <View style={styles.flex}>
                    <Text variant="label" weight="semibold" numberOfLines={1}>
                      {site.name}
                    </Text>
                    <Text variant="caption" tone={in_ ? "primary" : "muted"} numberOfLines={1}>
                      {in_ ? "You are inside this one" : `${formatDistance(remainingM)} away`}
                      {post?.siteId === site.id ? " · your post" : ""}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {!onDuty && !fix && live.problem === null && (
          <Text variant="caption" tone="muted" style={styles.centerText}>
            Finding your position… Step outside if it takes long.
          </Text>
        )}
        {/* Room at the end so the last row clears the SOS button and the live SOS card. */}
        <View style={styles.sheetEnd} />
      </MapSheet>

      {/* ─────────────────────── SOS could not be sent: call and SMS instead */}
      <Modal visible={!!sosFailed} transparent animationType="fade" onRequestClose={() => setSosFailed(null)}>
        <Pressable style={styles.noteScrim} onPress={() => setSosFailed(null)}>
          <Pressable style={styles.dialog} onPress={() => undefined}>
            <Text variant="title" weight="semibold" tone="danger">
              SOS not sent: no internet
            </Text>
            <Text variant="body" tone="muted">
              Call the office now, or send an SMS with your location. Both work without mobile data. Keep trying SOS too.
            </Text>
            <Button label={`Call office · ${COMPANY.phone}`} icon={Phone} size="lg" fullWidth onPress={callDesk} />
            <Button
              label="Send SMS with my location"
              variant="outline"
              fullWidth
              onPress={() => {
                const where = sosFailed?.fix ? ` Location: https://maps.google.com/?q=${sosFailed.fix.lat.toFixed(5)},${sosFailed.fix.lng.toFixed(5)}` : "";
                const body = encodeURIComponent(`SOS from ${target?.name ? `${target.name}. ` : ""}Need help now.${where}`);
                void Linking.openURL(`sms:${tel(COMPANY.phone)}?body=${body}`);
              }}
            />
            <Button label="Try SOS again" variant="outline" fullWidth onPress={() => { setSosFailed(null); void doRaiseSos(); }} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─────────────────────── check-out: anything for the next guard? */}
      <Modal visible={handoverOpen} transparent animationType="fade" onRequestClose={() => setHandoverOpen(false)}>
        <Pressable style={styles.noteScrim} onPress={() => setHandoverOpen(false)}>
          <Pressable style={styles.dialog} onPress={() => undefined}>
            <Text variant="title" weight="semibold">
              Check out
            </Text>
            <Text variant="body" tone="muted">
              Anything the next guard should know? It shows on their phone when they check in. You can leave it empty.
            </Text>
            <TextInput
              value={handover}
              onChangeText={setHandover}
              placeholder="e.g. Gate 2 lock is broken, use the chain"
              placeholderTextColor={color.mutedForeground}
              multiline
              maxLength={2000}
              style={styles.noteInput}
            />
            <View style={styles.row2}>
              <View style={styles.flex}>
                <Button label="Cancel" variant="outline" fullWidth onPress={() => setHandoverOpen(false)} />
              </View>
              <View style={styles.flex}>
                <Button label="Check out" icon={Clock3} fullWidth onPress={() => void doPunchOut()} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─────────────────────── "not here yet": what to do instead of a refusal */}
      <ArrivalSheet
        arrival={arrival}
        visible={showArrival}
        post={post?.siteId ? byId(post.siteId) : undefined}
        busy={busy}
        onClose={() => setShowArrival(false)}
        onRetry={(site) => void doCheckIn(site)}
        onDirections={directions}
        onCheckInHere={(site, known) => void doCheckIn(site, known)}
        onCallDesk={callDesk}
        onSettings={openSettings}
      />
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────── pieces */

/**
 * When the office last heard from this phone, so nobody has to guess whether tracking is
 * working: green within 3 minutes, amber within 10, red after that, and how many points
 * are waiting to be sent when the phone has no signal.
 */
function LastSynced() {
  const now = useNow(15_000);
  const [s, setS] = useState<{ lastSyncAt: number | null; queued: number } | null>(null);
  useEffect(() => {
    let live = true;
    void syncStatus().then((x) => live && setS(x));
    return () => {
      live = false;
    };
  }, [now]);
  if (!s) return null;
  const mins = s.lastSyncAt ? Math.max(0, Math.round((now - s.lastSyncAt) / 60_000)) : null;
  const tone = mins == null ? color.destructive : mins <= 3 ? color.live : mins <= 10 ? color.stale : color.destructive;
  return (
    <View style={styles.synced}>
      <View style={[styles.syncDot, { backgroundColor: tone }]} />
      <Text variant="label" weight="semibold" style={styles.flex}>
        {s.lastSyncAt ? `Last synced ${istTime(new Date(s.lastSyncAt))} · ${mins! < 1 ? "just now" : `${mins} min ago`}` : "Not synced yet"}
      </Text>
      {s.queued > 0 && (
        <Text variant="caption" weight="semibold" tone="danger">
          {s.queued} waiting
        </Text>
      )}
    </View>
  );
}

function Figure({ value, label, strong }: { value: string; label: string; strong?: boolean }) {
  return (
    <View style={styles.figure}>
      <Text variant="bodyLarge" weight="semibold" tone={strong ? "primary" : "default"} numberOfLines={1}>
        {value}
      </Text>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function StatusChip({
  problem,
  hasFix,
  onDuty,
  inside,
  remainingM,
  accuracyM,
  onPress,
}: {
  problem: "denied" | "off" | null;
  hasFix: boolean;
  onDuty: boolean;
  inside: boolean;
  remainingM: number | null;
  accuracyM: number | null;
  onPress: () => void;
}) {
  let tone: "good" | "warn" | "bad" | "idle" = "idle";
  let text = "Finding you…";
  if (problem === "denied") {
    tone = "bad";
    text = "Location not allowed. Tap to fix";
  } else if (problem === "off") {
    tone = "bad";
    text = "GPS is off. Tap to retry";
  } else if (hasFix && remainingM !== null) {
    if (inside) {
      tone = "good";
      text = onDuty ? "Inside your site" : "You are at your post";
    } else {
      tone = onDuty ? "bad" : "warn";
      text = onDuty ? `Outside the boundary · ${formatDistance(remainingM)}` : `${formatDistance(remainingM)} to your post`;
    }
  }
  // Small, in the top-right corner, like a phone's own status icons: a coloured
  // dot and the GPS accuracy. The full sentence ("Inside the boundary", "120 m to
  // your post") is already in the sheet; here it is only read out to screen readers.
  // A problem the guard can fix keeps a short word, because a dot alone would not say what to do.
  const dot = { good: color.primary, warn: "#d97706", bad: color.destructive, idle: color.mutedForeground }[tone];
  const short = problem === "denied" ? "Allow location" : problem === "off" ? "GPS off" : !hasFix ? "GPS…" : accuracyM !== null ? `±${Math.round(accuracyM)} m` : "GPS";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${text}${hasFix && accuracyM !== null ? `, accurate to ${Math.round(accuracyM)} metres` : ""}`}
      onPress={problem ? onPress : undefined}
      hitSlop={8}
      style={styles.chip}
    >
      <View style={[styles.chipDot, { backgroundColor: dot }]} />
      <Text variant="caption" weight="semibold" mono numberOfLines={1} style={{ color: problem ? color.destructive : color.foreground }}>
        {short}
      </Text>
    </Pressable>
  );
}

type Pending = Exclude<Arrival, { kind: "ready" }>;

/**
 * What a guard sees instead of "check-in refused": where they actually are, and
 * the one button that fixes it.
 */
function ArrivalSheet({
  arrival: a,
  visible,
  post,
  busy,
  onClose,
  onRetry,
  onDirections,
  onCheckInHere,
  onCallDesk,
  onSettings,
}: {
  arrival: Pending | null;
  visible: boolean;
  post: Site | undefined;
  busy: string | null;
  onClose: () => void;
  onRetry: (site: Site) => void;
  onDirections: (site: Site) => void;
  onCheckInHere: (site: Site, fix: Extract<Pending, { kind: "elsewhere" }>["fix"]) => void;
  onCallDesk: () => void;
  onSettings: () => void;
}) {
  const insets = useSafeAreaInsets();
  let Icon = MapPinOff;
  let tint: string = "#b45309";
  let title = "";
  let body = "";
  let actions: React.ReactNode = null;

  if (a?.kind === "away") {
    title = "You are not at your post yet";
    body = `${formatDistance(a.remainingM)} from the boundary of ${a.site.name}. Walk there. The button turns green once you are inside.`;
    actions = (
      <>
        <Button label="Get directions" icon={Navigation} size="lg" fullWidth onPress={() => onDirections(a.site)} />
        <Button label="Check again" variant="outline" fullWidth loading={busy === a.site.id} onPress={() => onRetry(a.site)} />
        <View style={styles.center}>
          <Button label="At the gate but it says no? Call the desk" variant="link" onPress={onCallDesk} />
        </View>
      </>
    );
  } else if (a?.kind === "elsewhere") {
    title = `You are at ${a.here.name}`;
    body =
      a.site.id === post?.id
        ? `Your post is ${a.site.name}. Go there, or check in here and a supervisor approves it.`
        : `You picked ${a.site.name}. Check in where you are instead, or go there.`;
    actions = (
      <>
        <Button
          label="Check in here"
          icon={LogIn}
          size="lg"
          fullWidth
          loading={busy === a.here.id}
          onPress={() => onCheckInHere(a.here, a.fix)}
        />
        <Button
          label={a.site.id === post?.id ? "Directions to my post" : "Directions"}
          icon={Navigation}
          variant="outline"
          fullWidth
          onPress={() => onDirections(a.site)}
        />
      </>
    );
  } else if (a?.kind === "weak") {
    Icon = SignalLow;
    title = "GPS signal is weak";
    body = `Your position is only accurate to ±${Math.round(a.accuracyM)} m, and ${a.site.name} needs ±${a.site.max_accuracy_m} m. Step into the open and wait a few seconds.`;
    actions = (
      <Button label="Check again" size="lg" fullWidth loading={busy === a.site.id} onPress={() => onRetry(a.site)} />
    );
  } else if (a?.kind === "nofix") {
    tint = color.destructive;
    title = "Cannot find your location";
    body = "Switch GPS on and allow NBSS to use your location, then try again.";
    actions = <Button label="Open settings" size="lg" fullWidth onPress={onSettings} />;
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.modal, { paddingBottom: space[6] + insets.bottom }]}>
        <View style={styles.handle} />
        <View style={[styles.modalIcon, { backgroundColor: `${tint}1a` }]}>
          <Icon size={26} color={tint} strokeWidth={2} />
        </View>
        <Text variant="title" weight="semibold" style={styles.centerText}>
          {title}
        </Text>
        <Text variant="body" tone="muted" style={styles.centerText}>
          {body}
        </Text>
        <View style={styles.gap2}>{actions}</View>
        <Button label="Close" variant="ghost" fullWidth onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sosOff: { marginTop: space[3] },
  noteScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: space[5] },
  dialog: { backgroundColor: color.card, borderRadius: radius["2xl"], padding: space[5], gap: space[3] },
  noteInput: {
    minHeight: 96,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: space[3],
    textAlignVertical: "top",
    color: color.foreground,
    fontSize: 16,
  },
  root: { flex: 1, backgroundColor: color.appBg },
  center: { alignItems: "center", justifyContent: "center" },
  centerText: { textAlign: "center" },
  flex: { flex: 1, minWidth: 0 },
  gap1: { gap: 2 },
  gap2: { gap: space[2] },
  row2: { flexDirection: "row", gap: space[2] },
  headActions: { marginTop: space[3] },
  pressed: { opacity: 0.7 },
  sheetEnd: { height: 96 },
  synced: { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[3], paddingVertical: space[2.5], borderRadius: radius.xl, backgroundColor: color.card, borderWidth: StyleSheet.hairlineWidth, borderColor: color.lineSoft },
  syncDot: { width: 10, height: 10, borderRadius: 5 },
  callChip: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: color.accent },

  chipRow: { position: "absolute", top: space[3], right: space[3], alignItems: "flex-end" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 30,
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    backgroundColor: color.card,
    ...shadow.card,
  },
  chipDot: { width: 9, height: 9, borderRadius: 5 },
  credit: { position: "absolute", left: space[2], backgroundColor: "#ffffffb3", paddingHorizontal: 4, borderRadius: 3 },

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

  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    alignSelf: "center",
    maxHeight: "54%",
    backgroundColor: color.card,
    borderTopLeftRadius: radius["3xl"],
    borderTopRightRadius: radius["3xl"],
    ...shadow.raised,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: color.border,
    marginTop: space[2],
    marginBottom: space[1],
  },
  sheetBody: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[6], gap: space[4] },

  trip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.xl,
    backgroundColor: color.muted,
    paddingVertical: space[3],
    paddingHorizontal: space[2],
  },
  tripHere: { backgroundColor: color.accent },
  tripAway: { backgroundColor: "#fdecea" },
  tripRule: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: color.border },
  figure: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: space[1] },

  list: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: color.border },
  listRow: { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[3], paddingVertical: space[3] },
  listRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  listIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: color.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  listIconHere: { backgroundColor: color.accent },

  scrim: { flex: 1, backgroundColor: color.scrim },
  modal: {
    backgroundColor: color.card,
    borderTopLeftRadius: radius["3xl"],
    borderTopRightRadius: radius["3xl"],
    paddingHorizontal: space[5],
    gap: space[3],
    alignItems: "stretch",
  },
  modalIcon: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space[2],
  },
});
