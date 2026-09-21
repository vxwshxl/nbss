import { Info, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HIT_SLOP, color, radius, shadow, space } from "@/theme/tokens";

import { Text } from "./text";

/**
 * An (i) that explains something, instead of a paragraph that explains it permanently.
 *
 * Screens here were carrying a lot of standing prose — why a permission matters, what the
 * app does with a location, which parts of a test build do not work. All of it is true and
 * worth being able to read, and none of it is worth the vertical space it was taking on a
 * phone every single time, because a guard checking in at 6am has read it already.
 *
 * So the sentence that states the situation stays on the screen, and the explanation moves
 * behind this. Nothing is hidden that a person cannot get back in one tap, and the screen
 * goes back to being mostly the thing it is for.
 *
 * A modal sheet rather than a tooltip: a tooltip has nowhere to go on a 360pt screen, and
 * this content is paragraphs rather than a label.
 */
export function InfoButton({
  title,
  children,
  label = "More information",
  tone = "muted",
}: {
  title: string;
  /** The explanation. Strings are rendered as paragraphs; nodes are rendered as given. */
  children: React.ReactNode | string[];
  label?: string;
  tone?: "muted" | "inverse";
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const body = Array.isArray(children)
    ? children.map((paragraph, i) => (
        <Text key={i} variant="body" tone="muted" style={styles.paragraph}>
          {paragraph}
        </Text>
      ))
    : children;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={`Explains: ${title}`}
        hitSlop={HIT_SLOP}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
      >
        <Info
          size={18}
          strokeWidth={2}
          color={tone === "inverse" ? color.background : color.mutedForeground}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        // Android's back button should close the sheet, not the screen behind it.
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        {/* Tapping the scrim closes it — the gesture people try first. */}
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} accessibilityLabel="Close" />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + space[6] }]}>
          {/* The grabber. Not interactive — it is a signal that this drags away, and the
              scrim and the close button are what actually dismiss it. */}
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Text variant="title" weight="semibold" style={styles.headerText}>
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={HIT_SLOP}
              onPress={() => setOpen(false)}
              style={({ pressed }) => [styles.close, pressed && styles.triggerPressed]}
            >
              <X size={18} strokeWidth={2} color={color.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {body}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerPressed: { opacity: 0.55 },

  scrim: { flex: 1, backgroundColor: color.scrim },
  sheet: {
    backgroundColor: color.card,
    borderTopLeftRadius: radius["3xl"],
    borderTopRightRadius: radius["3xl"],
    paddingHorizontal: space[5],
    paddingTop: space[3],
    // Never more than two-thirds of the screen: this is an aside, and a sheet that covers
    // the screen reads as a navigation step the person has to get back out of.
    maxHeight: "66%",
    ...shadow.raised,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: color.border,
    marginBottom: space[4],
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[3],
    marginBottom: space[3],
  },
  headerText: { flex: 1 },
  close: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.muted,
  },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: space[3], paddingBottom: space[2] },
  paragraph: { lineHeight: 24 },
});
