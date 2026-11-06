import * as Haptics from "expo-haptics";
import { useEffect, useSyncExternalStore } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";

import { color, radius, shadow, space } from "@/theme/tokens";

import { Button } from "./button";
import { Text } from "./text";

/**
 * The app's own popup, in place of the phone's native alert, so a message looks like
 * the rest of the app on iPhone and Android alike.
 *
 * Called like React Native's `Alert.alert(title, message, buttons)`, from anywhere (an
 * event handler, an async function), and drawn by the one <DialogHost /> at the root.
 * One popup at a time; a second waits until the first is answered.
 */

export type DialogButton = {
  text: string;
  /** `cancel` is the quiet button and what Android's back button and the scrim press; `destructive` is red. */
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};
type Dialog = { id: number; title: string; message?: string; buttons: DialogButton[] };

let queue: Dialog[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showDialog(title: string, message?: string, buttons?: DialogButton[]) {
  queue = [...queue, { id: nextId++, title, message, buttons: buttons?.length ? buttons : [{ text: "OK" }] }];
  emit();
}

function close(d: Dialog, b: DialogButton | undefined) {
  queue = queue.filter((q) => q.id !== d.id);
  emit();
  b?.onPress?.();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const current = () => queue[0] ?? null;

export function DialogHost() {
  const d = useSyncExternalStore(subscribe, current, current);

  useEffect(() => {
    if (d) void Haptics.selectionAsync();
  }, [d]);

  if (!d) return null;
  const cancel = d.buttons.find((b) => b.style === "cancel");
  // The cancel button first (left), the action last (right, under the thumb).
  const ordered = [...d.buttons].sort((a, b) => Number(b.style === "cancel") - Number(a.style === "cancel"));
  const stacked = ordered.length > 2;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => close(d, cancel)}>
      <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)} style={styles.scrimWrap}>
        {/* A tap outside counts as Cancel, and does nothing where there is no Cancel to press. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={cancel ? () => close(d, cancel) : undefined} accessibilityLabel={cancel?.text} />
        <Animated.View key={d.id} entering={ZoomIn.springify().damping(18).stiffness(260)} style={styles.card} accessibilityRole="alert">
          <Text variant="title" weight="semibold">
            {d.title}
          </Text>
          {d.message ? (
            <Text variant="body" tone="muted" style={styles.message}>
              {d.message}
            </Text>
          ) : null}
          <View style={[styles.buttons, stacked && styles.stacked]}>
            {ordered.map((b) => (
              <Button
                key={b.text}
                label={b.text}
                variant={b.style === "cancel" ? "outline" : b.style === "destructive" ? "destructive" : "default"}
                onPress={() => close(d, b)}
                style={stacked ? undefined : styles.flex}
                fullWidth={stacked}
              />
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrimWrap: { flex: 1, backgroundColor: color.scrim, alignItems: "center", justifyContent: "center", padding: space[6] },
  card: {
    width: "100%",
    maxWidth: 400,
    gap: space[2],
    padding: space[5],
    borderRadius: radius["2xl"],
    backgroundColor: color.card,
    ...shadow.raised,
  },
  message: { lineHeight: 22 },
  buttons: { flexDirection: "row", gap: space[2], marginTop: space[3] },
  stacked: { flexDirection: "column" },
  flex: { flex: 1 },
});
