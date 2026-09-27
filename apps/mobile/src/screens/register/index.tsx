import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";

import { isValidPhone } from "@nbss/shared/identity";

import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { useAuth } from "@/lib/auth";
import { color, space } from "@/theme/tokens";

/**
 * Creating a client account.
 *
 * The only self-registration in the system, and it grants a login and nothing else. A
 * new account owns no sites, and `sites_client_read` in 0004 scopes a client to
 * `client_id = auth.uid()` — so somebody who signs up out of curiosity can see exactly
 * nothing, which is what makes it safe to put this button on a public screen.
 *
 * The role is not sent. `signUpClient` passes `signup: 'client'` as a marker and the
 * trigger in 0007 hardcodes the role, so a modified app asking for 'admin' here still
 * gets a client account.
 */
export function Register() {
  const { signUpClient, verifyCode, loading } = useAuth();

  const [fullName, setFullName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"details" | "code">("details");

  const send = async () => {
    setError(null);
    if (!isValidPhone(phone)) {
      setError("Enter a 10-digit mobile number — it is how the deployment desk replies.");
      return;
    }
    const result = await signUpClient({ email, fullName, phone, organisation });
    if (result.error) {
      setError(result.error);
      return;
    }
    setCode("");
    setStep("code");
  };

  const verify = async (value = code) => {
    setError(null);
    const result = await verifyCode(email, value);
    if (result.error) setError(result.error);
    // On success the auth listener signs them in; the index route sends a client
    // to their screens, where Book guards is one tap away.
    else router.replace("/");
  };

  if (step === "code") {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Screen contentStyle={styles.body} topInset={false}>
          <View style={styles.form}>
            <Text variant="pageTitle" weight="bold">
              Check your email
            </Text>
            <Text variant="label" tone="muted">
              Enter the 6-digit code we sent to {email.trim()}.
            </Text>
            <Field
              label="Verification code"
              placeholder="••••••"
              value={code}
              onChangeText={(value) => {
                const digits = value.replace(/\D/g, "").slice(0, 6);
                setCode(digits);
                setError(null);
                if (digits.length === 6) void verify(digits);
              }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              maxLength={6}
              autoFocus
              error={error ?? undefined}
              style={styles.codeInput}
            />
            <Button
              label="Verify and continue"
              size="lg"
              fullWidth
              loading={loading}
              disabled={code.length !== 6}
              onPress={() => void verify()}
            />
            <Button label="Edit my details" variant="ghost" fullWidth onPress={() => setStep("details")} />
          </View>
        </Screen>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen contentStyle={styles.body} topInset={false}>
        <Text variant="label" tone="muted">
          Book guards and follow your deployment in one place.
        </Text>

        <View style={styles.form}>
          <Field
            label="Your name"
            placeholder="Bikash Das"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
          />
          <Field
            label="Organisation"
            placeholder="Kokrajhar Nursing Home"
            value={organisation}
            onChangeText={setOrganisation}
            autoCapitalize="words"
            hint="Optional"
          />
          <Field
            label="Mobile"
            placeholder="98765 43210"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          <Field
            label="Email"
            placeholder="you@company.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            error={error ?? undefined}
          />

          <Button
            label="Continue"
            size="lg"
            fullWidth
            loading={loading}
            disabled={!fullName.trim() || !email.trim() || !phone.trim()}
            onPress={() => void send()}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.appBg },
  body: { gap: space[6] },
  form: { gap: space[4] },
  codeInput: { textAlign: "center", fontSize: 26, letterSpacing: 10 },
});
