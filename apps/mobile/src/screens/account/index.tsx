import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { BellRing, CalendarCheck, LogOut, Mail, MapPin, Phone } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

import { ROLE_LABEL } from "@nbss/shared/identity";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { InfoButton } from "@/components/info";
import { PermissionsPanel } from "@/components/permissions-panel";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { photoOf, useAuth } from "@/lib/auth";
import { WEB_URL } from "@/lib/config";
import { CAN_RECEIVE_PUSH } from "@/lib/runtime";
import { color, gradient, radius, space } from "@/theme/tokens";

/**
 * Me: who you are, the few facts that matter, whether the phone is set up, and the
 * way out. Anything longer (how location is used) sits behind an (i).
 */
export function Account() {
  const { profile, session, signOut, loading } = useAuth();
  const guard = profile?.role === "guard";
  const joined = profile?.joined_at
    ? new Date(profile.joined_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <Screen contentStyle={styles.body} topInset={false} bottomInset={false}>
      <LinearGradient colors={gradient.strong} start={gradient.start} end={gradient.end} style={styles.hero}>
        <View style={styles.heroRing} />
        <Avatar name={profile?.full_name ?? "?"} uri={profile?.avatar_url ?? photoOf(session)} size={68} />
        <View style={styles.heroText}>
          <Text variant="title" weight="bold" tone="inherit" style={styles.white} numberOfLines={2}>
            {profile?.full_name ?? "-"}
          </Text>
          <View style={styles.badges}>
            <View style={styles.badge}>
              <Text variant="caption" weight="bold" tone="inherit" style={styles.white}>
                {profile?.employee_code ?? "-"}
              </Text>
            </View>
            <View style={[styles.badge, styles.badgeSoft]}>
              <Text variant="caption" weight="semibold" tone="inherit" style={styles.white}>
                {profile ? ROLE_LABEL[profile.role] : "-"}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.card}>
        <Row icon={Phone} label="Phone" value={profile?.phone ?? "Not given"} />
        <Row icon={Mail} label="Email" value={profile?.email ?? "Not given"} />
        {joined && <Row icon={CalendarCheck} label="Joined" value={joined} />}
        {guard && (
          <Row
            icon={MapPin}
            label="Location"
            value="Shared on duty only"
            extra={
              <InfoButton title="How your location is used">
                {[
                  "Shared with the control room only while you are checked in. It stops the moment you check out.",
                  "On duty the phone sends a position as you move, and a quick check-in every few minutes so the office knows the app is working.",
                  "During an SOS it sends more often until the alert is closed. The trail is kept for thirty days.",
                ]}
              </InfoButton>
            }
          />
        )}
        <Row icon={BellRing} label="SOS alerts" value={CAN_RECEIVE_PUSH ? "On, even when closed" : "Install the app build"} last />
      </View>

      {/* Anyone who carries the SOS button needs location, as a guard does. */}
      <PermissionsPanel location={profile?.role !== "client"} />

      <Button label="Sign out" variant="outline" icon={LogOut} fullWidth loading={loading} onPress={() => void signOut()} />

      <View style={styles.legal}>
        <LegalLink label="Terms" path="/terms-and-conditions" />
        <Text variant="caption" tone="muted">
          ·
        </Text>
        <LegalLink label="Privacy" path="/privacy-policy" />
      </View>
    </Screen>
  );
}

/** The website's own page, in the in-app browser, so the person comes straight back. */
function LegalLink({ label, path }: { label: string; path: string }) {
  return (
    <Pressable accessibilityRole="link" hitSlop={8} onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}${path}`)}>
      <Text variant="caption" weight="medium" tone="muted">
        {label}
      </Text>
    </Pressable>
  );
}

function Row({ icon: Icon, label, value, extra, last }: { icon: typeof Phone; label: string; value: string; extra?: React.ReactNode; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowLine]}>
      <View style={styles.rowIcon}>
        <Icon size={17} color={color.primaryInk} strokeWidth={2} />
      </View>
      <View style={styles.rowText}>
        <Text variant="caption" tone="muted">
          {label}
        </Text>
        <Text variant="label" weight="semibold" numberOfLines={1}>
          {value}
        </Text>
      </View>
      {extra}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[4], paddingTop: space[4], paddingBottom: 120 },
  hero: { flexDirection: "row", alignItems: "center", gap: space[4], padding: space[5], borderRadius: radius["2xl"], overflow: "hidden" },
  heroRing: { position: "absolute", right: -40, top: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.08)" },
  heroText: { flex: 1, minWidth: 0, gap: space[2] },
  white: { color: "#ffffff" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  badge: { paddingHorizontal: space[2.5], paddingVertical: 3, borderRadius: radius.full, backgroundColor: "rgba(255,255,255,0.22)" },
  badgeSoft: { backgroundColor: "rgba(255,255,255,0.12)" },
  card: { borderRadius: radius["2xl"], backgroundColor: color.card, borderWidth: StyleSheet.hairlineWidth, borderColor: color.border, paddingHorizontal: space[4] },
  row: { flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[3] },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.lineSoft },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: color.accent },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  legal: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: space[2] },
});
