import type { Metadata, Viewport } from "next";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { site, tel } from "@/content/site";
import { absoluteUrl, baseUrl, canonical } from "@/lib/seo";

import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  alternates: canonical("/"),
  title: {
    default: `${site.shortName} — Security, Facility & Manpower Services in Bodoland`,
    template: `%s — ${site.shortName}`,
  },
  description: site.descriptor,
  applicationName: site.name,
  authors: [{ name: site.name }],
  keywords: [
    "security agency Kokrajhar",
    "PSARA licensed security Assam",
    "Bodoland security services",
    "facility management Assam",
    "manpower staffing Kokrajhar",
    "security guards BTR",
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
      image: absoluteUrl("/img/hero-guard.jpg"),
      foundingDate: String(site.founded),
      telephone: site.phone,
      email: site.email,
      priceRange: "₹₹",
      currenciesAccepted: "INR",
      address: {
        "@type": "PostalAddress",
        streetAddress: `${site.address.line1}, ${site.address.line2}`,
        addressLocality: site.address.city,
        addressRegion: "Assam",
        postalCode: site.address.pin,
        addressCountry: "IN",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: site.address.lat,
        longitude: site.address.lng,
      },
      hasMap: site.address.mapUrl,
      areaServed: [
        { "@type": "AdministrativeArea", name: "Bodoland Territorial Region, Assam" },
        { "@type": "AdministrativeArea", name: "Lower Assam" },
      ],
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "Control room",
          telephone: tel(site.emergency),
          availableLanguage: ["en", "as", "brx", "hi"],
          hoursAvailable: {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ],
            opens: "00:00",
            closes: "23:59",
          },
        },
        {
          "@type": "ContactPoint",
          contactType: "Sales",
          telephone: tel(site.phone),
          email: site.email,
        },
        {
          "@type": "ContactPoint",
          contactType: "Human resources",
          email: site.emailHr,
        },
      ],
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
          opens: "09:30",
          closes: "18:00",
        },
      ],
      hasCredential: site.licenses.map((l) => ({
        "@type": "EducationalOccupationalCredential",
        credentialCategory: l.label,
        identifier: l.number,
        recognizedBy: { "@type": "Organization", name: l.body },
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
