import { Check, ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, radius, space } from "@/theme/tokens";

import { Text } from "./text";

export type SelectOption<T extends string> = { value: T; label: string; hint?: string };

/**
 * A dropdown: a field showing the choice, and a sheet of options from the bottom of the
 * screen when tapped. For filters (a site, a period, a status) where a row of chips would
 * scroll sideways out of sight.
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
  const insets = useSafeAreaInsets();
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

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + space[3] }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.grab} />
            <Text variant="title" weight="semibold" style={styles.title}>
              {title}
            </Text>
            <ScrollView style={styles.list} bounces={false}>
              {options.map((o) => {
                const on = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
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
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: color.card, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], paddingHorizontal: space[3], paddingTop: space[2], maxHeight: "75%" },
  grab: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: color.border, marginBottom: space[3] },
  title: { paddingHorizontal: space[2], marginBottom: space[2] },
  list: { flexGrow: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[3], paddingVertical: space[3], borderRadius: radius.lg },
  rowOn: { backgroundColor: color.muted },
});
