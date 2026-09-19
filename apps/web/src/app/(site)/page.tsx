import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CoverageBand } from "@/components/marketing/coverage-band";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqBand } from "@/components/marketing/faq-band";
import { Hero } from "@/components/marketing/hero";
import { PhotoStrip } from "@/components/marketing/photo-strip";
import { PillarGrid } from "@/components/marketing/pillar-grid";
import { Section, SectionHead } from "@/components/marketing/section";
import { ServiceBento } from "@/components/marketing/service-bento";
import { StatBand } from "@/components/marketing/stat-band";
import { Button } from "@/components/ui/button";
import { ownPhotos } from "@/content/gallery";
import { featuredServices, services } from "@/content/services";
import { faqs } from "@/content/site";
import { faqStructuredData, jsonLd, siteStructuredData } from "@/lib/seo/structured-data";

/**
 * The home page.
 *
 * Server component throughout — the copy, the structured data and the whole
 * service grid are static, so they render once on the server and ship as HTML.
 * Only the pieces that genuinely need the client are client components: the
 * hero's scroll choreography, the counters, the reveals and the FAQ chevron.
 * The page is fully readable before any of them hydrate, which matters on the
 * connection most of its readers are on.
 *
 * The two JSON-LD blocks live here rather than in the root layout. In the
 * layout they were emitted on all twenty-four routes, including the console —
 * twenty-four competing assertions of one entity, which is precisely how an
 * entity ends up weak. Here there is one.
 */
export default function HomePage() {
  const peek = ownPhotos().slice(0, 6);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(siteStructuredData())}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(faqStructuredData(faqs))}
      />

      <Hero />
      <StatBand />

      <Section alt id="services">
        <SectionHead
          num="01"
          kicker="What we do"
          title="We provide security personnel. That is the whole business."
          lede="Trained, uniformed and police-verified guards, posted where you need them and supervised after they get there. These are the sites we are asked for most often."
          action={
            <Button asChild variant="outline">
              <Link href="/services">
                All {services.length} services
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          }
        />
        <ServiceBento services={featuredServices()} />
      </Section>

      <Section id="why">
        <SectionHead
          num="02"
          kicker="Why choose us"
          title="Six reasons clients stay with us."
          lede="Any agency can print a uniform. These are the parts that take work — which is exactly why they are the ones worth asking us about."
        />
        <PillarGrid />
      </Section>

      <Section alt id="training">
        <SectionHead
          num="03"
          kicker="On the ground"
          title="Parade is where the discipline shows."
          lede="Turnout, drill and bearing are not ceremony. A guard who stands a parade properly stands a gate properly, and the morning inspection is where a supervisor catches the uniform, the identity card and the attitude before a client does."
          action={
            <Button asChild variant="outline">
              <Link href="/training">
                How we train
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          }
        />
        <PhotoStrip photos={peek} />
      </Section>

      <CoverageBand />

      {/* The FAQ is placed last on purpose. It is the block an answer engine
          quotes and the block a procurement officer scrolls to, and neither of
          them arrives at it by accident — but a visitor reading top to bottom
          should meet the argument before the objections. */}
      <Section alt id="faq">
        <SectionHead
          num="05"
          kicker="Common questions"
          title="What clients ask before they sign."
          lede="If your question is not here, the deployment desk answers the phone."
          className="text-center [&>div]:justify-center [&_p]:mx-auto"
        />
        <FaqBand faqs={faqs} />
      </Section>

      <CtaBand />
    </>
  );
}
