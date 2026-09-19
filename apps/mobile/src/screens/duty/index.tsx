import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { formatDistance } from "@nbss/shared/geo";

import { Button, LinkButton } from "@/components/button";
import { Card } from "@/components/card";
import { HoldButton } from "@/components/hold-button";
import { Screen } from "@/components/screen";
import { StatusPill } from "@/components/status-pill";
import { Text } from "@/components/text";
import { useAuth } from "@/lib/auth";
import {
  allSites,
  nearbySites,
  openPunch,
  punchIn,
  punchOut,
  raiseSos,
  rosteredSites,
  type OpenPunch,
  type SiteProximity,
} from "@/lib/duty";
import { checkTracking, isTracking, openSettings, requestTracking, type PermissionState } from "@/lib/location";
import { color, space } from "@/theme/tokens";
import { router } from "expo-router";

/**
 * The screen a guard actually uses.
 *
 * It answers three questions in the order they are asked at a gate: am I on duty, can
 * I go on duty, and how do I get help. Everything else — the roster, the map, the
 * payslip — is a tab away, because at 6am in the rain this screen has one job.
 *
 * The permission banner is not boilerplate. On Android 11 and later, "Allow all the
 * time" cannot be requested from a dialog at all: the OS offers only "While using the
 * app", and background access has to be switched on by hand in Settings. A guard who
 * grants the first prompt and stops has an app that tracks them for as long as the
 * screen is on and then goes silent — which on the supervisor's map is
 * indistinguishable from a guard who went home. So the missing permission is stated
 * plainly, with the button that leads to the only place it can be granted.
 */
export function Duty() {
  const { profile, signOut } = useAuth();

  const [punch, setPunch] = useState<OpenPunch | null | undefined>(undefined);
  const [proximity, setProximity] = useState<SiteProximity[]>([]);
  const [fixAccuracy, setFixAccuracy] = useState<number | null>(null);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [tracking, setTracking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [current, permissionState, trackingNow] = await Promise.all([
      openPunch(),
      checkTracking(),
      isTracking(),
    ]);

    setPunch(current);
    setPermission(permissionState);
    setTracking(trackingNow);

    // The site list is only needed when they are not already on duty, and reading a
    // GPS fix costs battery — so it is skipped entirely for a guard mid-shift.
    if (!current) {
      const rostered = await rosteredSites();
      // A guard sent somewhere at short notice has no roster entry. Falling back to
      // the whole register costs nothing, because the fence still decides.
      const sites = rostered.length > 0 ? rostered : await allSites();
      const near = await nearbySites(sites);
      setProximity(near.proximity);
      setFixAccuracy(near.fix?.accuracyM ?? null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const doPunchIn = async (siteId: string) => {
    setBusy(siteId);
    setMessage(null);

    // Permission is asked for here rather than on mount. A prompt that appears before
    // anyone has pressed anything gets dismissed; one that appears when a guard is
    // trying to start their shift has an obvious reason.
    const granted = await requestTracking();
    setPermission(granted);

    const result = await punchIn(siteId);
    setBusy(null);

    setMessage(result.ok ? { tone: "ok", text: result.message } : { tone: "bad", text: result.error });
    await load();
  };

  const doPunchOut = async () => {
    setBusy("out");
    setMessage(null);
    const result = await punchOut();
    setBusy(null);
    setMessage(result.ok ? { tone: "ok", text: result.message } : { tone: "bad", text: result.error });
    await load();
  };

  const doRaiseSos = async () => {
    const result = await raiseSos();
    if (!result.ok) {
      setMessage({ tone: "bad", text: result.error });
      return;
    }
    // Straight onto the alarm screen, which is where the guard can see who has
    // answered and can stand the alarm down when it is over.
    router.push(`/sos/${result.alertId}`);
  };

  if (punch === undefined) {
    return (
      <Screen scroll={false} style={styles.center}>
        <ActivityIndicator color={color.primary} />
      </Screen>
    );
  }

  const onDuty = Boolean(punch);
  const since = punch?.check_in_at ? new Date(punch.check_in_at) : null;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.body}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={color.primary} />}
    >
      {/* ─────────────────────────────────────────────── who and where */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="title" bold>
            {profile?.full_name ?? "—"}
          </Text>
          <Text variant="caption" tone="muted">
            {profile?.employee_code ?? "—"}
          </Text>
        </View>
        <LinkButton label="Sign out" tone="muted" onPress={() => void signOut()} />
      </View>

      {/* ───────────────────────────────────────────────────── the state */}
      <Card tone={onDuty ? "accent" : "default"}>
        <View style={styles.stateRow}>
          <View style={styles.stateText}>
            <Text variant="caption" tone="muted" medium>
              {onDuty ? "ON DUTY" : "OFF DUTY"}
            </Text>
            <Text variant="bodyLarge" semibold>
              {onDuty ? (punch?.site_name ?? "Your site") : "Not checked in"}
            </Text>
            {since && (
              <Text variant="caption" tone="muted" mono>
                Since{" "}
                {since.toLocaleTimeString("en-IN", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                  timeZone: "Asia/Kolkata",
                })}{" "}
                IST
                {punch?.status === "late" ? " · marked late" : ""}
              </Text>
            )}
          </View>
          <StatusPill
            tone={onDuty ? (tracking ? "live" : "stale") : "neutral"}
            label={onDuty ? (tracking ? "Sharing location" : "Not sharing") : "Idle"}
          />
        </View>

        {onDuty && (
          <Button
            label="Check out"
            variant="secondary"
            size="lg"
            loading={busy === "out"}
            onPress={() => void doPunchOut()}
          />
        )}
      </Card>

      {/* ──────────────────────────────────── the result of the last action */}
      {message && (
        <Card tone={message.tone === "ok" ? "accent" : "danger"}>
          <Text variant="body">{message.text}</Text>
        </Card>
      )}

      {/* ─────────────────────────────── the permission that actually matters */}
      {onDuty && permission && !permission.ok && (
        <Card tone="danger" title="Your location is not being shared">
          <Text variant="body">
            {permission.need === "services"
              ? "Location is switched off on this phone. Turn it on, or the control room cannot see that your site is covered."
              : permission.need === "foreground"
                ? "This app has not been allowed to read your location."
                : "This app can only read your location while the screen is on. The control room will lose you as soon as the phone locks."}
          </Text>
          <Text variant="caption" tone="muted">
            {permission.need === "background"
              ? "Open Permissions → Location and choose “Allow all the time”. Android will not let the app ask for this itself."
              : "It takes a moment, and it stops again the second you check out."}
          </Text>
          <Button
            label={permission.need === "services" ? "Open settings" : "Fix this"}
            variant="danger"
            onPress={() => {
              // A permission that can still be asked for is asked for; one that cannot
              // — which is the Android background case — goes to Settings instead,
              // because a prompt that silently does nothing is worse than no button.
              if (permission.need !== "services" && permission.canAsk) void requestTracking().then(setPermission);
              else openSettings();
            }}
          />
        </Card>
      )}

      {/* ────────────────────────────────────────────────── the panic button */}
      {onDuty && (
        <View style={styles.sos}>
          <HoldButton
            label="Hold 3s for help"
            onComplete={() => void doRaiseSos()}
          />
          <Text variant="micro" tone="muted" style={styles.sosNote}>
            Alerts every guard on this site, the control room, and the client. Standing one
            down afterwards is normal and nobody minds.
          </Text>
        </View>
      )}

      {/* ─────────────────────────────────────────── where they can check in */}
      {!onDuty && (
        <Card
          title="Report for duty"
          subtitle={
            fixAccuracy === null
              ? "Waiting for a GPS fix…"
              : `Your position is accurate to ±${Math.round(fixAccuracy)} m`
          }
          bare
        >
          {proximity.length === 0 ? (
            <View style={styles.empty}>
              <Text variant="body" medium>
                No sites to show yet.
              </Text>
              <Text variant="caption" tone="muted" style={styles.centered}>
                Pull down to try again. If GPS is off, switch it on first — the check-in is
                refused without a position.
              </Text>
            </View>
          ) : (
            proximity.map(({ site, inside, distanceM }) => (
              <View key={site.id} style={styles.siteRow}>
                <View style={styles.siteText}>
                  <Text variant="body" semibold>
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
                  // Not disabled when outside. The local calculation is a hint, and a
                  // guard standing at a gate whose coordinates are slightly wrong must
                  // still be able to try — the server gives the real answer, with the
                  // real distance, which is what a supervisor then investigates.
                  variant={inside ? "primary" : "secondary"}
                  loading={busy === site.id}
                  onPress={() => void doPunchIn(site.id)}
                />
              </View>
            ))
          )}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.appBg },
  body: { padding: space[4], gap: space[4], paddingBottom: space[12] },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "flex-start", gap: space[3] },
  headerText: { flex: 1, gap: 2 },
  stateRow: { flexDirection: "row", alignItems: "flex-start", gap: space[3] },
  stateText: { flex: 1, gap: 2 },
  sos: { gap: space[2] },
  sosNote: { textAlign: "center", paddingHorizontal: space[4] },
  empty: { padding: space[6], gap: space[2], alignItems: "center" },
  centered: { textAlign: "center" },
  siteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  siteText: { flex: 1, gap: 2 },
});
