import type { LucideIcon } from "lucide-react-native";
import { StyleSheet, View, type ViewProps } from "react-native";

import { TONES, type Tone } from "@/theme/tones";
import { color, radius, shadow, space } from "@/theme/tokens";

import { Text } from "./text";

/**
 * A section card in the console's dashboard style: a rounded, bordered surface with an
 * optional pastel header strip (icon + title on the left, an action on the right) and a
 * padded body.
 *
 * A direct port of apps/web/src/components/ui/panel.tsx, including the tone strip, so a
 * screen laid out here looks like the same screen in the browser. The only change is
 * that `bodyClassName` becomes `bare` — the one thing every call site used it for was
 * removing the padding so a map or a full-width list could reach the edges.
 */
export function Panel({
  tone = "slate",
  title,
  subtitle,
  icon: Icon,
  action,
  bare,
  children,
  style,
  ...rest
}: ViewProps & {
  tone?: Tone;
  title?: string;
  /** Not in the web component. A second line in the strip, where a count or an "as of". */
  subtitle?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  bare?: boolean;
}) {
  const t = TONES[tone];

  return (
    <View style={[styles.panel, style]} {...rest}>
      {title && (
        <View style={[styles.bar, { backgroundColor: t.bar }]}>
          {Icon && <Icon size={18} strokeWidth={2} color={t.barText} />}
          <View style={styles.barText}>
            <Text variant="panelTitle" weight="bold" tone="inherit" style={{ color: t.barText }}>
              {title}
            </Text>
            {subtitle && (
              <Text variant="caption" tone="inherit" style={{ color: t.barText, opacity: 0.75 }}>
                {subtitle}
              </Text>
            )}
          </View>
          {action && <View style={styles.action}>{action}</View>}
        </View>
      )}
      <View style={bare ? styles.bodyBare : styles.body}>{children}</View>
    </View>
  );
}

/**
 * A row inside a `bare` Panel, with the hairline divider the console's tables use.
 * `first` drops the top border so the strip above it is not double-lined.
 */
export function PanelRow({
  first,
  children,
  style,
  ...rest
}: ViewProps & { first?: boolean }) {
  return (
    <View style={[styles.row, first && styles.rowFirst, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: color.card,
    borderRadius: radius["2xl"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineSoft,
    overflow: "hidden",
    ...shadow.card,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2.5],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  barText: { flex: 1, gap: 1 },
  action: { flexDirection: "row", alignItems: "center", gap: space[2] },
  body: { padding: space[4], gap: space[3] },
  bodyBare: {},
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
  },
  rowFirst: { borderTopWidth: 0 },
});
