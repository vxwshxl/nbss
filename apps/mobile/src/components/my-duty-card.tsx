import * as Haptics from "expo-haptics";
import { LogIn, LogOut, MapPinned, Radio } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { istTime } from "@nbss/shared/company";

import { Panel } from "@/components/panel";
import { Select } from "@/components/select";
import { SolidButton } from "@/components/solid-button";
import { Text } from "@/components/text";
import { useLoader } from "@/hooks/use-loader";
import { useAuth } from "@/lib/auth";
import { onDutyChanged, openPunch, punchIn, punchOut, supervisedSites, type OpenPunch, type Site } from "@/lib/duty";
import { ensureTracking } from "@/lib/keep-alive";
import { requestTracking } from "@/lib/location";
import { space } from "@/theme/tokens";

/**
 * The supervisor's and field officer's own check-in, at the top of their Today tab (0082).
 *
 *   · Supervisor: at a site they are posted to supervise, inside its boundary, as a guard.
 *   · Field officer: from anywhere; their location is shared until they check out.
 *
 * The server decides (punch_in, punch_out); this only shows the state and the buttons.
 * Tracking starts on check-in and stops on check-out, as for a guard.
 */
export function MyDutyCard() {
  const { role } = useAuth();
  const field = role === "field_officer";
  const staffOnDuty = role === "supervisor" || role === "field_officer";
  const fetcher = useCallback(async (): Promise<{ punch: OpenPunch | null; sites: Site[] }> => {
    if (!staffOnDuty) return { punch: null, sites: [] };
    const [punch, sites] = await Promise.all([openPunch(), field ? Promise.resolve([]) : supervisedSites()]);
    return { punch, sites };
  }, [field, staffOnDuty]);
  const { data, reload } = useLoader(fetcher);
  // The card is on Live and on Today: a check-in on one shows on the other at once.
  useEffect(() => onDutyChanged(() => void reload()), [reload]);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!staffOnDuty || !data) return null;
  const { punch, sites } = data;
  // The site picked, while it is still one of theirs; else the first.
  const siteId = picked && sites.some((x) => x.id === picked) ? picked : (sites[0]?.id ?? null);
  const setSiteId = setPicked;

  const checkIn = async () => {
    if (!field && !siteId) return;
    setBusy(true);
    setMessage(null);
    // Asked here, as for a guard: the moment there is an obvious reason.
    await requestTracking();
    const result = await punchIn(field ? null : siteId);
    setBusy(false);
    setMessage(
      result.ok
        ? {
            ok: result.tracking !== false,
            text: result.tracking === false ? `${result.message} Your location is NOT being shared: allow location "all the time".` : result.message,
          }
        : { ok: false, text: result.error },
    );
    void Haptics.notificationAsync(result.ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    await reload();
    if (result.ok) void ensureTracking();
  };

  const checkOut = async () => {
    setBusy(true);
    setMessage(null);
    const result = await punchOut();
    setBusy(false);
    setMessage(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
    void Haptics.notificationAsync(result.ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    await reload();
  };

  const onDuty = !!punch;
  const where = punch ? (punch.site_id ? (punch.site_name ?? "your site") : "field duty") : null;

  return (
    <Panel tone={onDuty ? "emerald" : "sky"} title={onDuty ? "You are on duty" : "Your check-in"} icon={onDuty ? Radio : field ? MapPinned : LogIn}>
      <View style={styles.body}>
        {onDuty ? (
          <Text variant="label">
            {`Checked in${punch.check_in_at ? ` at ${istTime(punch.check_in_at)}` : ""} · ${where}. `}
            {field ? "Your location is shared with the office until you check out." : "Check out at the site when you leave."}
          </Text>
        ) : field ? (
          <Text variant="label" tone="muted">
            Check in from wherever you are. Your location is shared with the office until you check out.
          </Text>
        ) : sites.length === 0 ? (
          <Text variant="label" tone="muted">
            You are not posted to supervise a site yet. The office posts you from the roster; then you check in at that site.
          </Text>
        ) : (
          <>
            <Text variant="label" tone="muted">
              Check in at the site you supervise, from inside its boundary.
            </Text>
            {sites.length > 1 && siteId && (
              <Select title="Site" value={siteId} onChange={setSiteId} options={sites.map((s) => ({ value: s.id, label: s.name, hint: s.district ?? undefined }))} />
            )}
          </>
        )}

        {message && (
          <Text variant="label" weight="semibold" tone={message.ok ? "primary" : "danger"}>
            {message.text}
          </Text>
        )}

        {onDuty ? (
          <SolidButton label="Check out" icon={LogOut} tone="ink" loading={busy} onPress={() => void checkOut()} />
        ) : field || sites.length > 0 ? (
          <SolidButton
            label={field ? "Check in for field duty" : `Check in${sites.length === 1 ? ` at ${sites[0]!.name}` : ""}`}
            icon={LogIn}
            tone="green"
            loading={busy}
            disabled={!field && !siteId}
            onPress={() => void checkIn()}
          />
        ) : null}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[3] },
});
