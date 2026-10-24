import { CircleUserRound, LogOut, MapPin, BadgeCheck } from "lucide-react-native";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { Pressable, StyleSheet, View } from "react-native";

import { ROLE_LABEL } from "@nbss/shared/identity";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { InfoButton } from "@/components/info";
import { PageHeader } from "@/components/page-header";
import { PermissionsPanel } from "@/components/permissions-panel";
import { Panel } from "@/components/panel";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { photoOf, useAuth } from "@/lib/auth";
import { WEB_URL } from "@/lib/config";
import { CAN_RECEIVE_PUSH, IS_EXPO_GO } from "@/lib/runtime";
import { color, space } from "@/theme/tokens";

/**
 * What the app knows about you, and what it does with your location.
 *
 * The location section exists as much for the guard as for the company: being tracked at
 * work is defensible, and being tracked without a plain explanation of when and why is
 * not. The explanation lives behind the (i) rather than on the screen — it is four
 * paragraphs nobody re-reads daily, and burying the sign-out button under it served
 * nobody.
 */
export function Account() {
  const { profile, session, signOut, loading } = useAuth();
  const guard = profile?.role === "guard";

  return (
    <Screen contentStyle={styles.body} topInset={false} bottomInset={false}>
      <PageHeader title="Account" />

      <Panel tone="indigo" title="Details" icon={CircleUserRound}>
        <View style={styles.identity}>
          <Avatar name={profile?.full_name ?? "?"} uri={profile?.avatar_url ?? photoOf(session)} size={52} />
          <View style={styles.identityText}>
            <Text variant="bodyLarge" weight="semibold">
              {profile?.full_name ?? "-"}
            </Text>
            <Text variant="caption" tone="muted" mono>
              {profile?.employee_code ?? "-"}
            </Text>
          </View>
        </View>

        <View style={styles.rows}>
          <Row label="Role" value={profile ? ROLE_LABEL[profile.role] : "-"} />
          <Row label="Phone" value={profile?.phone ?? "-"} />
          <Row
            label="Joined"
            value={
              profile?.joined_at
                ? new Date(profile.joined_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "-"
            }
          />
        </View>
      </Panel>

      {guard && (
      <Panel
        tone="teal"
        title="Your location"
        icon={MapPin}
        action={
          <InfoButton title="How your location is used">
            {[
              "Your position is shared with the control room only while you are checked in. It stops the moment you check out, and nothing at all is recorded in between.",
              "While on duty your phone sends a position when you have moved about fifty metres, and otherwise once every couple of minutes so the office can see the app is still working rather than dead.",
              "If you raise an SOS it sends much more often, until the alert is closed, so the people coming to help can find you.",
              "The trail is kept in full for thirty days so a question about a particular shift can be answered, and is thinned out after that.",
            ]}
          </InfoButton>
        }
      >
        <Text variant="body" tone="muted">
          Shared only while you are checked in. Never off duty.
        </Text>
      </Panel>
      )}

      <PermissionsPanel location={guard} />

      <Panel
        tone="slate"
        title="Alerts"
        icon={BadgeCheck}
        action={
          <InfoButton title="SOS alerts on this phone">
            {[
              "When a guard at your site raises an emergency, this phone rings, even if the app is closed and the phone is on silent.",
              "That is deliberate. An SOS has to reach somebody, so it uses a notification channel that cannot be quietened, and it repeats every minute until a human acknowledges it.",
              IS_EXPO_GO && !CAN_RECEIVE_PUSH
                ? "This test build cannot receive them at all. A development build can."
                : "You can acknowledge an alert to tell everyone else you are on your way.",
            ]}
          </InfoButton>
        }
      >
        <Text variant="body" tone="muted">
          {IS_EXPO_GO && !CAN_RECEIVE_PUSH
            ? "Not available in this test build."
            : "You will be alerted if a colleague at your site needs help."}
        </Text>
      </Panel>

      <Button
        label="Sign out"
        variant="outline"
        icon={LogOut}
        fullWidth
        loading={loading}
        onPress={() => void signOut()}
      />

      <View style={styles.legal}>
        <LegalLink label="Terms & Conditions" path="/terms-and-conditions" />
        <Text variant="caption" tone="muted">
          ·
        </Text>
        <LegalLink label="Privacy Policy" path="/privacy-policy" />
      </View>
      <Text variant="caption" tone="muted" style={styles.version}>
        NBSS Kokrajhar · app {Constants.expoConfig?.version ?? "-"}
      </Text>
    </Screen>
  );
}

/** The website's own page, in the in-app browser, so the guard comes straight back. */
function LegalLink({ label, path }: { label: string; path: string }) {
  return (
    <Pressable accessibilityRole="link" hitSlop={8} onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}${path}`)}>
      <Text variant="label" weight="medium" tone="primary">
        {label}
      </Text>
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <Text variant="label" weight="medium">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[6] },
  identity: { flexDirection: "row", alignItems: "center", gap: space[3] },
  identityText: { flex: 1, gap: 2 },
  rows: { gap: 0 },
  legal: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: space[2], marginTop: -space[2] },
  version: { textAlign: "center", marginTop: -space[4] },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space[4],
    paddingVertical: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.lineSoft,
  },
});
