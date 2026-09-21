import { router } from "expo-router";
import {
  Clock3,
  MapPin,
  Phone,
  Radio,
  ShieldAlert,
  ShieldCheck,
  SatelliteDish,
  TriangleAlert,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Linking, RefreshControl, StyleSheet, View } from "react-native";

import { COMPANY, istTime, tel } from "@nbss/shared/company";
import { formatDistance } from "@nbss/shared/geo";

import { Button, LinkButton } from "@/components/button";
import { HoldButton } from "@/components/hold-button";
import { InfoButton } from "@/components/info";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelRow } from "@/components/panel";
import { CardGrid, Screen } from "@/components/screen";
import { StatCard } from "@/components/stat-card";
import { Text } from "@/components/text";
import { useLayout } from "@/hooks/use-breakpoint";
import { useLoader } from "@/hooks/use-loader";
import { useNow } from "@/hooks/use-now";
import { useAuth } from "@/lib/auth";
import {
  allSites,
  nearbySites,
  openPunch,
  punchIn,
  punchOut,
  raiseSos,
  rosteredSites,
  type SiteProximity,
} from "@/lib/duty";
import {
  checkTracking,
  isTracking,
  openSettings,
  requestTracking,
  type PermissionState,
} from "@/lib/location";
import { CAN_RECEIVE_PUSH, IS_EXPO_GO, runtimeLimitation } from "@/lib/runtime";
import { color, space } from "@/theme/tokens";

/**
 * The screen a guard actually uses, laid out like the console's dashboards.
 *
 * It answers three questions in the order they get asked at a gate: am I on duty, can I
 * go on duty, and how do I get help. Everything else is a tab away, because at 6am in the
 * rain this screen has one job.
 *
 * The permission Panel is not boilerplate. On Android 11 and later "Allow all the time"
 * cannot be requested from a dialog at all — the OS offers only "While using the app",
 * and background access has to be switched on by hand in Settings. A guard who grants the
 * first prompt and stops has an app that tracks them while the screen is on and then goes
 * silent, which on a supervisor's map is indistinguishable from a guard who went home.
 */
export function Duty() {
  const { profile, signOut } = useAuth();
  const { statColumns } = useLayout();

  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  /**
   * Overrides the loaded permission state after a prompt, so the warning Panel disappears
   * the instant the guard grants access rather than on the next reload.
   */
  const [askedPermission, setAskedPermission] = useState<PermissionState | null>(null);

  const load = useCallback(async () => {
    const [punch, permission, tracking] = await Promise.all([
      openPunch(),
      checkTracking(),
      isTracking(),
    ]);

    // The site list is only needed when they are not already on duty, and reading a GPS
    // fix costs battery — so it is skipped entirely for a guard mid-shift.
    let proximity: SiteProximity[] = [];
    let fixAccuracy: number | null = null;

    if (!punch) {
      const rostered = await rosteredSites();
      const sites = rostered.length > 0 ? rostered : await allSites();
      const near = await nearbySites(sites);
      proximity = near.proximity;
      fixAccuracy = near.fix?.accuracyM ?? null;
    }

    return { punch, permission, tracking, proximity, fixAccuracy };
  }, []);

  const { data, refreshing, reload } = useLoader(load);

  // Ticks, so "on shift for 7h 42m" counts up on its own instead of freezing at whatever
  // it was when the screen mounted.
  const now = useNow(30_000);

  const punch = data?.punch;
  const proximity = data?.proximity ?? [];
  const fixAccuracy = data?.fixAccuracy ?? null;
  const tracking = data?.tracking ?? false;
  const permission = askedPermission ?? data?.permission ?? null;

  const doPunchIn = async (siteId: string) => {
    setBusy(siteId);
    setMessage(null);

    // Asked here rather than on mount. A prompt that appears before anyone has pressed
    // anything gets dismissed; one that appears when a guard is trying to start their
    // shift has an obvious reason.
    setAskedPermission(await requestTracking());

    const result = await punchIn(siteId);
    setBusy(null);

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

  if (data === undefined) {
    return (
      <Screen scroll={false} topInset={false} bottomInset={false} contentStyle={styles.center}>
        <ActivityIndicator color={color.primary} />
      </Screen>
    );
  }

  const onDuty = Boolean(punch);
  const since = punch?.check_in_at ? new Date(punch.check_in_at) : null;
  const elapsed = since ? Math.floor((now - since.getTime()) / 60000) : 0;

  return (
    <Screen
      topInset={false}
      bottomInset={false}
      contentStyle={styles.body}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={color.primary} />
      }
    >
      <PageHeader
        eyebrow={onDuty ? "On duty" : "Off duty"}
        title={profile?.full_name ?? "—"}
        action={<LinkButton label="Sign out" tone="muted" onPress={() => void signOut()} />}
      />

      {/* ───────────────────────────────────────── the figures, as on the console */}
      <CardGrid columns={statColumns}>
        <StatCard
          label="Status"
          value={onDuty ? "On duty" : "Off"}
          hint={onDuty ? (punch?.site_name ?? "Your site") : "Not checked in"}
          icon={onDuty ? ShieldCheck : ShieldAlert}
          tone={onDuty ? "emerald" : "slate"}
        />
        <StatCard
          label="On shift for"
          value={onDuty ? `${Math.floor(elapsed / 60)}h ${String(elapsed % 60).padStart(2, "0")}m` : "—"}
          hint={
            since
              ? `Since ${istTime(since)} IST`
              : "Check in to start"
          }
          icon={Clock3}
          tone="indigo"
        />
        <StatCard
          label="Location"
          value={onDuty ? (tracking ? "Sharing" : "Off") : "Idle"}
          hint={onDuty ? (tracking ? "The control room can see you" : "Not being shared") : "Only while on duty"}
          icon={SatelliteDish}
          tone={onDuty ? (tracking ? "teal" : "rose") : "slate"}
        />
        <StatCard
          label="Employee code"
          value={profile?.employee_code ?? "—"}
          hint={punch?.status === "late" ? "This shift marked late" : "Signed in"}
          icon={Radio}
          tone="violet"
        />
      </CardGrid>

      {/* ─────────────────── what this container cannot do, whatever the settings say */}
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
            Background location and some alerts are switched off in this build.
          </Text>
        </Panel>
      )}

      {/* ──────────────────────────────────── the result of the last action */}
      {message && (
        <Panel tone={message.tone === "ok" ? "emerald" : "rose"}>
          <Text variant="body">{message.text}</Text>
        </Panel>
      )}

      {/* ─────────────────────────────── the permission that actually matters */}
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
            label={permission.need === "services" ? "Open settings" : "Fix this"}
            variant="destructive"
            onPress={() => {
              // A permission that can still be asked for is asked for; one that cannot —
              // the Android background case — goes to Settings, because a prompt that
              // silently does nothing is worse than no button.
              if (permission.need !== "services" && permission.canAsk) {
                void requestTracking().then(setAskedPermission);
              } else openSettings();
            }}
          />
        </Panel>
      )}

      {/* ────────────────────────────────────────────────── the panic button */}
      {onDuty && (
        <Panel tone="rose" title="Emergency" icon={ShieldAlert}>
          <HoldButton label="Hold 3s for help" onComplete={() => void doRaiseSos()} />
          <Text variant="caption" tone="muted" style={styles.centered}>
            Alerts every guard on this site, the control room, and the client. Standing one
            down afterwards is normal and nobody minds.
          </Text>
        </Panel>
      )}

      {/* ─────────────────────────────────────────────────────── check out */}
      {onDuty && (
        <Panel
          tone="slate"
          title="End your shift"
          icon={Clock3}
          action={
            <InfoButton title="Checking out">
              {[
                "Your location stops being shared the moment you check out, and nothing is recorded until your next shift.",
                "The hours between your check-in and check-out are what payroll and the client's invoice are both computed from, so check out before you leave rather than afterwards.",
              ]}
            </InfoButton>
          }
        >
          <Button
            label="Check out"
            variant="outline"
            size="lg"
            fullWidth
            loading={busy === "out"}
            onPress={() => void doPunchOut()}
          />
        </Panel>
      )}

      {/* ─────────────────────────────────────────── where they can check in */}
      {!onDuty && (
        <Panel
          tone="emerald"
          title="Report for duty"
          icon={MapPin}
          subtitle={
            fixAccuracy === null
              ? "Waiting for a GPS fix…"
              : `Your position is accurate to ±${Math.round(fixAccuracy)} m`
          }
          bare
        >
          {proximity.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No sites to show yet."
              body="Pull down to try again. If GPS is switched off, turn it on first — a check-in is refused without a position."
            />
          ) : (
            proximity.map(({ site, inside, distanceM }, i) => (
              <PanelRow key={site.id} first={i === 0}>
                <View style={styles.siteText}>
                  <Text variant="body" weight="semibold">
                    {site.name}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {[site.client_name, site.district].filter(Boolean).join(" · ") || "—"}
                  </Text>
                  <Text variant="caption" tone={inside ? "primary" : "muted"} mono>
                    {inside
                      ? `Inside the boundary · ${formatDistance(distanceM)} from centre`
                      : `${formatDistance(distanceM)} away · boundary is ${site.geofence_radius_m} m`}
                  </Text>
                </View>
                <Button
                  label={inside ? "Check in" : "Too far"}
                  // Not disabled when outside: the local calculation is a hint, and a guard
                  // standing at a gate whose stored coordinates are slightly wrong must
                  // still be able to try. The server gives the real answer, with the real
                  // distance, which is what a supervisor then investigates.
                  variant={inside ? "default" : "secondary"}
                  size="sm"
                  loading={busy === site.id}
                  onPress={() => void doPunchIn(site.id)}
                />
              </PanelRow>
            ))
          )}
        </Panel>
      )}

      {/* ─────────────────────────────────────────────────── the desk, always */}
      <Panel tone="sky" title="Anything not right?" icon={Phone}>
        <Text variant="body" tone="muted">
          Staffed {COMPANY.deskHours}.
        </Text>
        <Button
          label={COMPANY.phone}
          variant="outline"
          icon={Phone}
          onPress={() => void Linking.openURL(`tel:${tel(COMPANY.phone)}`)}
        />
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // `space-y-6` on the console. 16 was too tight once the Panels gained header strips.
  body: { gap: space[6] },
  center: { alignItems: "center", justifyContent: "center" },
  centered: { textAlign: "center" },
  siteText: { flex: 1, gap: 2 },
});
