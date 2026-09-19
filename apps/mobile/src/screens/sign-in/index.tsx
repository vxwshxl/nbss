import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Field, SecretField } from "@/components/field";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { useAuth } from "@/lib/auth";
import { color, space } from "@/theme/tokens";

/**
 * Sign in.
 *
 * One field for identity, labelled "Employee code or email", because three kinds of
 * person arrive here and they do not hold the same thing:
 *
 *   a guard has the code printed on their card and a six-digit PIN;
 *   a client registered themselves with an email and a password;
 *   office staff may have either, depending on how their account was created.
 *
 * The app cannot ask the server which of those a string is — an endpoint answering
 * "does employee code NBSS-004 exist" would be an enumeration hole open to the
 * internet — so it reads the shape instead, and the label tells the truth about that.
 * See `toLoginEmail` in src/lib/auth.tsx.
 */
export function SignIn() {
  const { signIn, loading } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const result = await signIn(identifier, secret);
    // On success the auth listener swaps the route out from under this screen, so
    // there is nothing to navigate to here.
    if (result.error) setError(result.error);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen style={styles.body}>
        <View style={styles.header}>
          <Text variant="display" bold>
            NBSS
          </Text>
          <Text variant="caption" tone="muted">
            National Bodo Security Services · Kokrajhar
          </Text>
        </View>

        <View style={styles.form}>
          <Field
            label="Employee code or email"
            placeholder="NBSS-014"
            value={identifier}
            onChangeText={(value) => {
              setIdentifier(value);
              setError(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="username"
            // `characters` suits a code and is wrong for an email, which the keyboard
            // will fight. Switched as soon as an '@' appears.
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
            // A guard's PIN is digits, so the numeric keypad is the right default; a
            // password needs the full keyboard.
            keyboardType={identifier.includes("@") ? "default" : "number-pad"}
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            error={error ?? undefined}
          />

          <Button
            label="Sign in"
            size="lg"
            loading={loading}
            disabled={!identifier.trim() || !secret}
            onPress={() => void submit()}
          />
        </View>

        <View style={styles.footer}>
          <Text variant="caption" tone="muted" style={styles.centered}>
            Need security for your premises?
          </Text>
          {/* Deliberately the only route into account creation, and it says who it is
              for. Guard credentials are issued by an administrator — there is no
              self-registration for them, and this line is what stops a guard trying. */}
          <Link href="/(auth)/register" asChild>
            <Button label="Create a client account" variant="secondary" />
          </Link>
          <Text variant="micro" tone="muted" style={styles.centered}>
            Guards and supervisors are issued a code and PIN by the office.
          </Text>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.appBg },
  body: { gap: space[8], paddingTop: space[16] },
  header: { gap: space[1] },
  form: { gap: space[4] },
  footer: { gap: space[3], marginTop: "auto", paddingTop: space[8] },
  centered: { textAlign: "center" },
});
