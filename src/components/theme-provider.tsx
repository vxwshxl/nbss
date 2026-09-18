"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Light / dark / system, system by default, with an explicit choice persisted
 * to localStorage.
 *
 * Dark mode is not a nicety here. Half of this product is used at a gate at
 * 2 a.m. by someone whose eyes have adjusted to the dark; a white check-in
 * screen at that hour is a genuinely worse tool. So the console ships both
 * themes and every token in `globals.css` is defined twice.
 *
 * next-themes writes the resolved class onto <html> from a blocking inline
 * script, so the first paint is already the right theme — which is what
 * `suppressHydrationWarning` on <html> in the root layout is for.
 *
 * `disableTransitionOnChange` suppresses transitions for the frame in which the
 * class flips. Without it every colour transition in the tree fires at once on
 * toggle, which reads as a smear rather than as a switch.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
