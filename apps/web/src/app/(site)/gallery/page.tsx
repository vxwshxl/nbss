import type { Metadata } from "next";
import Link from "next/link";

import { CtaBand } from "@/components/marketing/cta-band";
import { GalleryMosaic } from "@/components/marketing/gallery";
import { PageHead } from "@/components/marketing/page-head";
import { Section, SectionHead } from "@/components/marketing/section";
import { galleryCategories, photosIn } from "@/content/gallery";
import { cn } from "@/lib/utils";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { breadcrumbStructuredData, jsonLd } from "@/lib/seo/structured-data";

export const metadata: Metadata = pageMetadata({
  title: "Gallery — operations, training and the region we come from",
  description:
    "Photographs from NBSS parades, training sessions and live deployments in Kokrajhar, alongside the Bodoland the agency recruits from.",
  path: "/gallery",
});

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat } = await searchParams;
  const active = galleryCategories.some((c) => c.slug === cat) ? cat! : "all";
  const photos = photosIn(active);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbStructuredData([
            { name: "Home", path: "/" },
            { name: "Gallery", path: "/gallery" },
          ]),
        )}
      />

      <PageHead
        eyebrow="Gallery"
        crumb="Gallery"
        title="Our parades, our training, our postings."
        lede="Photographs from NBSS parades, training sessions and live deployments, alongside the Bodoland the agency comes from — the Aronai, Bwisagu, Manas, and the districts we recruit in."
      />

      <Section>
        {/* Each filter is a real URL, so a filtered view can be linked and
            shared — which is the whole reason these are links and not state. */}
        <div
          role="tablist"
          aria-label="Filter photographs"
          className="mb-6 flex flex-wrap items-center gap-2"
        >
          {galleryCategories.map((category) => {
            const on = active === category.slug;
            return (
              <Link
                key={category.slug}
                role="tab"
                aria-selected={on}
                href={category.slug === "all" ? "/gallery" : `/gallery?cat=${category.slug}`}
                scroll={false}
                className={cn(
                  "press rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                  on
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-app-line bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {category.label}
              </Link>
            );
          })}

          <p className="ml-auto text-sm tabular-nums text-muted-foreground">
            {photos.length} photograph{photos.length === 1 ? "" : "s"}
          </p>
        </div>

        {/* The grid and its full-view lightbox — the one interactive island on
            an otherwise static page. */}
        <GalleryMosaic
          photos={photos}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
      </Section>

      <Section alt>
        <SectionHead
          num="◆"
          kicker="Credits"
          title="On the photographs."
          lede="Photographs credited to National Bodo Security Service are our own — our guards, our parades, our postings. The remaining images are used under a Creative Commons licence or are public domain, and the photographer and licence are printed under each frame. Cultural photographs of Bodoland are included because the region is the point, not decoration."
          className="mx-auto max-w-3xl text-center [&>div]:justify-center [&_p]:mx-auto"
        />
      </Section>

      <CtaBand />
    </>
  );
}
