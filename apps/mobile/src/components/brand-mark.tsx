import { Image } from "expo-image";
import { StyleSheet, View, type ViewProps } from "react-native";

import { radius } from "@/theme/tokens";

/**
 * The NBSS mark.
 *
 * This was a generic `ShieldCheck` glyph from lucide — a placeholder that made the app
 * look like a template. The real artwork is the same file the website serves from
 * `public/logo/NBSS.png`, downscaled to 128px at build time by `pnpm app:icons` so a
 * 34-point avatar is not decoding a 1.4 MB image on every mount.
 *
 * `expo-image` rather than RN's `Image`: it caches the decoded bitmap across mounts, so
 * switching tabs does not re-decode the logo each time.
 */
export function BrandMark({
  size = 34,
  tinted = false,
  style,
  ...rest
}: ViewProps & {
  size?: number;
  /**
   * A pale green tile behind the mark. Off by default, and that is a deliberate reversal:
   * the NBSS mark is a detailed crest with its own dark ground, so a pale green rounded
   * square around it reads as a sticker stuck onto a tile rather than as a logo. The
   * console renders its mark bare too.
   */
  tinted?: boolean;
}) {
  return (
    <View
      style={[
        { width: size, height: size },
        tinted && styles.tile,
        tinted && { borderRadius: size <= 36 ? radius.md : radius.lg },
        styles.centre,
        style,
      ]}
      {...rest}
    >
      <Image
        source={require("../../assets/images/mark.png")}
        // Fills its box when bare; inset only when it has a tile to sit inside.
        style={{ width: size * (tinted ? 0.68 : 1), height: size * (tinted ? 0.68 : 1) }}
        contentFit="contain"
        // Decorative: the brand name sits next to it in text, so a screen reader
        // announcing "NBSS logo, NBSS" would just be saying it twice.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        transition={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center" },
  // `bg-primary/12` — schoolerp's #009164 at 12% over white, flattened.
  tile: { backgroundColor: "#e0f2ec" },
});
