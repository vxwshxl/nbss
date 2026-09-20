import { useWindowDimensions } from "react-native";

/**
 * Responsive layout, on Tailwind's breakpoints.
 *
 * The console is a desk instrument that reflows from one column to four. The app runs on
 * a 360pt phone and a 1024pt tablet, and the gap between those is wider than the gap
 * between a tablet and a laptop — a layout tuned for the phone leaves a tablet showing
 * one column of cards down the middle of a mostly empty screen, which looks like a
 * stretched phone app because that is exactly what it is.
 *
 * `useWindowDimensions` rather than a one-off `Dimensions.get`: it re-renders on rotation
 * and on an iPad split-view resize, both of which change the answer.
 */

/** Tailwind's own values, so a "sm:" in the console means the same thing here. */
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;

export type Layout = {
  width: number;
  height: number;
  /** Under 640pt — a phone in portrait. One column. */
  isPhone: boolean;
  /** 640pt and up — a big phone in landscape, or a tablet. */
  isWide: boolean;
  /** 768pt and up — a tablet. Where a side rail becomes worth the space. */
  isTablet: boolean;
  landscape: boolean;
  /** How many columns a grid of stat cards should use at this width. */
  statColumns: 1 | 2 | 3 | 4;
  /**
   * The widest the content should be allowed to get.
   *
   * Capped rather than filling the screen: a line of text 1000pt wide is unreadable, and
   * the console caps its own content for the same reason. Beyond the cap the content
   * centres and the background shows either side.
   */
  contentMaxWidth: number;
  /** Side gutter. Grows with the screen, as the console's `px-4 sm:px-6` does. */
  gutter: number;
};

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();

  const isWide = width >= BREAKPOINTS.sm;
  const isTablet = width >= BREAKPOINTS.md;
  const isLarge = width >= BREAKPOINTS.lg;

  return {
    width,
    height,
    isPhone: !isWide,
    isWide,
    isTablet,
    landscape: width > height,
    statColumns: isLarge ? 4 : isTablet ? 3 : isWide ? 2 : 1,
    // 820 is about 75 characters of Geist at 16px — the point past which a paragraph
    // becomes hard to track back to the start of.
    contentMaxWidth: isLarge ? 980 : isTablet ? 820 : width,
    gutter: isTablet ? 24 : 16,
  };
}

/**
 * Picks a value per breakpoint, smallest first, in the style of a Tailwind class list.
 *
 *   const cols = useResponsive({ base: 1, sm: 2, lg: 4 });
 */
export function useResponsive<T>(values: { base: T; sm?: T; md?: T; lg?: T; xl?: T }): T {
  const { width } = useWindowDimensions();

  if (width >= BREAKPOINTS.xl && values.xl !== undefined) return values.xl;
  if (width >= BREAKPOINTS.lg && values.lg !== undefined) return values.lg;
  if (width >= BREAKPOINTS.md && values.md !== undefined) return values.md;
  if (width >= BREAKPOINTS.sm && values.sm !== undefined) return values.sm;
  return values.base;
}
