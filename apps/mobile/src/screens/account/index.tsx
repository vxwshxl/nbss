import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { CalendarCheck, LogOut, Mail, Phone } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

import { roleLabel } from "@nbss/shared/identity";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { LocationPinCard } from "@/components/location-pin-card";
import { PermissionsPanel } from "@/components/permissions-panel";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { photoOf, useAuth } from "@/lib/auth";
import { WEB_URL } from "@/lib/config";
import { gradient, radius, space } from "@/theme/tokens";

/**
 * Me: who you are and how to reach you (one green card), "Pin my location" with its
 * map, whether the phone is set up (SOS alerts among the permissions), and the way out.
 */
export function Account() {
  const { profile, session, signOut, loading } = useAuth();
  const joined = profile?.joined_at
    ? new Date(profile.joined_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <Screen contentStyle={styles.body} topInset={false} bottomInset={false}>
      {/* Who you are and how to reach you, all in the one card, so the page has room for the map below. */}
      <LinearGradient colors={gradient.strong} start={gradient.start} end={gradient.end} style={styles.hero}>
        <View style={styles.heroRing} />
        <View style={styles.heroTop}>
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
                  {profile ? roleLabel(profile.role, profile.trade) : "-"}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.facts}>
          <Fact icon={Phone} value={profile?.phone ?? "No phone given"} />
          <Fact icon={Mail} value={profile?.email ?? "No email given"} />
          {joined && <Fact icon={CalendarCheck} value={`Joined ${joined}`} />}
        </View>
      </LinearGradient>

      {/* Guards, housekeepers and supervisors at a site that is hard to find send where they stand. */}
      {profile && profile.role !== "client" && <LocationPinCard />}

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

function Fact({ icon: Icon, value }: { icon: typeof Phone; value: string }) {
  return (
    <View style={styles.fact}>
      <Icon size={15} color="rgba(255,255,255,0.85)" strokeWidth={2} />
      <Text variant="label" weight="medium" tone="inherit" style={[styles.white, styles.factText]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[4], paddingTop: space[4], paddingBottom: 120 },
  hero: { gap: space[4], padding: space[5], borderRadius: radius["2xl"], overflow: "hidden" },
  heroTop: { flexDirection: "row", alignItems: "center", gap: space[4] },
  facts: { gap: space[2], paddingTop: space[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.25)" },
  fact: { flexDirection: "row", alignItems: "center", gap: space[2.5] },
  factText: { flex: 1, minWidth: 0 },
  heroRing: { position: "absolute", right: -40, top: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.08)" },
  heroText: { flex: 1, minWidth: 0, gap: space[2] },
  white: { color: "#ffffff" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  badge: { paddingHorizontal: space[2.5], paddingVertical: 3, borderRadius: radius.full, backgroundColor: "rgba(255,255,255,0.22)" },
  badgeSoft: { backgroundColor: "rgba(255,255,255,0.12)" },
  legal: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: space[2] },
});
