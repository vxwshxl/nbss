import { cloneElement, createContext, isValidElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type ScrollViewProps, type ViewInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, ScrollView as GestureScrollView } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { color, radius, shadow, space } from "@/theme/tokens";

/** Where the sheet rests: just its header over a full map, half way, or the whole screen. */
export type SheetSnap = "peek" | "half" | "full";

// Just past critical damping: it glides in and settles without a bounce.
const SPRING = { damping: 34, stiffness: 240, mass: 1 };
/** A release faster than this (px/s) is a flick: it opens or closes to the next stop. Slower, the sheet stays where it is let go. */
const FLICK = 1100;

/**
 * Brings something in the sheet into view: the sheet goes all the way up and the list
 * scrolls the thing to the top, above the keyboard (a search box being typed in).
 */
export const SheetReveal = createContext<((target: ViewInstance | null) => void) | null>(null);

// Gesture Handler's own ScrollView, so the sheet's drag and the list's scroll can
// hand over to each other; React Native's would swallow one or the other.
const SheetScroll = Animated.createAnimatedComponent(GestureScrollView);

/**
 * The bottom sheet over a map, as Google Maps and Zomato have it: drag the handle,
 * the header or the list itself and the sheet follows the finger. Let go slowly and
 * it stays where it was left (drifting a touch with the finger's speed), so it can
 * rest half way up or anywhere between; flick it and it carries on to the next of
 * its three stops (the header alone, half, or the whole screen) in that direction.
 *
 * The sheet and its list share one gesture. Pushing up on the list raises the sheet
 * first and, once it is at full height, the same swipe goes on to scroll the list.
 * Pulling down scrolls the list back to its top first and then brings the sheet down,
 * again without lifting the finger. Below full height the list is held where it is
 * (it is never scrolled and dragged at the same time, which is what jittered).
 *
 * `header` is what stays visible at peek. `floating` sits just above the
 * sheet's top edge and rides with it (a recenter button), fading out at full.
 * `onSnap` reports where it settled and how much of the screen it covers, so
 * the map can keep what matters in the part still showing. `snapTo` moves it from
 * outside (a person tapped on the map): each new `key` springs it to `to`.
 */
export function MapSheet({
  header,
  children,
  floating,
  initial = "half",
  onSnap,
  refreshControl,
  snapTo,
}: {
  header: ReactNode;
  children?: ReactNode;
  floating?: ReactNode;
  initial?: SheetSnap;
  onSnap?: (snap: SheetSnap, coveredPx: number) => void;
  refreshControl?: ScrollViewProps["refreshControl"];
  snapTo?: { to: SheetSnap; key: string | number } | null;
}) {
  const [height, setHeight] = useState(0);
  const [headerH, setHeaderH] = useState(0);
  const [snap, setSnap] = useState<SheetSnap>(initial);
  // The list scrolls only while the sheet is all the way up; below that a drag on it
  // moves the sheet. (Holding the list still with scrollTo while both moved did not
  // hold on every phone, and could abort the app.)
  const [atFull, setAtFull] = useState(initial === "full");

  // Where the area the sheet lives in starts on the screen. On a screen with no header
  // above it (the SOS map) that is the very top, and "full" must stop below the status
  // bar and the Dynamic Island rather than slide under them.
  const insets = useSafeAreaInsets();
  const box = useRef<ViewInstance>(null);
  const [winY, setWinY] = useState(0);

  // Offsets from the top of the area the sheet lives in.
  const full = Math.max(space[2], insets.top + space[2] - winY);
  const half = Math.round(height * 0.5);
  const peek = Math.max(half, height - (headerH + 22));
  const points = { full, half, peek };

  // The same three offsets, readable from the gesture on the UI thread.
  const pts = useSharedValue(points);
  const top = useSharedValue(height ? points[initial] : 10_000);
  const ready = useSharedValue(false);

  // The drag: where the sheet would be without the rubber band, and the last
  // translation seen, so each frame moves it by just that frame's movement.
  const raw = useSharedValue(0);
  const lastTy = useSharedValue(0);

  // The list's scroll, and the offset it is held at while the sheet is below full.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h !== height) setHeight(h);
    box.current?.measureInWindow((_x: number, y: number) => {
      const r = Math.round(y);
      if (r !== winY) setWinY(r);
    });
  };

  // Placed once both sizes are known, and kept at the current snap when either changes
  // (the header grows when the guard checks in, the screen when the keyboard goes).
  useEffect(() => {
    if (!height || !headerH) return;
    pts.set(points);
    const at = points[snap];
    top.set(ready.get() ? withSpring(at, SPRING) : at);
    ready.set(true);
    onSnap?.(snap, height - at);
    // Only the measured sizes move it; a snap is placed by the gesture itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, headerH, full]);

  // Asked from outside: spring there and hold the list until it is fully up.
  const [askedKey, setAskedKey] = useState(snapTo?.key);
  if (snapTo && snapTo.key !== askedKey && height && headerH) {
    setAskedKey(snapTo.key);
    setSnap(snapTo.to);
    setAtFull(snapTo.to === "full");
  }
  useEffect(() => {
    if (!snapTo || !height || !headerH) return;
    const at = points[snapTo.to];
    top.set(withSpring(at, SPRING));
    onSnap?.(snapTo.to, height - at);
    // Only a new request moves it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapTo?.key]);

  // Called from the gesture, which is built once; the ref keeps it current.
  const settleRef = useRef<(to: SheetSnap, at: number) => void>(() => {});
  useLayoutEffect(() => {
    settleRef.current = (to: SheetSnap, at: number) => {
      setSnap(to);
      setAtFull(at <= points.full + 0.5);
      onSnap?.(to, height - at);
    };
  });

  /**
   * Two drags share one routine. The header's (the handle, the title, the cards) always
   * moves the sheet, wherever the list is scrolled to, as Google Maps' sheet does. The
   * list's hands over: below full height it moves the sheet; at full height it scrolls
   * the list, and only a pull down with the list already at its top brings the sheet
   * down. Separate gestures rather than one that guesses from where the touch landed:
   * that guess needed the list's measured top, and when it was missing every touch
   * counted as the list's and the header could not move a scrolled sheet.
   */
  const { headerPan, contentPan, native } = useMemo(() => {
    // The ref is read when a drag settles, never while rendering.
    const settleTo = (to: SheetSnap, at: number) => settleRef.current(to, at);
    const native = Gesture.Native();
    const build = (fromContent: boolean) =>
      Gesture.Pan()
        .activeOffsetY([-6, 6])
        // A sideways swipe (a row of chips) is left to the content.
        .failOffsetX([-24, 24])
        .onBegin(() => {
          // A fresh touch on a sheet at full height may scroll the list again. Until
          // then it stays held, so a flick that carried the sheet up doesn't also
          // fling the list.
        })
        .onStart((e) => {
          cancelAnimation(top);
          raw.set(top.get());
          lastTy.set(e.translationY);
        })
        .onUpdate((e) => {
          const p = pts.get();
          const dy = e.translationY - lastTy.get();
          lastTy.set(e.translationY);

          // At full height a swipe on the list belongs to the list: up always, and
          // down until it is back at its top.
          if (fromContent && top.get() <= p.full + 0.5 && (dy < 0 || scrollY.get() > 0.5)) {
            top.set(p.full);
            raw.set(p.full);
            return;
          }

          let r = raw.get() + dy;
          // From the list the sheet stops dead at full, and the rest of the swipe
          // scrolls; from the header it gives a little, as a real sheet does.
          if (fromContent && r < p.full) r = p.full;
          raw.set(r);
          const next = r < p.full ? p.full - (p.full - r) * 0.2 : r > p.peek ? p.peek + (r - p.peek) * 0.2 : r;
          top.set(next);
        })
        // Runs when a drag ends, on the UI thread.
        .onEnd((e) => {
          const p = pts.get();
          const now = top.get();
          const v = e.velocityY;

          if (fromContent && now <= p.full + 0.5 && (scrollY.get() > 0.5 || v < 0)) {
            // The list took this swipe; the sheet stays where it is.
            top.set(withSpring(p.full, SPRING));
            runOnJS(settleTo)("full", p.full);
            return;
          }

          // Where it comes to rest: pulled past either end, back to that end; flicked,
          // on to the next stop in that direction; let go slowly, about where it was
          // left, drifting a little with the finger.
          let to: SheetSnap = "half";
          let rest = now;
          if (now < p.full) {
            to = "full";
            rest = p.full;
          } else if (now > p.peek) {
            to = "peek";
            rest = p.peek;
          } else if (v < -FLICK) {
            to = now > p.half + 4 ? "half" : "full";
            rest = p[to];
          } else if (v > FLICK) {
            to = now < p.half - 4 ? "half" : "peek";
            rest = p[to];
          } else {
            rest = Math.min(p.peek, Math.max(p.full, now + v * 0.1));
            // Within a few points of a stop it settles on the stop.
            const dFull = Math.abs(rest - p.full);
            const dHalf = Math.abs(rest - p.half);
            const dPeek = Math.abs(rest - p.peek);
            to = dFull <= dHalf && dFull <= dPeek ? "full" : dHalf <= dPeek ? "half" : "peek";
            if (Math.abs(rest - p[to]) < 24) rest = p[to];
          }
          top.set(withSpring(rest, { ...SPRING, velocity: v }));
          runOnJS(settleTo)(to, rest);
        });
    // settleRef is read inside onEnd, when a drag ends on the UI thread; the lint reads
    // building the gesture as if it ran then.
    /* eslint-disable react-hooks/refs */
    const headerPan = build(false);
    const contentPan = build(true).simultaneousWithExternalGesture(native);
    /* eslint-enable react-hooks/refs */
    return { headerPan, contentPan, native };
    // Everything it reads is a shared value or goes through settleRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Where the list is scrolled to, for the drag to know whether it is at its top.
  const keep = (y: number) => {
    "worklet";
    scrollY.set(Math.max(0, y));
  };
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => keep(e.contentOffset.y),
    onEndDrag: (e) => keep(e.contentOffset.y),
    onMomentumEnd: (e) => keep(e.contentOffset.y),
  });

  // Pull to refresh only once the sheet is fully up; below that a pull down moves the sheet.
  const refresh = isValidElement(refreshControl)
    ? cloneElement(refreshControl as ReactElement<{ enabled?: boolean }>, {
        enabled: atFull,
      })
    : refreshControl;

  const reveal = useCallback(
    (target: ViewInstance | null) => {
      if (!target || !height) return;
      top.set(withSpring(points.full, SPRING));
      setSnap("full");
      setAtFull(true);
      onSnap?.("full", height - points.full);
      // Once the sheet is up: how far the thing sits below the list's top, scrolled away.
      setTimeout(() => {
        const list = scrollRef.current as unknown as (ViewInstance & { scrollTo?: (o: { y: number; animated: boolean }) => void }) | null;
        list?.measureInWindow((_lx: number, ly: number) => {
          target.measureInWindow((_tx: number, ty: number) => {
            list.scrollTo?.({ y: Math.max(0, scrollY.get() + (ty - ly) - space[3]), animated: true });
          });
        });
      }, 420);
    },
    // Shared values and the ref are stable; the sizes are what change it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [height, points.full],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: top.value }],
  }));
  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: top.value }],
    opacity: interpolate(top.value, [points.full, points.half * 0.8], [0, 1], Extrapolation.CLAMP),
  }));
  const shadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(top.value, [points.full, points.half], [0.25, 0], Extrapolation.CLAMP),
  }));

  return (
    <View ref={box} style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onLayout}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shade, shadeStyle]} />

      {floating && (
        <Animated.View pointerEvents="box-none" style={[styles.floating, floatStyle]}>
          {floating}
        </Animated.View>
      )}

      <Animated.View style={[styles.sheet, { height: height || undefined }, sheetStyle]}>
        <GestureDetector gesture={headerPan}>
          <View>
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
          </View>
        </GestureDetector>
        <GestureDetector gesture={contentPan}>
          <View style={styles.scroll}>
            <GestureDetector gesture={native}>
              <SheetScroll
                ref={scrollRef}
                scrollEnabled={atFull}
                onScroll={onScroll}
                scrollEventThrottle={16}
                bounces={false}
                overScrollMode="never"
                refreshControl={refresh}
                contentContainerStyle={[styles.body, { paddingBottom: space[6] + (height ? points.full : 0) }]}
                showsVerticalScrollIndicator={false}
                style={styles.scroll}
              >
                <SheetReveal.Provider value={reveal}>{children}</SheetReveal.Provider>
              </SheetScroll>
            </GestureDetector>
          </View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shade: { backgroundColor: "#000" },
  floating: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -64,
    height: 56,
    paddingHorizontal: space[4],
  },
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
  grip: {
    alignItems: "center",
    paddingTop: space[2.5],
    paddingBottom: space[4],
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: color.border,
  },
  header: { paddingHorizontal: space[5], paddingBottom: space[3] },
  scroll: { flex: 1 },
  body: { paddingHorizontal: space[5], gap: space[4] },
});
