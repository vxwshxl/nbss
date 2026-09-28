import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  Check,
  Clock3,
  LocateFixed,
  LogIn,
  MapPin,
  MapPinOff,
  Navigation,
  Phone,
  SatelliteDish,
  ShieldAlert,
  SignalLow,
  TriangleAlert,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COMPANY, istTime, tel } from "@nbss/shared/company";
import { checkFence, formatDistance } from "@nbss/shared/geo";

import { Button } from "@/components/button";
import { HoldButton } from "@/components/hold-button";
import { InfoButton } from "@/components/info";
import { ATTRIBUTION, LiveMap, type MapSite } from "@/components/live-map";
import { Panel } from "@/components/panel";
import { Text } from "@/components/text";
import { useLayout } from "@/hooks/use-breakpoint";
import { useLivePosition } from "@/hooks/use-live-position";
import { useLoader } from "@/hooks/use-loader";
import { useNow } from "@/hooks/use-now";
import {
  allSites,
  checkArrival,
  directionsUrl,
  eta,
  myPost,
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
  const { contentMaxWidth } = useLayout();
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
    const [punch, permission, tracking, post, rostered, all] = await Promise.all([
      openPunch(),
      checkTracking(),
      isTracking(),
      myPost(),
      rosteredSites(),
      allSites(),
    ]);
    // Your post first, then everywhere else — the roster is the default, not a wall.
    const seen = new Set(rostered.map((s) => s.id));
    const sites = [...rostered, ...all.filter((s) => !seen.has(s.id))];
    return { punch, permission, tracking, post, sites };
  }, []);

  const { data, refreshing, reload } = useLoader(load);

  const punch = data?.punch ?? null;
  const post = data?.post ?? null;
  const sites = data?.sites ?? [];
  const tracking = data?.tracking ?? false;
  const permission = askedPermission ?? data?.permission ?? null;
  const fix = live.fix;
  const onDuty = Boolean(punch);

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
                ? `${result.message} Your location is NOT being shared — tell your supervisor.`
                : result.message,
          }
        : { tone: "bad", text: result.error },
    );
    if (result.ok) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    await reload();
  };

  const doPunchOut = async () => {
    setBusy("out");
    setMessage(null);
    const result = await punchOut();
    setBusy(null);
    setMessage(result.ok ? { tone: "ok", text: result.message } : { tone: "bad", text: result.error });
    await reload();
  };

  const doRaiseSos = async () => {
    const result = await raiseSos();
    if (!result.ok) {
      setMessage({ tone: "bad", text: result.error });
      return;
    }
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
    duty: `On duty · since ${since ? istTime(since) : "—"} IST`,
    picked: "Checking in at",
    post: post ? `Your post · ${istTime(post.startsAt)} – ${istTime(post.endsAt)}` : "Your post",
    here: "You are at",
    nearest: "Nearest site",
  }[targetKind];

  return (
    <View style={styles.root}>
      {/* ───────────────────────────────────────────────────────── the map */}
      <View style={StyleSheet.absoluteFill}>
        <LiveMap
          me={fix}
          site={mapSite}
          inside={inside}
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

      <Text variant="micro" tone="muted" style={[styles.credit, { bottom: sheetH + space[1] }]}>
        {ATTRIBUTION}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Show me and my site"
        onPress={() => setFrameKey((k) => k + 1)}
        style={({ pressed }) => [styles.fab, { bottom: sheetH + space[3] }, pressed && styles.pressed]}
      >
        <LocateFixed size={22} color={color.foreground} strokeWidth={2} />
      </Pressable>

      {/* ──────────────────────────────────────────────────────── the sheet */}
      <View
        style={[styles.sheet, { maxWidth: contentMaxWidth }]}
        onLayout={(e: LayoutChangeEvent) => setSheetH(Math.round(e.nativeEvent.layout.height))}
      >
        <View style={styles.handle} />
        <ScrollView
          contentContainerStyle={styles.sheetBody}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={color.primary} />
          }
        >
          {/* Where. */}
          <View style={styles.gap1}>
            <Text variant="eyebrow" weight="bold" tone={onDuty || inside ? "primary" : "muted"} uppercase>
              {eyebrow}
            </Text>
            <Text variant="title" weight="semibold" numberOfLines={2}>
              {target?.name ?? "No site to show yet"}
            </Text>
            {target && (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {[target.client_name, target.district].filter(Boolean).join(" · ") || target.address || "—"}
              </Text>
            )}
            {!onDuty && post && target && post.siteId !== target.id && (
              <Text variant="caption" weight="semibold" tone="danger">
                Not your post — a supervisor approves this check-in.
              </Text>
            )}
          </View>

          {/* How far, how long. */}
          {!onDuty && target && (
            <View style={[styles.trip, inside && styles.tripHere]}>
              <Figure
                value={remaining === null ? "—" : inside ? "Inside" : formatDistance(remaining)}
                label={inside ? "the boundary" : "to the boundary"}
                strong={inside}
              />
              <View style={styles.tripRule} />
              <Figure value={time ? (inside ? "Now" : time.value) : "—"} label={inside ? "ready to check in" : time?.unit ?? "min"} />
              <View style={styles.tripRule} />
              <Figure
                value={fix ? `±${Math.round(fix.accuracyM)} m` : "—"}
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
              <Button
                label={busy === target.id ? "Checking your location…" : "Check in"}
                icon={LogIn}
                size="lg"
                fullWidth
                variant={inside ? "default" : "secondary"}
                loading={busy === target.id}
                onPress={() => void doCheckIn(target)}
              />
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
                value={!fix ? "—" : inside ? "Inside" : formatDistance(remaining ?? 0)}
                label={!fix ? "finding you" : inside ? "the boundary" : "outside — go back"}
              />
              <View style={styles.tripRule} />
              {IS_WEB ? (
                <Figure value={fix ? `±${Math.round(fix.accuracyM)} m` : "—"} label="GPS" />
              ) : (
                <Figure value={tracking ? "Sharing" : "Off"} label="location" />
              )}
            </View>
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
                Background location, the map and some alerts are off in this build.
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
                      ? "Location is switched off on this phone entirely, so nothing can read your position — not this app and not the control room."
                      : permission.need === "foreground"
                        ? "This app has not been allowed to read your location at all, so your check-in cannot be verified against the site boundary."
                        : "This app can only read your location while the screen is on. The moment the phone locks, the control room stops seeing you — which on their map looks the same as a guard who has gone home.",
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

          {onDuty && (
            <Panel
              tone="rose"
              title="Emergency"
              icon={ShieldAlert}
              action={
                <InfoButton title="What happens when you press it">
                  {[
                    "Every guard checked in at this site is alerted, along with every admin and supervisor, and the client who owns the premises.",
                    "They see where you are and can say they are on the way, so you know help is coming.",
                    "Hold it for three seconds. That is deliberate — a tap could happen in your pocket, and three seconds is short enough to manage when you are frightened.",
                    "Standing one down afterwards is normal and nobody minds. False alarms are expected; a panic button people are afraid to press is worse than useless.",
                  ]}
                </InfoButton>
              }
            >
              <HoldButton label="Hold 3s for help" onComplete={() => void doRaiseSos()} />
            </Panel>
          )}

          {onDuty && (
            <View style={styles.gap2}>
              <Button
                label="Check out"
                icon={Clock3}
                variant="outline"
                size="lg"
                fullWidth
                loading={busy === "out"}
                onPress={() => void doPunchOut()}
              />
              <Button label={`Desk · ${COMPANY.phone}`} icon={Phone} variant="ghost" fullWidth onPress={callDesk} />
            </View>
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
        </ScrollView>
      </View>

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
    text = "Location not allowed — tap to fix";
  } else if (problem === "off") {
    tone = "bad";
    text = "GPS is off — tap to retry";
  } else if (hasFix && remainingM !== null) {
    if (inside) {
      tone = "good";
      text = onDuty ? "Inside your site" : "You are at your post";
    } else {
      tone = onDuty ? "bad" : "warn";
      text = onDuty ? `Outside the boundary · ${formatDistance(remainingM)}` : `${formatDistance(remainingM)} to your post`;
    }
  }
  const Icon = tone === "good" ? Check : tone === "idle" ? SatelliteDish : tone === "bad" ? MapPinOff : Navigation;
  const bg = { good: color.primary, warn: "#b45309", bad: color.destructive, idle: color.card }[tone];
  const ink = tone === "idle" ? color.foreground : "#ffffff";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={problem ? onPress : undefined}
      style={[styles.chip, { backgroundColor: bg }]}
    >
      <Icon size={16} color={ink} strokeWidth={2.4} />
      <Text variant="label" weight="semibold" style={{ color: ink }} numberOfLines={1}>
        {text}
      </Text>
      {hasFix && accuracyM !== null && !problem && (
        <Text variant="caption" style={[styles.chipAcc, { color: ink }]}>
          ±{Math.round(accuracyM)} m
        </Text>
      )}
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
    body = `${formatDistance(a.remainingM)} from the boundary of ${a.site.name}. Walk there — the button turns green once you are inside.`;
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
  root: { flex: 1, backgroundColor: color.appBg },
  center: { alignItems: "center", justifyContent: "center" },
  centerText: { textAlign: "center" },
  flex: { flex: 1, minWidth: 0 },
  gap1: { gap: 2 },
  gap2: { gap: space[2] },
  row2: { flexDirection: "row", gap: space[2] },
  pressed: { opacity: 0.7 },

  chipRow: { position: "absolute", top: space[3], left: space[4], right: space[4], alignItems: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    maxWidth: "100%",
    paddingHorizontal: space[4],
    paddingVertical: space[2.5],
    borderRadius: radius.full,
    ...shadow.raised,
  },
  chipAcc: { opacity: 0.8 },
  credit: { position: "absolute", left: space[2], backgroundColor: "#ffffffb3", paddingHorizontal: 4, borderRadius: 3 },

  fab: {
    position: "absolute",
    right: space[4],
    width: 48,
    height: 48,
    borderRadius: 24,
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
