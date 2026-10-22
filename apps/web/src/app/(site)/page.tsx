import { FaqSection } from "@/components/site/faq-section";
import { FilmSection } from "@/components/site/film-section";
import { GalleryReel } from "@/components/site/gallery-reel";
import { Hero } from "@/components/site/hero";
import { AerialSection, CtaSection, HelpSection, StatementSection, WhySection } from "@/components/site/sections";
import { SiteJourney } from "@/components/site/site-journey";
import { gallery } from "@/content/gallery";
import { faqs } from "@/content/site";
import { faqStructuredData, jsonLd, siteStructuredData } from "@/lib/seo/structured-data";

/**
 * The home page, told in scroll: the pinned opening, the parade film, the site photo
 * opening out, how a deployment comes together, what NBSS stands for, the gallery, how
 * NBSS can help, why NBSS, questions as a chat, and the close.
 *
 * The two JSON-LD blocks live here rather than in the root layout, so the site makes
 * one assertion of the organisation rather than one per route.
 */
export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(siteStructuredData())} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqStructuredData(faqs))} />

      <Hero />
      <FilmSection />
      <AerialSection />
      <SiteJourney />
      <StatementSection />
      <GalleryReel photos={gallery} />
      <HelpSection />
      <WhySection />
      <FaqSection />
      <CtaSection />
    </>
  );
}
