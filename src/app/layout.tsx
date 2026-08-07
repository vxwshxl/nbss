import type { Metadata, Viewport } from "next";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
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
  icons: { icon: "/img/favicon.svg" },
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
  themeColor: "#0A100D",
  colorScheme: "dark",
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
      logo: absoluteUrl("/img/favicon.svg"),
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
          opens: "09:00",
          closes: "18:00",
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
    <html lang="en-IN" data-theme="dark">
      {/* Browser extensions inject attributes onto <body> before React hydrates
          (Bitdefender's `bis_register`, password managers, etc). Suppressing here
          covers only this element's attributes, not any subtree content. */}
      <body suppressHydrationWarning>
        <a className="skip-link" href="#main">
          Skip to content
        </a>

        <Header />
        <main id="main">{children}</main>
        <Footer />

        <div className="grain" aria-hidden="true" />

        <script
          type="application/ld+json"
          // Static, hand-authored object — no user input reaches this string.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
