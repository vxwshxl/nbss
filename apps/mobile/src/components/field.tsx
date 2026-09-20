import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { TOUCH_MIN, color, radius, space, text } from "@/theme/tokens";

import { Text } from "./text";

/**
 * A labelled input.
 *
 * The label sits above the field rather than floating into it. A floating label is
 * prettier and is the wrong choice here: it disappears as soon as there is a value,
 * and someone checking a long form before submitting it at a gate needs to be able
 * to see what each box is for without emptying it.
 */
export function Field({
  label,
  hint,
  error,
  right,
  style,
  ...rest
}: TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  right?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text weight="medium" variant="caption" tone="muted">
        {label}
      </Text>

      <View
        style={[
          styles.box,
          focused && styles.boxFocused,
          Boolean(error) && styles.boxError,
        ]}
      >
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={color.mutedForeground}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
        />
        {right}
      </View>

      {(error || hint) && (
        <Text variant="caption" tone={error ? "danger" : "muted"}>
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}

/** The PIN field. Numeric keypad, and a reveal control, because six digits get mistyped. */
export function SecretField({
  label,
  ...rest
}: TextInputProps & { label: string; hint?: string; error?: string }) {
  const [shown, setShown] = useState(false);

  return (
    <Field
      label={label}
      secureTextEntry={!shown}
      autoCapitalize="none"
      autoCorrect={false}
      // `oneTimeCode` would fight a password manager; `password` lets one fill it.
      textContentType="password"
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={shown ? "Hide" : "Show"}
          hitSlop={12}
          onPress={() => setShown((v) => !v)}
          style={styles.reveal}
        >
          <Text weight="semibold" variant="caption" tone="primary">
            {shown ? "Hide" : "Show"}
          </Text>
        </Pressable>
      }
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  box: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: color.background,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    paddingHorizontal: space[3],
    minHeight: TOUCH_MIN,
  },
  boxFocused: { borderColor: color.primary, borderWidth: 1.5 },
  boxError: { borderColor: color.destructive, borderWidth: 1.5 },
  input: {
    flex: 1,
    paddingVertical: space[3],
    fontSize: text.body.fontSize,
    lineHeight: text.body.lineHeight,
    color: color.foreground,
  },
  reveal: { paddingLeft: space[2], paddingVertical: space[2] },
});
