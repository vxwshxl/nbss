import type { Metadata, Viewport } from "next";

import { SuppressExtensionWarnings } from "@/components/suppress-extension-warnings";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { site } from "@/content/site";
import { baseUrl, canonical } from "@/lib/seo";
import { INDEXABLE } from "@/lib/seo/page-metadata";
import { BRAND_ALTERNATE_NAMES } from "@/lib/seo/structured-data";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  alternates: canonical("/"),
  title: {
    default: `${site.shortName} — Security Agency in Kokrajhar, Assam`,
    template: `%s · ${site.name}`,
  },
  description: site.descriptor,
  applicationName: site.name,
  authors: [{ name: site.name }],
  /**
   * Branded spellings first — those are the queries this site can realistically
   * own, and the singular/plural split in the company's own name means they
   * have to be enumerated rather than assumed. The category terms follow, each
   * one paired with a place, because "security agency" alone is a national
   * query this business is not competing in and "security agency Kokrajhar" is
   * one it should win outright.
   */
  keywords: [
    ...BRAND_ALTERNATE_NAMES,
    "security agency Kokrajhar",
    "security guard agency Assam",
    "security services Bodoland",
    "security agency BTR",
    "security guard supply Kokrajhar",
    "bank security guard Assam",
    "hospital security agency Assam",
    "event security Kokrajhar",
    "housekeeping manpower Kokrajhar",
    "bouncer service Assam",
  ],
  category: "Security services",
  creator: site.name,
  publisher: site.name,
  // The site publishes phone numbers as explicit tel: links; letting Safari
  // also autolink bare digits wraps them in unstyled anchors.
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: "website",
    url: "/",
    siteName: site.name,
    title: `${site.shortName} — ${site.tagline}`,
    description: site.descriptor,
    locale: "en_IN",
    // Images come from the `opengraph-image` route convention, which stamps the
    // correct absolute URL and dimensions on every page automatically.
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.shortName} — ${site.tagline}`,
    description: site.descriptor,
  },
  // Generated from the client's badge (public/logo/NBSS.png). The .ico carries
  // 16/32/48 because browsers still hit /favicon.ico directly, ignoring these
  // tags; the PNGs cover tabs, Android home screens and iOS.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon.ico"],
  },
  manifest: "/manifest.webmanifest",
  robots: INDEXABLE,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Shrinks the layout viewport (and `dvh`) when the on-screen keyboard opens,
  // so a centred dialog repositions above the keyboard instead of hiding behind
  // it. That matters most on the one screen that is always used on a phone: a
  // guard punching in at a gate.
  interactiveWidget: "resizes-content",
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1f1f" },
  ],
  colorScheme: "light dark",
};

/**
 * The shell every page sits in.
 *
 * Three providers, and each one is here rather than in a sub-layout for a
 * specific reason. The theme has to wrap the whole document or the marketing
 * pages and the console would resolve it separately and disagree for a frame.
 * One `TooltipProvider` shares the delay-skip window, so moving between
 * tooltips anywhere in a toolbar stays instant instead of re-waiting 700ms per
 * target. And the `Toaster` is mounted once at the root because a toast raised
 * by a server action during a route transition must outlive the route that
 * raised it.
 *
 * No JSON-LD here. It used to live in this file, which meant every page — a
 * careers listing, a legal page, the console — carried the full business graph.
 * It now sits on the pages that are actually the entity (see
 * `lib/seo/structured-data`), so there is one assertion of it rather than
 * twenty-four competing ones.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className="h-full antialiased" suppressHydrationWarning>
      {/* Browser extensions inject attributes onto <body> before React hydrates
          (Bitdefender's `bis_register`, password managers, and so on).
          Suppressing here covers only this element's own attributes, not any
          subtree content. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <SuppressExtensionWarnings />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-lg focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-background"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <TooltipProvider>
            {children}
            {/* Top-centre rather than a corner: on a phone at a gate the
                bottom of the screen is under a thumb and the corners are where
                the OS puts its own chrome. */}
            <Toaster position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
