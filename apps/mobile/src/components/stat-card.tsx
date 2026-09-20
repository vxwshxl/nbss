import { ArrowRight, type LucideIcon } from "lucide-react-native";
import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { TONES, toneFor, type Tone } from "@/theme/tones";
import { color, radius, shadow, space } from "@/theme/tokens";

import { Text } from "./text";

/**
 * A headline figure, ported from apps/web/src/components/console/stat-card.tsx.
 *
 * The card is white and the colour lives in the icon chip — which is the choice the web
 * component's own comment explains: a fully tinted surface with a tinted number gives
 * you four tiles all shouting equally, so the figures, the only thing anyone came for,
 * compete with their own backgrounds. On a plain surface the number is the loudest thing
 * on the card and the tint still does its real job, which is letting you find the same
 * tile again tomorrow without reading it.
 *
 * `toneFor` is the same hash as the console's, so a given label picks the same colour in
 * both — "On duty now" is the same green on a phone as on the dashboard.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  cta,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  /** When set, the whole card becomes a link. Typed, because `typedRoutes` is on. */
  href?: Href;
  cta?: string;
  tone?: Tone;
}) {
  const t = TONES[tone ?? toneFor(label)];

  const body = (
    <>
      <View style={[styles.chip, { backgroundColor: t.chip }]}>
        <Icon size={20} strokeWidth={1.9} color={t.chipText} />
      </View>

      <View style={styles.text}>
        <Text variant="label" weight="medium" tone="muted">
          {label}
        </Text>
        <Text variant="statValue" weight="semibold" style={styles.value}>
          {value}
        </Text>
        {hint && (
          <Text variant="caption" tone="muted" style={styles.hint}>
            {hint}
          </Text>
        )}
      </View>

      {href && (
        // Spelled out rather than left to a hover state, exactly as the web component
        // does — on a touch screen there is no cursor to change, and a card that
        // silently happens to be a link is a card nobody taps.
        <View style={styles.cta}>
          <Text variant="label" weight="semibold" tone="primary">
            {cta ?? "View"}
          </Text>
          <ArrowRight size={16} strokeWidth={2} color={color.primary} />
        </View>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} asChild>
        <Pressable
          accessibilityRole="link"
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          {body}
        </Pressable>
      </Link>
    );
  }

  return <View style={styles.card}>{body}</View>;
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    // A floor rather than a fixed height: two cards side by side on a tablet should
    // match even when one has a hint and the other does not.
    minHeight: 148,
    backgroundColor: color.card,
    borderRadius: radius["2xl"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineSoft,
    padding: space[5],
    ...shadow.card,
  },
  pressed: { opacity: 0.85 },
  chip: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { marginTop: space[4], flex: 1 },
  value: { marginTop: 2 },
  hint: { marginTop: space[1] },
  cta: { flexDirection: "row", alignItems: "center", gap: space[1.5 as 2], marginTop: space[4] },
});
