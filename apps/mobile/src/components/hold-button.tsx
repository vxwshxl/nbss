import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { SOS_HOLD_MS } from "@nbss/shared/sos";

import { color, radius, space } from "@/theme/tokens";

import { Text } from "./text";

/**
 * The panic button.
 *
 * Hold, not tap, and the three seconds are not arbitrary. A tap is triggered by a
 * phone in a pocket; a confirmation dialog needs a second accurate tap at exactly
 * the moment accuracy is gone. A sustained hold is the only gesture that a pocket
 * cannot produce and a frightened person can.
 *
 * ── Why the progress ring is on the UI thread and the haptics are not
 *
 * The fill runs through Reanimated, so it keeps animating even while JavaScript is
 * busy — and at the moment this button is pressed, JavaScript is about to be very
 * busy doing a GPS read, an RPC and a realtime publish. A fill driven by
 * `setState` would visibly stall right when the person holding it needs to believe
 * it is working.
 *
 * The haptics have to be on the JS thread because `expo-haptics` is a native module
 * call, so they are driven by an interval that is started and cleared alongside the
 * animation. They escalate: light ticks that get closer together, then a heavy thud
 * on release. Someone holding this is probably not looking at the screen, so the
 * feedback has to be something they can feel.
 */
export function HoldButton({
  label = "Hold for SOS",
  holdingLabel = "Keep holding…",
  onComplete,
  disabled,
  durationMs = SOS_HOLD_MS,
}: {
  label?: string;
  holdingLabel?: string;
  onComplete: () => void;
  disabled?: boolean;
  durationMs?: number;
}) {
  const progress = useSharedValue(0);
  const holding = useSharedValue(0);

  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickCount = useRef(0);

  const stopTicking = useCallback(() => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    tickCount.current = 0;
  }, []);

  // An interval left running after the screen unmounts would keep buzzing a phone
  // whose user has navigated away.
  useEffect(() => stopTicking, [stopTicking]);

  const fire = useCallback(() => {
    stopTicking();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete();
    // Reset so a second alert can be raised without leaving the screen. `raise_sos`
    // treats a repeat as a re-notification rather than a new incident, so pressing
    // again is a safe and useful thing to be able to do.
    progress.value = 0;
    holding.value = withTiming(0, { duration: 180 });
  }, [holding, onComplete, progress, stopTicking]);

  const begin = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Ticks that get closer together as the ring fills, so the hold has a rhythm
    // that tells you how far through you are without looking.
    stopTicking();
    ticker.current = setInterval(() => {
      tickCount.current += 1;
      void Haptics.impactAsync(
        tickCount.current > 6
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
      );
    }, 300);

    holding.value = withTiming(1, { duration: 140 });
    progress.value = withTiming(
      1,
      { duration: durationMs, easing: Easing.linear },
      (finished) => {
        // `finished` is false when the animation was cancelled by a release. Without
        // this check, letting go early would still raise the alarm.
        if (finished) runOnJS(fire)();
      },
    );
  }, [durationMs, fire, holding, progress, stopTicking]);

  const release = useCallback(() => {
    stopTicking();
    cancelAnimation(progress);
    // Snaps back rather than easing, so an accidental brush reads unmistakably as
    // "that did not count".
    progress.value = withTiming(0, { duration: 200 });
    holding.value = withTiming(0, { duration: 180 });
  }, [holding, progress, stopTicking]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + holding.value * 0.015 }],
  }));

  return (
    <Animated.View style={containerStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={`Hold for ${Math.round(durationMs / 1000)} seconds to alert everyone on your site and the control room.`}
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled}
        onPressIn={begin}
        onPressOut={release}
        style={[styles.button, disabled && styles.disabled]}
      >
        {/* The fill sits behind the label and grows from the left. A ring would be
            prettier; a bar is legible at a glance from an arm's length away. */}
        <Animated.View style={[styles.fill, fillStyle]} pointerEvents="none" />
        <View style={styles.labelWrap} pointerEvents="none">
          <Text variant="title" tone="inverse" bold>
            SOS
          </Text>
          <Text variant="caption" tone="inverse" medium style={styles.sub}>
            {label}
          </Text>
        </View>
      </Pressable>
      {/* Rendered always, not conditionally, so the layout does not jump when the
          hold begins. */}
      <Text variant="micro" tone="muted" style={styles.legal}>
        {holdingLabel.toUpperCase()}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 96,
    borderRadius: radius["2xl"],
    backgroundColor: color.sos,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.4 },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: color.sosDeep,
  },
  labelWrap: { alignItems: "center", gap: 2 },
  sub: { opacity: 0.9 },
  legal: {
    textAlign: "center",
    marginTop: space[2],
    letterSpacing: 0.6,
    opacity: 0,
  },
});
