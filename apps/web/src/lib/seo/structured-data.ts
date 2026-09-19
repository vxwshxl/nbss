/**
 * The agency's search identity, in one place.
 *
 * Search engines and answer engines (Google AI Overviews, ChatGPT, Perplexity,
 * Gemini) resolve a query to an *entity* before they rank anything. Prose on a
 * page is a weak signal for that; a linked JSON-LD graph is a strong one. So
 * every name this company is known by, where it operates, and what it actually
 * supplies are declared once here and emitted as a single `@graph` with
 * cross-referenced `@id`s.
 *
 * Why one graph and not several <script> tags: the `@id` references are what
 * tell a crawler that the LocalBusiness, the WebSite and the service catalogue
 * are facets of ONE entity. Disconnected blobs make weak entities that compete
 * with each other.
 *
 * GEO note — the geography here is doing real work. "Security agency in
 * Kokrajhar" is a local query, and a local query is answered from `areaServed`,
 * `geo` and `address` far more than from body copy. Every district the agency
 * actually covers is named, because a district that is not named is a district
 * this site cannot be the answer for.
 */

import { site, tel } from "@/content/site";
import { services } from "@/content/services";
import { baseUrl, absoluteUrl } from "@/lib/seo";

export const ORG_ID = `${baseUrl}/#organization`;
export const SITE_ID = `${baseUrl}/#website`;

/**
 * Every way a real person types this company into a search box.
 *
 * `alternateName` is the supported mechanism for telling Google that distinct
 * strings denote one entity. It matters more than usual here: the company's
 * registered name is singular ("Service") while almost everyone writes it
 * plural ("Services"), and the abbreviation is what is painted on the vehicles.
 * Without this, those are three unrelated tokens competing for the same brand.
 */
export const BRAND_ALTERNATE_NAMES = [
  "NBSS",
  "National Bodo Security Service",
  "National Bodo Security Services",
  "NBSS Kokrajhar",
  "National Bodo Security Kokrajhar",
  "National Bodo Security Service Kokrajhar",
  "Bodo Security Service",
  "NBSS security agency",
];

/**
 * The districts of the Bodoland Territorial Region, plus the lower-Assam
 * districts the agency's profile says it deploys into. Named individually
 * rather than rolled up into "Assam": a query is "security guard agency in
 * Chirang", and `areaServed: Assam` does not answer it.
 */
export const AREAS_SERVED = [
  "Kokrajhar",
  "Chirang",
  "Baksa",
  "Udalguri",
  "Tamulpur",
  "Bongaigaon",
  "Dhubri",
  "Goalpara",
  "Bodoland Territorial Region",
  "Lower Assam",
];

/**
 * What the agency supplies, as discrete claims. Answer engines quote lists like
 * this close to verbatim when asked "what does X do", so each entry is written
 * to stand on its own rather than to read well in sequence.
 */
export const SERVICE_LIST = services.map((s) => s.name);

const DESCRIPTION =
  `${site.name} (NBSS) is a private security agency headquartered in Kokrajhar, ` +
  `Bodoland Territorial Region, Assam. It supplies trained, police-verified security ` +
  `personnel — guards, supervisors, gunmen, bouncers and housekeeping staff — to ` +
  `schools and colleges, hospitals, government offices, banks and ATMs, hotels, retail ` +
  `and malls, industrial plants and warehouses, construction and residential sites, and ` +
  `events, across the BTR and lower Assam.`;

/** E.164, as schema.org expects — not the human-readable spacing. */
const e164 = (n: string) => tel(n);

/**
 * The whole graph for the public site.
 *
 * `SecurityService` is a real schema.org LocalBusiness subtype, and using it
 * rather than a bare `Organization` is what lets this entity be eligible for a
 * local pack at all. `openingHoursSpecification` is stated because the single
 * most common question asked of a local business listing is whether it is open,
 * and the answer for this one is two different things — an office window and a
 * deployment desk that never closes.
 *
 * Deliberately absent: `aggregateRating`. Google renders review stars verbatim
 * and inventing them is a policy violation with a manual-action attached. It
 * goes in when there are real, collected reviews to point at.
 *
 * Also deliberately absent: any licence number. The client's profile does not
 * state a PSARA licence, and a security agency asserting one it does not hold
 * in machine-readable markup is a legal problem, not a copy problem.
 */
export function siteStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["SecurityService", "LocalBusiness", "Organization"],
        "@id": ORG_ID,
        name: site.name,
        alternateName: BRAND_ALTERNATE_NAMES,
        url: baseUrl,
        description: DESCRIPTION,
        slogan: site.tagline,
        telephone: e164(site.phone),
        image: absoluteUrl("/og.png"),
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl("/logo/nbss-512.png"),
          width: 512,
          height: 512,
        },
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
        areaServed: AREAS_SERVED.map((name) => ({
          "@type": "AdministrativeArea",
          name,
        })),
        sameAs: site.social.map((s) => s.url),
        openingHoursSpecification: [
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ],
            opens: "09:00",
            closes: "18:00",
            description: "Office and enquiries",
          },
          {
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
            description: "Supervision and deployment desk",
          },
        ],
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "sales",
            telephone: e164(site.phone),
            areaServed: "IN",
            availableLanguage: ["en", "as", "brx", "hi", "bn"],
            hoursAvailable: {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
              opens: "09:00",
              closes: "18:00",
            },
          },
          {
            "@type": "ContactPoint",
            contactType: "emergency",
            telephone: e164(site.phone),
            areaServed: "IN",
            availableLanguage: ["en", "as", "brx", "hi", "bn"],
            description: "Supervision and deployment desk, 24 × 7",
          },
        ],
        // The catalogue, linked from the entity rather than listed loose. This
        // is what makes "does NBSS guard hospitals" a question the graph can
        // answer without a crawler having to read nine pages of prose.
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Security and manpower services",
          itemListElement: services.map((s) => ({
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: s.name,
              description: s.summary,
              serviceType: s.name,
              url: absoluteUrl(`/services/${s.slug}`),
              provider: { "@id": ORG_ID },
              areaServed: AREAS_SERVED.map((name) => ({
                "@type": "AdministrativeArea",
                name,
              })),
            },
          })),
        },
        knowsLanguage: ["en", "as", "brx", "hi", "bn"],
      },
      {
        "@type": "WebSite",
        "@id": SITE_ID,
        url: baseUrl,
        name: site.name,
        alternateName: BRAND_ALTERNATE_NAMES,
        description: DESCRIPTION,
        inLanguage: "en-IN",
        publisher: { "@id": ORG_ID },
        about: { "@id": ORG_ID },
      },
    ],
  };
}

/** A breadcrumb trail, so search shows the path rather than a bare URL. */
export function breadcrumbStructuredData(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/**
 * One service page's own entity, linked back to the agency.
 *
 * Emitted per page rather than only in the site graph because a service page is
 * what should rank for "hospital security agency Kokrajhar", and it can only do
 * that if it declares itself as that service rather than relying on being
 * mentioned inside its parent's catalogue.
 */
export function serviceStructuredData(slug: string) {
  const service = services.find((s) => s.slug === slug);
  if (!service) return null;
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.summary,
    serviceType: service.name,
    url: absoluteUrl(`/services/${slug}`),
    provider: { "@id": ORG_ID },
    areaServed: AREAS_SERVED.map((name) => ({ "@type": "AdministrativeArea", name })),
    audience: { "@type": "BusinessAudience", name: service.name },
  };
}

/**
 * A question-and-answer block.
 *
 * The highest-leverage markup on the site for answer engines specifically: an
 * `FAQPage` is a pre-chunked question/answer pair, which is the exact shape a
 * retrieval step wants and the exact shape an AI Overview quotes. Each answer
 * is written to be liftable on its own, without the question restating it.
 */
export function faqStructuredData(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

/** Serialises a graph for a `<script type="application/ld+json">` tag. */
export function jsonLd(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data) };
}
