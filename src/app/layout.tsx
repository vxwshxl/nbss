import type { Metadata, Viewport } from "next";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { site } from "@/content/site";

import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"),
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
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.shortName} — ${site.tagline}`,
    description: site.descriptor,
    images: [{ url: "/img/hero-guard.jpg", width: 1500, height: 1000, alt: site.name }],
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.shortName} — ${site.tagline}`,
    description: site.descriptor,
    images: ["/img/hero-guard.jpg"],
  },
  icons: { icon: "/img/favicon.svg" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0A100D",
  colorScheme: "dark",
};

/** schema.org data so search engines resolve the agency to its real location. */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SecurityService",
  name: site.name,
  alternateName: site.shortName,
  description: site.descriptor,
  foundingDate: String(site.founded),
  telephone: site.phone,
  email: site.email,
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
  areaServed: "Bodoland Territorial Region, Assam, India",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" data-theme="dark">
      <body>
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
