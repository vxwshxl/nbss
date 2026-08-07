import type { Metadata } from "next";
import Link from "next/link";

import { CtaBand, Eyebrow, PageHead, Shot } from "@/components/blocks";
import { galleryCategories, photosIn } from "@/content/gallery";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: canonical("/gallery"),
  title: "Gallery — operations, training and the region we come from",
  description:
    "Photographs from NBSS operations and from Bodoland, the region that supplies our people.",
};

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
      <PageHead
        kicker="◆"
        sub="Gallery"
        crumb="Gallery"
        title="Our parades, our training, our postings."
        lede="Photographs from NBSS parades, training sessions and live deployments, alongside the Bodoland the agency comes from — the Aronai, Bwisagu, Manas, and the districts we recruit in."
      />

      <section className="section section--gallery">
        <div className="wrap">
          {/* Each filter is a real URL, so a filtered view can be linked and shared. */}
          <div className="chips" role="tablist" aria-label="Filter photographs">
            {galleryCategories.map((c) => (
              <Link
                key={c.slug}
                className={`chip${active === c.slug ? " is-on" : ""}`}
                role="tab"
                aria-selected={active === c.slug}
                href={c.slug === "all" ? "/gallery" : `/gallery?cat=${c.slug}`}
                scroll={false}
              >
                {c.label}
              </Link>
            ))}
          </div>

          <p className="gallery__count">
            {photos.length} photograph{photos.length === 1 ? "" : "s"}
          </p>

          <div className="mosaic">
            {photos.map((p, i) => (
              <Shot key={p.src} photo={p} index={i} sizes="(max-width: 700px) 100vw, 30vw" />
            ))}
          </div>
        </div>
      </section>

      <section className="section section--alt">
        <div className="wrap narrow">
          <header className="sec-head">
            <Eyebrow num="◆" text="Credits" />
            <h2 className="sec-h">On the photographs.</h2>
            <p className="sec-lede">
              Photographs credited to National Bodo Security Service are our own — our guards, our
              parades, our postings. The remaining images are used under a Creative Commons licence
              or are public domain, and the photographer and licence are printed under each frame.
              Cultural photographs of Bodoland are included because the region is the point, not
              decoration.
            </p>
          </header>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
