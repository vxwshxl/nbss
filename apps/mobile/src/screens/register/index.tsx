import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";

import { isValidPhone } from "@nbss/shared/identity";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Field, SecretField } from "@/components/field";
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
  const { signUpClient, loading } = useAuth();

  const [fullName, setFullName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setError(null);

    if (phone.trim() && !isValidPhone(phone)) {
      setError("That does not look like an Indian mobile number.");
      return;
    }

    const result = await signUpClient({
      email,
      password,
      // The organisation is appended to the name rather than dropped: the profile has
      // no company column, and an operator ringing back needs to know who they are
      // calling. A proper field for it belongs on the service request, not here.
      fullName: organisation.trim() ? `${fullName.trim()} (${organisation.trim()})` : fullName,
      phone: phone.trim() || undefined,
    });

    if (result.error) {
      setError(result.error);
      return;
    }

    // Supabase returns no session when email confirmation is switched on. Saying so
    // beats sitting on a spinner waiting for a session that is not coming.
    if (result.needsConfirmation) setSent(true);
    else router.replace("/");
  };

  if (sent) {
    return (
      <Screen style={styles.body}>
        <Card tone="accent" title="Check your email">
          <Text variant="body">
            We have sent a confirmation link to {email.trim()}. Open it and then sign in —
            you will be able to request guards straight away.
          </Text>
        </Card>
        <Button label="Back to sign in" variant="secondary" onPress={() => router.replace("/(auth)/sign-in")} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen style={styles.body}>
        <Text variant="caption" tone="muted">
          For organisations who want to book security. Guards and supervisors are issued
          a code and PIN by the office — this is not that.
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
            hint="Optional, but it helps us find you when you call."
          />
          <Field
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <Field
            label="Mobile"
            placeholder="98765 43210"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            hint="How the deployment desk replies."
          />
          <SecretField
            label="Choose a password"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            textContentType="newPassword"
            error={error ?? undefined}
          />

          <Button
            label="Create account"
            size="lg"
            loading={loading}
            disabled={!fullName.trim() || !email.trim() || password.length < 8}
            onPress={() => void submit()}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.appBg },
  body: { gap: space[5] },
  form: { gap: space[4] },
});
