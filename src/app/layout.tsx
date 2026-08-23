import type { Metadata, Viewport } from "next";

import { themeScript } from "@/components/ThemeToggle";
import { extensionNoiseScript } from "@/lib/extension-noise";
import { coverage, site, tel } from "@/content/site";
import { absoluteUrl, baseUrl, canonical } from "@/lib/seo";

import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  alternates: canonical("/"),
  title: {
    default: `${site.shortName} — Security Services in Kokrajhar, Assam`,
    template: `%s — ${site.shortName}`,
  },
  description: site.descriptor,
  applicationName: site.name,
  authors: [{ name: site.name }],
  keywords: [
    "security agency Kokrajhar",
    "security guards Assam",
    "Bodoland security service",
    "security agency BTC",
    "security guard supply Kokrajhar",
    "National Bodo Security Service",
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
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Without these Google may clip the thumbnail and snippet on the local
      // pack listings this site is actually competing for.
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  /* Geist's two grounds: white paper, true black. The browser chrome follows
     whichever the reader's system asks for, which is the same switch the
     stylesheet's `prefers-color-scheme` block reads. */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  colorScheme: "light dark",
};

/**
 * schema.org data so search engines resolve the agency to its real location.
 *
 * Two nodes joined by @id: the LocalBusiness that Google Business Profile and
 * the local pack read, and the WebSite that carries the search action. Every
 * value below is drawn from `site` — nothing is asserted here that the pages
 * themselves do not also state, and the placeholder social links are left out
 * rather than published as dead `#` hrefs.
 */
const businessId = absoluteUrl("/#organisation");

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["SecurityService", "LocalBusiness"],
      "@id": businessId,
      name: site.name,
      alternateName: site.shortName,
      slogan: site.tagline,
      description: site.descriptor,
      url: absoluteUrl("/"),
      logo: absoluteUrl("/logo/nbss-512.png"),
      image: absoluteUrl("/img/nbss/parade-salute.jpg"),
      telephone: site.phone,
      priceRange: "₹₹",
      currenciesAccepted: "INR",
      address: {
        "@type": "PostalAddress",
        addressLocality: site.address.city,
        addressRegion: site.address.state,
        addressCountry: "IN",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: site.address.lat,
        longitude: site.address.lng,
      },
      hasMap: site.address.mapUrl,
      areaServed: coverage.map((d) => ({
        "@type": "AdministrativeArea",
        name: `${d.name}, Assam`,
      })),
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "Customer service",
          telephone: tel(site.phone),
          availableLanguage: ["en", "as", "brx", "hi"],
        },
      ],
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
          /* Schema.org wants ISO 8601, so these two stay 24-hour — they are
             read by crawlers, not by people. The +05:30 offset is what makes
             them IST rather than whatever zone the crawler assumes. */
          opens: "09:00:00+05:30",
          closes: "18:00:00+05:30",
        },
      ],
      // Compliance categories only — the client has supplied no registration
      // numbers, and `identifier` is not a field to guess at.
      hasCredential: site.compliance.map((c) => ({
        "@type": "EducationalOccupationalCredential",
        credentialCategory: c.label,
        recognizedBy: { "@type": "Organization", name: c.body },
      })),
    },
    {
      "@type": "WebSite",
      "@id": absoluteUrl("/#website"),
      url: absoluteUrl("/"),
      name: site.name,
      inLanguage: "en-IN",
      publisher: { "@id": businessId },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* The head script rewrites `data-theme` before React hydrates, so the
       attribute React rendered and the one it finds will differ for any reader
       who has chosen a theme. That is the intended behaviour, not a bug to
       report. */
    <html lang="en-IN" data-theme="system" suppressHydrationWarning>
      <head suppressHydrationWarning>
        {/* Both inline scripts carry `suppressHydrationWarning` because some
            extensions — Bitdefender most aggressively — do not merely add
            attributes to them, they rewrite the element: the inline body is
            emptied and replaced with a `src` pointing at the extension's own
            executor, which runs the original code after scanning it. React
            then compares an empty script against the one the server rendered
            and reports a mismatch nothing in the app can prevent.

            Suppressing is safe precisely here, and only here. These are static,
            hand-authored strings with no props and no reactive content, so
            there is no real mismatch the flag could be hiding — the elements
            are identical on every render by construction. */}

        {/* Applies a stored light/dark choice before the first paint. Anything
            later — an effect, a layout script — repaints, and the reader sees
            a white flash on every navigation. */}
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeScript }} />

        {/* Strips the attributes Bitdefender, Grammarly and friends inject
            during parse, so React does not hydrate against a DOM the server
            never rendered. Must stay in <head>: it has to be observing before
            the body is parsed. */}
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: extensionNoiseScript }} />
      </head>
      {/* Browser extensions inject attributes onto <body> before React hydrates
          (Bitdefender's `bis_register`, password managers, etc). Suppressing here
          covers only this element's attributes, not any subtree content. */}
      <body suppressHydrationWarning>
        <a className="skip-link" href="#main">
          Skip to content
        </a>

        {children}


        <script
          suppressHydrationWarning
          type="application/ld+json"
          // Static, hand-authored object — no user input reaches this string.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
