import { Check, ChevronDown, Search, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, TextInput, View, useWindowDimensions, type ViewStyle } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, radius, space } from "@/theme/tokens";

import { Text } from "./text";

export type SelectOption<T extends string> = { value: T; label: string; hint?: string };

const SPRING = { damping: 26, stiffness: 260, mass: 0.9 };

/**
 * A dropdown: a field showing the choice, and a sheet of options from the bottom.
 *
 * The sheet behaves like the map's: it rises to half height (the backdrop fades in
 * behind it, separately, so nothing dark slides up with it), can be dragged by its top
 * to full height or back, and dragged down, or the backdrop tapped, to close. A search
 * at the top filters by name and detail; typing in it takes the sheet to full height
 * so the keyboard never hides the list.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  title,
  style,
}: {
  value: T;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  /** The sheet's heading, e.g. "Site". */
  title: string;
  style?: ViewStyle;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${current?.label ?? ""}. Change`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, pressed && styles.pressed, style]}
      >
        <View style={styles.fieldText}>
          <Text variant="micro" weight="semibold" tone="muted">
            {title.toUpperCase()}
          </Text>
          <Text variant="label" weight="semibold" numberOfLines={1}>
            {current?.label ?? "Choose"}
          </Text>
        </View>
        <ChevronDown size={18} color={color.mutedForeground} strokeWidth={2} />
      </Pressable>

      {open && (
        <Sheet
          title={title}
          options={options}
          value={value}
          onClose={() => setOpen(false)}
          onPick={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/** The sheet on its own, for a control that draws its own trigger (a phone's country code). */
export function OptionSheet<T extends string>(props: {
  title: string;
  options: SelectOption<T>[];
  value: T;
  onClose: () => void;
  onPick: (v: T) => void;
}) {
  return <Sheet {...props} />;
}

function Sheet<T extends string>({
  title,
  options,
  value,
  onClose,
  onPick,
}: {
  title: string;
  options: SelectOption<T>[];
  value: T;
  onClose: () => void;
  onPick: (v: T) => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: screen } = useWindowDimensions();
  const [q, setQ] = useState("");

  // Positions as how far the sheet sits below its full height.
  const sheetH = Math.round(screen * 0.88);
  const FULL = 0;
  const HALF = Math.max(0, sheetH - Math.round(screen * 0.56));
  const CLOSED = sheetH + 40;

  const y = useSharedValue(CLOSED);
  const shade = useSharedValue(0);
  const start = useSharedValue(0);

  useEffect(() => {
    shade.set(withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }));
    y.set(withSpring(HALF, SPRING));
  }, [shade, y, HALF]);

  const close = (then?: () => void) => {
    shade.set(withTiming(0, { duration: 180 }));
    y.set(
      withTiming(CLOSED, { duration: 220, easing: Easing.in(Easing.quad) }, (done) => {
        if (done) runOnJS(then ?? onClose)();
      }),
    );
  };

  const drag = Gesture.Pan()
    .onStart(() => {
      start.set(y.get());
    })
    .onUpdate((e) => {
      const next = start.get() + e.translationY;
      // A little give above the top, as a real sheet has.
      y.set(next < FULL ? FULL - (FULL - next) * 0.15 : next);
    })
    .onEnd((e) => {
      const projected = y.get() + e.velocityY * 0.2;
      if (projected > HALF + 120 || e.velocityY > 1200) {
        shade.set(withTiming(0, { duration: 180 }));
        y.set(withTiming(CLOSED, { duration: 200 }, (done) => done && runOnJS(onClose)()));
        return;
      }
      y.set(withSpring(projected < HALF / 2 ? FULL : HALF, { ...SPRING, velocity: e.velocityY }));
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const shadeStyle = useAnimatedStyle(() => ({ opacity: shade.get() }));

  const t = q.trim().toLowerCase();
  const shown = t ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(t)) : options;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => close()}>
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[styles.scrim, shadeStyle]}>
          <Pressable accessibilityLabel="Close" style={styles.fill} onPress={() => close()} />
        </Animated.View>

        <Animated.View style={[styles.sheet, { height: sheetH, paddingBottom: insets.bottom + space[2] }, sheetStyle]}>
          {/* The top of the sheet is the handle: drag it up, down, or away. */}
          <GestureDetector gesture={drag}>
            <View style={styles.head}>
              <View style={styles.grab} />
              <View style={styles.titleRow}>
                <Text variant="title" weight="semibold" style={styles.fill}>
                  {title}
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={() => close()} style={styles.close}>
                  <X size={18} color={color.foreground} strokeWidth={2} />
                </Pressable>
              </View>
              <View style={styles.search}>
                <Search size={17} color={color.mutedForeground} strokeWidth={2} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder={`Search ${title.toLowerCase()}`}
                  placeholderTextColor={color.mutedForeground}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  onFocus={() => y.set(withSpring(FULL, SPRING))}
                  style={styles.searchInput}
                />
                {q ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQ("")}>
                    <X size={15} color={color.mutedForeground} strokeWidth={2} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </GestureDetector>

          <ScrollView style={styles.fill} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.listPad}>
            {shown.length === 0 ? (
              <Text variant="label" tone="muted" style={styles.empty}>
                Nothing matches “{q.trim()}”.
              </Text>
            ) : (
              shown.map((o) => {
                const on = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => close(() => onPick(o.value))}
                    style={({ pressed }) => [styles.row, (pressed || on) && styles.rowOn]}
                  >
                    <View style={styles.fieldText}>
                      <Text variant="body" weight={on ? "semibold" : "regular"} numberOfLines={1}>
                        {o.label}
                      </Text>
                      {o.hint ? (
                        <Text variant="caption" tone="muted" numberOfLines={1}>
                          {o.hint}
                        </Text>
                      ) : null}
                    </View>
                    {on ? <Check size={18} color={color.primary} strokeWidth={2.4} /> : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    minHeight: 52,
    paddingHorizontal: space[4],
    borderRadius: radius.xl,
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.border,
  },
  fieldText: { flex: 1, minWidth: 0, gap: 1 },
  pressed: { backgroundColor: color.muted },
  scrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(6,17,13,0.42)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.card,
    borderTopLeftRadius: radius["2xl"] + 4,
    borderTopRightRadius: radius["2xl"] + 4,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  head: { paddingHorizontal: space[4], paddingTop: space[2], paddingBottom: space[2], gap: space[3] },
  grab: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: color.border },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: color.muted, alignItems: "center", justifyContent: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 46, paddingHorizontal: space[3], borderRadius: radius.xl, backgroundColor: color.muted },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: color.foreground,
    paddingVertical: 0,
    ...(Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as object) : null),
  },
  listPad: { paddingHorizontal: space[3], paddingBottom: space[6] },
  row: { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[3], paddingVertical: space[3], borderRadius: radius.lg },
  rowOn: { backgroundColor: color.muted },
  empty: { textAlign: "center", paddingVertical: space[6] },
});
