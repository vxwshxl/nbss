import type { Metadata } from "next";

import { site } from "@/content/site";

export const BRAND_SUFFIX = site.name;

/**
 * The link-preview banner, rendered by `src/app/og/route.tsx`.
 *
 * The URL is relative on purpose: Next resolves it against `metadataBase`, so
 * it always names the deployment that served the page and never localhost.
 * Every page sets it explicitly because Next merges `openGraph` shallowly — a
 * page that set its own `openGraph` without `images` would lose the banner.
 * A page that genuinely needs a different image passes one.
 */
export const OG_IMAGE = {
  url: "/og",
  width: 1200,
  height: 630,
  alt: `${site.name} (${site.shortName}) | ${site.tagline}`,
  type: "image/jpeg",
};

/**
 * Metadata for one indexable public page.
 *
 * Next merges `openGraph` and `twitter` shallowly *by key*, which is the trap
 * this function exists to close: a page that sets only `title` inherits the
 * root layout's `og:url` and `og:title`, so every shared link and every crawler
 * reads "the homepage" no matter which page was shared. Setting the full
 * objects here gives each page its own card, and the canonical is never
 * forgotten because it is not optional.
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
  keywords,
}: {
  title: string;
  description: string;
  path: string;
  /** Overrides the banner. Omit to use `/og`. */
  image?: { url: string; width: number; height: number; alt: string };
  keywords?: string[];
}): Metadata {
  const fullTitle = `${title} · ${BRAND_SUFFIX}`;
  const card = image ?? OG_IMAGE;
  return {
    title,
    description,
    keywords,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: BRAND_SUFFIX,
      title: fullTitle,
      description,
      url: path,
      locale: "en_IN",
      images: [card],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [{ url: card.url, alt: card.alt }],
    },
  };
}

/**
 * The crawl directives that let an answer engine actually quote a page.
 *
 * `max-snippet: -1` and `max-image-preview: large` are what permit Google to
 * quote a page at length in AI Overviews and show a full-width thumbnail.
 * Without them Google applies a short default snippet, which is the single most
 * common reason a well-marked-up page is passed over by an answer engine in
 * favour of a worse one that set these.
 */
export const INDEXABLE: NonNullable<Metadata["robots"]> = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-snippet": -1,
    "max-image-preview": "large",
    "max-video-preview": -1,
  },
};
