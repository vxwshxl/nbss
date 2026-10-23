import { FilmSection } from "@/components/site/film-section";
import { GalleryReel } from "@/components/site/gallery-reel";
import { Hero } from "@/components/site/hero";
import { AerialSection, CtaSection, HelpSection, StatementSection } from "@/components/site/sections";
import { SiteJourney } from "@/components/site/site-journey";
import { WhySection } from "@/components/site/why-section";
import { gallery } from "@/content/gallery";
import { jsonLd, siteStructuredData } from "@/lib/seo/structured-data";

/**
 * The home page, told in scroll: the pinned opening, the parade film, the site photo
 * opening out, how a deployment comes together, what NBSS stands for, the gallery, how
 * NBSS can help, why NBSS, questions as a chat, and the close.
 *
 * The organisation's JSON-LD lives here rather than in the root layout, so the site makes
 * one assertion of it rather than one per route. The FAQ's lives on /contact, with the list.
 */
export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(siteStructuredData())} />

      <Hero />
      <FilmSection />
      <AerialSection />
      <SiteJourney />
      <StatementSection />
      <GalleryReel photos={gallery} />
      <HelpSection />
      <WhySection />
      <CtaSection />
    </>
  );
}
