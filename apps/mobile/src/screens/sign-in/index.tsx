import { Link } from "expo-router";
import { AlertCircle, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COMPANY } from "@nbss/shared/company";

import { AppBackground } from "@/components/app-background";
import { Button } from "@/components/button";
import { Field, SecretField } from "@/components/field";
import { Text } from "@/components/text";
import { useLayout } from "@/hooks/use-breakpoint";
import { useAuth } from "@/lib/auth";
import { color, radius, space } from "@/theme/tokens";

/**
 * Sign in, laid out like the console's own login page.
 *
 * The web version is `grid lg:grid-cols-2`: a dark brand panel beside the form, collapsing
 * to form-only below the large breakpoint. That maps exactly onto this app's two shapes —
 * a tablet gets the split, a phone gets the stacked version with the primary-tinted shield
 * the web shows in place of the panel (`lg:hidden`). So the responsive behaviour is not
 * invented for mobile; it is the same rule the console already follows, at a smaller
 * breakpoint.
 *
 * One field for identity, labelled "Employee code or email", because three kinds of person
 * arrive here and they do not hold the same thing. The app cannot ask the server which of
 * those a string is — an endpoint answering "does employee code NBSS-004 exist" would be an
 * enumeration hole open to the internet — so it reads the shape instead, and the label tells
 * the truth about that. See `toLoginEmail` in src/lib/auth.tsx.
 */
export function SignIn() {
  const { signIn, loading } = useAuth();
  const { isTablet } = useLayout();
  const insets = useSafeAreaInsets();

  const [identifier, setIdentifier] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const result = await signIn(identifier, secret);
    // On success the auth listener swaps the route out from under this screen, so there is
    // nothing to navigate to here.
    if (result.error) setError(result.error);
  };

  const form = (
    <View style={styles.formColumn}>
      <View style={[styles.intro, !isTablet && styles.introCentred]}>
        {/* The web shows this only below `lg`, in place of the brand panel. */}
        {!isTablet && (
          <View style={styles.shield}>
            <ShieldCheck size={26} strokeWidth={1.9} color={color.primary} />
          </View>
        )}
        <Text variant="pageTitle" weight="bold">
          Sign in
        </Text>
        <Text variant="label" tone="muted" style={!isTablet && styles.centred}>
          Use the employee code printed on your identity card. If you have forgotten your PIN,
          your supervisor can reset it.
        </Text>
      </View>

      <View style={styles.form}>
        {error && (
          <View style={styles.alert} accessibilityRole="alert">
            <AlertCircle size={16} color={color.destructive} style={styles.alertIcon} />
            <Text variant="label" tone="danger" style={styles.alertText}>
              {error}
            </Text>
          </View>
        )}

        <Field
          label="Employee code or email"
          placeholder="NBSS-041"
          value={identifier}
          onChangeText={(value) => {
            setIdentifier(value);
            setError(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="username"
          // `characters` suits a code and fights an email address; switched the moment an
          // '@' appears.
          keyboardType={identifier.includes("@") ? "email-address" : "default"}
          returnKeyType="next"
          hint="Guards: the code on your card. Clients: the email you registered with."
        />

        <SecretField
          label="PIN or password"
          placeholder="••••••"
          value={secret}
          onChangeText={(value) => {
            setSecret(value);
            setError(null);
          }}
          keyboardType={identifier.includes("@") ? "default" : "number-pad"}
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />

        <Button
          label="Sign in"
          size="lg"
          fullWidth
          loading={loading}
          disabled={!identifier.trim() || !secret}
          onPress={() => void submit()}
        />
      </View>

      <View style={styles.footer}>
        <Text variant="caption" tone="muted" style={styles.centred}>
          Need security for your premises?
        </Text>
        {/* The only route into account creation, and it says who it is for. Guard
            credentials are issued by an administrator — there is no self-registration for
            them, and this line is what stops a guard trying. */}
        <Link href="/(auth)/register" asChild>
          <Button label="Create a client account" variant="outline" fullWidth />
        </Link>
        <Text variant="micro" tone="muted" style={styles.centred}>
          Guards and supervisors are issued a code and PIN by the office.
        </Text>
      </View>
    </View>
  );

  /** The dark brand panel. Shown on a tablet only, as `lg:flex` does on the web. */
  const brand = (
    <View style={[styles.brand, { paddingTop: insets.top + space[10] }]}>
      <View style={styles.brandTop}>
        <View style={styles.mark}>
          <ShieldCheck size={22} strokeWidth={2} color={color.primary} />
        </View>
        <Text variant="bodyLarge" weight="bold" tone="inherit" style={styles.brandInk}>
          {COMPANY.shortName}
        </Text>
      </View>

      <View style={styles.brandMiddle}>
        <Text variant="hero" weight="bold" tone="inherit" style={[styles.brandInk, styles.tagline]}>
          {COMPANY.tagline}
        </Text>
        <Text variant="label" tone="inherit" style={styles.brandBody}>
          Attendance here is recorded against a geofence at the site itself, not against a
          signature in a register. What this console shows is where people actually were.
        </Text>
      </View>

      <Text variant="caption" tone="inherit" style={styles.brandFoot}>
        {COMPANY.city}, {COMPANY.region} · {COMPANY.state}
      </Text>
    </View>
  );

  return (
    <AppBackground>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.split, isTablet && styles.splitRow]}>
          {isTablet && brand}
          <ScrollView
            style={styles.fill}
            contentContainerStyle={[
              styles.scroll,
              { paddingTop: (isTablet ? space[10] : insets.top + space[12]) },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {form}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  split: { flex: 1 },
  splitRow: { flexDirection: "row" },

  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: space[5],
    paddingBottom: space[12],
  },
  // `max-w-sm` on the web. The form stays readable rather than stretching across a tablet.
  formColumn: { width: "100%", maxWidth: 384, alignSelf: "center", gap: space[8] },

  intro: { gap: space[2] },
  introCentred: { alignItems: "center" },
  centred: { textAlign: "center" },
  shield: {
    width: 48,
    height: 48,
    borderRadius: radius["2xl"],
    alignItems: "center",
    justifyContent: "center",
    // `bg-primary/12`, flattened.
    backgroundColor: "#e0f0e8",
    marginBottom: space[3],
  },

  form: { gap: space[5] },
  alert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[2],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#eec3c2",
    backgroundColor: "#fdf4f3",
    paddingHorizontal: space[3],
    paddingVertical: space[2.5],
  },
  alertIcon: { marginTop: 2 },
  alertText: { flex: 1 },

  footer: { gap: space[3] },

  // ── the brand panel
  brand: {
    flex: 1,
    maxWidth: 460,
    backgroundColor: color.foreground,
    paddingHorizontal: space[10],
    paddingBottom: space[10],
    justifyContent: "space-between",
  },
  brandTop: { flexDirection: "row", alignItems: "center", gap: space[3] },
  mark: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff14",
  },
  brandInk: { color: color.background },
  brandMiddle: { maxWidth: 420, gap: space[5] },
  tagline: { lineHeight: 52 },
  brandBody: { color: color.background, opacity: 0.7, lineHeight: 22 },
  brandFoot: { color: color.background, opacity: 0.5 },
});
