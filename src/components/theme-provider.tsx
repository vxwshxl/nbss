"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Light only.
 *
 * `forcedTheme` pins the class to "light" whatever the operating system or a
 * previously saved choice says, so a visitor whose phone is in dark mode still
 * gets the one palette this product is designed and contrast-checked against.
 *
 * The provider is kept rather than removed because Sonner reads the theme from
 * it — without it, toasts fall back to reading the OS and would be the one
 * dark-on-light element on a light page. If a second theme is ever wanted, this
 * is the single file that decides it: drop `forcedTheme`, restore
 * `defaultTheme="system"` and `enableSystem`, and define the `.dark` token
 * block in `globals.css` that was removed alongside this.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
