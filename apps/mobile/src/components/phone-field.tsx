import { ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { COUNTRY_CODES, joinPhone, splitPhone } from "@nbss/shared/identity";

import { color, radius, space } from "@/theme/tokens";

import { Field } from "./field";
import { Text } from "./text";

/**
 * A phone number: the country code from a list (+91 preset) and exactly ten digits.
 * `value` and `onChange` carry the stored form (ten digits for India, "+<code><digits>"
 * otherwise), the same as the website's phone field.
 */
export function PhoneField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const start = splitPhone(value);
  const [code, setCode] = useState(start.code);
  const [national, setNational] = useState(start.national.slice(0, 10));
  const [picking, setPicking] = useState(false);

  const update = (c: string, n: string) => {
    setCode(c);
    setNational(n);
    onChange(n ? joinPhone(c, n) : "");
  };

  return (
    <View>
      <Field
        label={label}
        value={national}
        onChangeText={(t) => update(code, t.replace(/\D/g, "").slice(0, 10))}
        keyboardType="number-pad"
        maxLength={10}
        placeholder="10-digit number"
        autoComplete="tel"
        hint={national && national.length !== 10 ? `${national.length}/10 digits` : undefined}
        left={
          <Pressable accessibilityRole="button" accessibilityLabel={`Country code ${code}`} onPress={() => setPicking(true)} style={styles.code}>
            <Text weight="semibold" mono>
              {code}
            </Text>
            <ChevronDown size={14} color={color.mutedForeground} />
          </Pressable>
        }
      />
      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.scrim} onPress={() => setPicking(false)}>
          <View style={styles.sheet}>
            {COUNTRY_CODES.map((c) => (
              <Pressable
                key={c.code}
                onPress={() => {
                  update(c.code, national);
                  setPicking(false);
                }}
                style={({ pressed }) => [styles.row, (pressed || c.code === code) && styles.rowOn]}
              >
                <Text weight="semibold" mono style={styles.rowCode}>
                  {c.code}
                </Text>
                <Text tone="muted">{c.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  code: { flexDirection: "row", alignItems: "center", gap: 4, paddingRight: space[3], marginRight: space[2], borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: color.border, alignSelf: "stretch" },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: space[6] },
  sheet: { backgroundColor: color.card, borderRadius: radius["2xl"], padding: space[2] },
  row: { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[3], paddingVertical: space[3], borderRadius: radius.lg },
  rowOn: { backgroundColor: color.muted },
  rowCode: { width: 56 },
});
