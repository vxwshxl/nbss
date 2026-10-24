import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type ScrollViewProps } from "react-native";
import { Gesture, GestureDetector, ScrollView as GestureScrollView } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { color, radius, shadow, space } from "@/theme/tokens";

/** Where the sheet rests: just its header over a full map, half way, or the whole screen. */
export type SheetSnap = "peek" | "half" | "full";
const ORDER: SheetSnap[] = ["full", "half", "peek"];

const SPRING = { damping: 26, stiffness: 260, mass: 0.9 };

// Gesture Handler's own ScrollView, so the sheet's drag and the list's scroll can
// hand over to each other; React Native's would swallow one or the other.
const SheetScroll = Animated.createAnimatedComponent(GestureScrollView);

/**
 * The bottom sheet over a map, as Google Maps has it: drag the handle (or the
 * sheet itself) and it settles at the nearest of three heights, carried by the
 * flick. At full height the body scrolls; pulling down from the top of it
 * brings the sheet down again.
 *
 * `header` is what stays visible at peek. `floating` sits just above the
 * sheet's top edge and rides with it (a recenter button), fading out at full.
 * `onSnap` reports where it settled and how much of the screen it covers, so
 * the map can keep what matters in the part still showing.
 */
export function MapSheet({
  header,
  children,
  floating,
  initial = "half",
  onSnap,
  refreshControl,
}: {
  header: ReactNode;
  children?: ReactNode;
  floating?: ReactNode;
  initial?: SheetSnap;
  onSnap?: (snap: SheetSnap, coveredPx: number) => void;
  refreshControl?: ScrollViewProps["refreshControl"];
}) {
  const [height, setHeight] = useState(0);
  const [headerH, setHeaderH] = useState(0);
  const [snap, setSnap] = useState<SheetSnap>(initial);

  // Offsets from the top of the area the sheet lives in.
  const full = space[2];
  const half = Math.round(height * 0.5);
  const peek = Math.max(half, height - (headerH + 22));
  const points = { full, half, peek };

  const top = useSharedValue(height ? points[initial] : 10_000);
  const start = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const ready = useSharedValue(false);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h !== height) setHeight(h);
  };

  // Placed once both sizes are known, and kept at the current snap when either changes
  // (the header grows when the guard checks in, the screen when the keyboard goes).
  useEffect(() => {
    if (!height || !headerH) return;
    const at = points[snap];
    top.set(ready.get() ? withSpring(at, SPRING) : at);
    ready.set(true);
    onSnap?.(snap, height - at);
    // Only the measured sizes move it; a snap is placed by the gesture itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, headerH]);

  const settle = (to: SheetSnap) => {
    setSnap(to);
    onSnap?.(to, height - points[to]);
  };

  const native = Gesture.Native();
  const pan = Gesture.Pan()
    .simultaneousWithExternalGesture(native)
    .activeOffsetY([-6, 6])
    .onStart(() => {
      start.set(top.get());
    })
    .onUpdate((e) => {
      const atFull = start.value <= points.full + 1;
      // At full height the list scrolls first: up always scrolls, and down only
      // moves the sheet once the list is back at its top.
      if (atFull && (e.translationY < 0 || scrollY.value > 0)) {
        start.set(top.get() - e.translationY);
        return;
      }
      const next = start.value + e.translationY;
      // A little give past either end, as a real sheet has.
      top.set(
        next < points.full ? points.full - (points.full - next) * 0.2 : next > points.peek ? points.peek + (next - points.peek) * 0.2 : next,
      );
    })
    .onEnd((e) => {
      const projected = top.value + e.velocityY * 0.18;
      let best: SheetSnap = "half";
      let gap = Infinity;
      for (const s of ORDER) {
        const d = Math.abs(points[s] - projected);
        if (d < gap) {
          gap = d;
          best = s;
        }
      }
      top.set(withSpring(points[best], { ...SPRING, velocity: e.velocityY }));
      runOnJS(settle)(best);
    });

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: top.value }] }));
  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: top.value }],
    opacity: interpolate(top.value, [points.full, points.half * 0.8], [0, 1], Extrapolation.CLAMP),
  }));
  const shadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(top.value, [points.full, points.half], [0.25, 0], Extrapolation.CLAMP),
  }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={onLayout}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shade, shadeStyle]} />

      {floating && (
        <Animated.View pointerEvents="box-none" style={[styles.floating, floatStyle]}>
          {floating}
        </Animated.View>
      )}

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.sheet, { height: height || undefined }, sheetStyle]}>
          <View style={styles.grip}>
            <View style={styles.handle} />
          </View>
          <View
            onLayout={(e) => {
              const hh = Math.round(e.nativeEvent.layout.height);
              if (hh !== headerH) setHeaderH(hh);
            }}
            style={styles.header}
          >
            {header}
          </View>
          <GestureDetector gesture={native}>
            <SheetScroll
              onScroll={onScroll}
              scrollEventThrottle={16}
              scrollEnabled={snap === "full"}
              bounces={false}
              overScrollMode="never"
              refreshControl={refreshControl}
              contentContainerStyle={[styles.body, { paddingBottom: space[6] + (height ? points.full : 0) }]}
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
            >
              {children}
            </SheetScroll>
          </GestureDetector>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  shade: { backgroundColor: "#000" },
  floating: { position: "absolute", left: 0, right: 0, top: -64, height: 56, paddingHorizontal: space[4] },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: color.card,
    borderTopLeftRadius: radius["3xl"],
    borderTopRightRadius: radius["3xl"],
    ...shadow.raised,
  },
  grip: { alignItems: "center", paddingTop: space[2.5], paddingBottom: space[4] },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: color.border },
  header: { paddingHorizontal: space[5], paddingBottom: space[3] },
  scroll: { flex: 1 },
  body: { paddingHorizontal: space[5], gap: space[4] },
});
