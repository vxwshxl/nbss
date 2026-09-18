import type { Metadata } from "next";

import { site } from "@/content/site";

export const BRAND_SUFFIX = site.name;

/**
 * A note on the link-preview banner, since it is conspicuously absent here.
 *
 * It is not declared in metadata at all. `src/app/opengraph-image.tsx` is a
 * file-convention route, so Next renders a real 1200×630 card and emits
 * `og:image`, its width, its height and `twitter:image` for every route
 * automatically, always resolved against `metadataBase`. A hand-written
 * `openGraph.images` entry here would *override* that — and would be one more
 * absolute URL to keep in step with the deployment, which is exactly how a
 * preview ends up pointing at localhost.
 *
 * So `pageMetadata` sets the card's words and lets the convention supply its
 * picture. A page that genuinely needs a different image (a service page with
 * its own photograph) passes one; everything else inherits.
 */

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
  /** Overrides the generated card. Omit to inherit `opengraph-image.tsx`. */
  image?: { url: string; width: number; height: number; alt: string };
  keywords?: string[];
}): Metadata {
  const fullTitle = `${title} · ${BRAND_SUFFIX}`;
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
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      ...(image ? { images: [image.url] } : {}),
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
