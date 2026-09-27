import { Link } from "expo-router";
import { AlertCircle, ArrowRight, KeyRound, Mail } from "lucide-react-native";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COMPANY } from "@nbss/shared/company";

import { AppBackground } from "@/components/app-background";
import { BrandMark } from "@/components/brand-mark";
import { Button, LinkButton } from "@/components/button";
import { Field, SecretField } from "@/components/field";
import { Text } from "@/components/text";
import { useLayout } from "@/hooks/use-breakpoint";
import { useAuth } from "@/lib/auth";
import { color, radius, space } from "@/theme/tokens";

/**
 * The one sign-in for every role — administrators, supervisors, guards and
 * clients — laid out like the website's /login.
 *
 * Step one asks who: an email or an employee code. Step two proves it, with a
 * six-digit code mailed to them or with the password / PIN they already hold.
 * Nobody picks a role; the profile decides where they land (app/index.tsx).
 */
type Step = "identify" | "code" | "password";

const RESEND_SECONDS = 30;

export function SignIn() {
  const { sendCode, verifyCode, signIn, loading } = useAuth();
  const { isTablet } = useLayout();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("identify");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (step !== "code") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);

  const resendIn = Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000));

  const requestCode = async (again = false) => {
    setError(null);
    setNotice(null);
    const result = await sendCode(identifier);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCode("");
    setSentAt(Date.now());
    setNow(Date.now());
    setStep("code");
    if (again) setNotice("A new code is on its way.");
  };

  const submitCode = async (value = code) => {
    setError(null);
    // On success the auth listener swaps the route out from under this screen.
    const result = await verifyCode(identifier, value);
    if (result.error) setError(result.error);
  };

  const submitPassword = async () => {
    setError(null);
    const result = await signIn(identifier, secret);
    if (result.error) setError(result.error);
  };

  const heading =
    step === "code"
      ? { title: "Check your email", sub: "Enter the 6-digit code we sent you." }
      : step === "password"
        ? { title: "Enter your password", sub: "Your password or PIN." }
        : { title: "Sign in", sub: "Continue with your email or employee code." };

  const form = (
    <View style={styles.formColumn}>
      <View style={[styles.intro, !isTablet && styles.introCentred]}>
        {!isTablet && <BrandMark size={72} style={styles.shield} />}
        <Text variant="pageTitle" weight="bold">
          {heading.title}
        </Text>
        <Text variant="label" tone="muted" style={!isTablet && styles.centred}>
          {heading.sub}
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
        {!error && notice && (
          <View style={styles.notice}>
            <Text variant="label" style={styles.noticeText}>
              {notice}
            </Text>
          </View>
        )}

        {step === "identify" ? (
          <Field
            label="Email or employee code"
            placeholder="you@example.com"
            value={identifier}
            onChangeText={(value) => {
              setIdentifier(value);
              setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="username"
            keyboardType="email-address"
            returnKeyType="go"
            onSubmitEditing={() => void requestCode()}
          />
        ) : (
          <View style={styles.who}>
            <Text variant="label" weight="medium" numberOfLines={1} style={styles.whoText}>
              {identifier.trim()}
            </Text>
            <LinkButton
              label="Change"
              onPress={() => {
                setStep("identify");
                setError(null);
              }}
            />
          </View>
        )}

        {step === "code" && (
          <View style={styles.codeBlock}>
            <Field
              label="Verification code"
              placeholder="••••••"
              value={code}
              onChangeText={(value) => {
                const digits = value.replace(/\D/g, "").slice(0, 6);
                setCode(digits);
                setError(null);
                if (digits.length === 6) void submitCode(digits);
              }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={6}
              autoFocus
              style={styles.codeInput}
            />
            <View style={styles.resendRow}>
              <Text variant="caption" tone="muted">
                Didn&apos;t get it?
              </Text>
              {resendIn > 0 ? (
                <Text variant="caption" tone="muted">
                  Resend in {resendIn}s
                </Text>
              ) : (
                <LinkButton label="Resend code" onPress={() => void requestCode(true)} />
              )}
            </View>
          </View>
        )}

        {step === "password" && (
          <SecretField
            label="Password or PIN"
            placeholder="••••••"
            value={secret}
            onChangeText={(value) => {
              setSecret(value);
              setError(null);
            }}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={() => void submitPassword()}
          />
        )}

        {step === "identify" && (
          <Button
            label="Continue"
            size="lg"
            fullWidth
            icon={ArrowRight}
            iconEnd
            loading={loading}
            disabled={!identifier.trim()}
            onPress={() => void requestCode()}
          />
        )}
        {step === "code" && (
          <Button
            label="Verify and sign in"
            size="lg"
            fullWidth
            loading={loading}
            disabled={code.length !== 6}
            onPress={() => void submitCode()}
          />
        )}
        {step === "password" && (
          <Button
            label="Sign in"
            size="lg"
            fullWidth
            loading={loading}
            disabled={!secret}
            onPress={() => void submitPassword()}
          />
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.orRow}>
          <View style={styles.rule} />
          <Text variant="caption" tone="muted">
            or
          </Text>
          <View style={styles.rule} />
        </View>
        {step === "password" ? (
          <Button
            label="Email me a code instead"
            variant="outline"
            icon={Mail}
            fullWidth
            disabled={loading}
            onPress={() => void requestCode()}
          />
        ) : (
          <Button
            label="Use password or PIN"
            variant="outline"
            icon={KeyRound}
            fullWidth
            disabled={!identifier.trim()}
            onPress={() => {
              setError(null);
              setStep("password");
            }}
          />
        )}
        {step === "identify" && (
          <Link href="/(auth)/register" asChild>
            <Button label="Create a client account" variant="ghost" fullWidth />
          </Link>
        )}
      </View>
    </View>
  );

  /** The dark brand panel. Shown on a tablet only, as `lg:flex` does on the web. */
  const brand = (
    <View style={[styles.brand, { paddingTop: insets.top + space[10] }]}>
      <View style={styles.brandTop}>
        <BrandMark size={44} style={styles.mark} />
        <Text variant="bodyLarge" weight="bold" tone="inherit" style={styles.brandInk}>
          {COMPANY.shortName}
        </Text>
      </View>

      <View style={styles.brandMiddle}>
        <Text variant="hero" weight="bold" tone="inherit" style={[styles.brandInk, styles.tagline]}>
          {COMPANY.tagline}
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
  shield: { marginBottom: space[3] },

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
  orRow: { flexDirection: "row", alignItems: "center", gap: space[3] },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: color.border },
  who: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[3],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.muted,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  whoText: { flex: 1 },
  codeBlock: { gap: space[2] },
  codeInput: { textAlign: "center", fontSize: 26, letterSpacing: 10 },
  resendRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  notice: {
    borderRadius: radius.lg,
    backgroundColor: color.accent,
    paddingHorizontal: space[3],
    paddingVertical: space[2.5],
  },
  noticeText: { color: color.accentForeground },

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
  mark: {},
  brandInk: { color: color.background },
  brandMiddle: { maxWidth: 420, gap: space[5] },
  tagline: { lineHeight: 52 },
  brandBody: { color: color.background, opacity: 0.7, lineHeight: 22 },
  brandFoot: { color: color.background, opacity: 0.5 },
});
