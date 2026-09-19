import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { color } from "@/theme/tokens";

/**
 * Where a launch lands, decided by role.
 *
 * `session === undefined` means the encrypted store has not been read yet. Showing a
 * spinner for that moment rather than falling through to sign-in matters: guards open
 * this app at the start of a shift and a sign-in screen that flashes at somebody
 * already signed in reads as "it has logged me out again".
 *
 * This is convenience, not protection. Every screen behind these redirects checks for
 * itself, and every query behind those is filtered by row level security in Postgres.
 */
export default function Index() {
  const { session, profile, role } = useAuth();

  if (session === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/sign-in" />;

  // Signed in, but no usable profile — a deactivated account, or one whose profile row
  // never got created. Back to sign-in, where the message can be explained.
  if (!profile) return <Redirect href="/(auth)/sign-in" />;

  switch (role) {
    case "guard":
      return <Redirect href="/(guard)/duty" />;
    case "client":
      return <Redirect href="/(client)/site" />;
    case "admin":
    case "supervisor":
      return <Redirect href="/(staff)/live" />;
    default:
      return <Redirect href="/(auth)/sign-in" />;
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.appBg },
});
