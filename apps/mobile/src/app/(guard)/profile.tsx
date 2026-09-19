import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@nbss/shared/identity";
import { space } from "@/theme/tokens";

/**
 * What the app knows about you, and the honest statement of what it does with your
 * location. This screen exists as much for the guard as for the company: being tracked
 * at work is defensible, and being tracked without a plain explanation of when and why
 * is not.
 */
export default function ProfileRoute() {
  const { profile, signOut, loading } = useAuth();

  return (
    <Screen style={styles.body} bottomInset={false}>
      <Card title="You">
        <Row label="Name" value={profile?.full_name ?? "—"} />
        <Row label="Employee code" value={profile?.employee_code ?? "—"} />
        <Row label="Role" value={profile ? ROLE_LABEL[profile.role] : "—"} />
        <Row label="Phone" value={profile?.phone ?? "—"} />
      </Card>

      <Card title="Your location">
        <Text variant="body">
          Your position is shared with the control room only while you are checked in. It
          stops the moment you check out, and nothing is recorded in between.
        </Text>
        <Text variant="caption" tone="muted">
          While on duty your phone sends a position when you have moved about fifty metres,
          and otherwise once every couple of minutes so the office can see the app is still
          working. If you raise an SOS it sends much more often until the alert is closed.
        </Text>
        <Text variant="caption" tone="muted">
          The trail is kept at full detail for thirty days, so a question about a particular
          shift can be answered, and then thinned out.
        </Text>
      </Card>

      <Button label="Sign out" variant="secondary" loading={loading} onPress={() => void signOut()} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="body" medium>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[4] },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space[4] },
});
