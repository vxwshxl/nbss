import { ArrowRight, type LucideIcon } from "lucide-react-native";
import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { useLayout } from "@/hooks/use-breakpoint";
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
  const { isTablet } = useLayout();

  /**
   * The console's figure is `text-4xl` because it has a quarter of a wide screen to put
   * it in. Two cards side by side on a 390pt phone gives each about 170 points, so the
   * base size steps down — and then steps down again for a long value.
   *
   * The length check is doing real work, not guarding an edge case. `adjustsFontSizeToFit`
   * is iOS-only: on Android and web it is silently ignored, so "UITEST-G1" at 26px simply
   * ran out past the edge of its card. Sizing from the string is the only thing that
   * actually holds on every platform.
   */
  const base = isTablet ? 36 : 26;
  const valueSize =
    value.length > 12 ? Math.round(base * 0.58)
    : value.length > 8 ? Math.round(base * 0.72)
    : value.length > 5 ? Math.round(base * 0.85)
    : base;

  const body = (
    <>
      <View style={styles.head}>
        <View style={[styles.chip, { backgroundColor: t.chip }]}>
          <Icon size={18} strokeWidth={1.9} color={t.chipText} />
        </View>
        <Text variant="caption" weight="medium" tone="muted" numberOfLines={1} style={styles.label}>
          {label}
        </Text>
      </View>

      <View style={styles.text}>
        <Text
          weight="semibold"
          numberOfLines={1}
          // An em-dash at full size reads as a thick black bar rather than as "no value",
          // so a missing figure is rendered at the hint's size instead of the figure's.
          style={
            value === "—"
              ? styles.absent
              : { fontSize: valueSize, lineHeight: Math.round(valueSize * 1.15) }
          }
        >
          {value}
        </Text>
        {hint && (
          <Text variant="caption" tone="muted" numberOfLines={2} style={styles.hint}>
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
    // A floor rather than a fixed height, so two cards side by side match even when one
    // has a hint and the other does not. 108 rather than 148: the chip moved up beside
    // the label instead of sitting on its own line above it.
    minHeight: 108,
    backgroundColor: color.card,
    borderRadius: radius["2xl"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineSoft,
    padding: space[4],
    ...shadow.card,
  },
  pressed: { opacity: 0.85 },
  head: { flexDirection: "row", alignItems: "center", gap: space[2] },
  chip: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flex: 1 },
  text: { marginTop: space[3], flex: 1, justifyContent: "flex-end" },
  absent: { fontSize: 20, lineHeight: 24, color: color.mutedForeground },
  hint: { marginTop: space[1] },
  cta: { flexDirection: "row", alignItems: "center", gap: space[1.5 as 2], marginTop: space[4] },
});
