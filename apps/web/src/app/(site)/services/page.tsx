import type { Metadata } from "next";

import { CtaBand } from "@/components/marketing/cta-band";
import { PageHead } from "@/components/marketing/page-head";
import { Section, SectionHead } from "@/components/marketing/section";
import { ServiceBento } from "@/components/marketing/service-bento";
import { StepList, type Step } from "@/components/marketing/step-list";
import { services } from "@/content/services";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { breadcrumbStructuredData, jsonLd } from "@/lib/seo/structured-data";

export const metadata: Metadata = pageMetadata({
  title: "Services — trained security personnel for every kind of site",
  description: `Security guards supplied to ${services.length} kinds of site — schools, hospitals, government offices, banks and ATMs, hotels, retail, industry, construction and events — from Kokrajhar across the Bodoland Territorial Region and lower Assam.`,
  path: "/services",
  keywords: [
    "security guard services Kokrajhar",
    "security agency services Assam",
    ...services.map((s) => `${s.name} Assam`),
  ],
});

const STEPS: Step[] = [
  {
    n: "01",
    title: "You call or send the form",
    body: "Tell us the site, the shift pattern and roughly how many people you have in mind. A rough answer is fine — that is what the visit is for.",
  },
  {
    n: "02",
    title: "We come and look at the site",
    body: "Entries, blind spots, lighting, the rest facility and where the duty register will live. A number quoted without seeing the site is a guess.",
  },
  {
    n: "03",
    title: "A costed proposal, shown line by line",
    body: "Wage, the applicable statutory heads and the agency service charge set out separately. If a figure looks odd, ask — it will have a reason.",
  },
  {
    n: "04",
    title: "Deployment, then supervision",
    body: "Trained, verified and uniformed guards on site, with supervision running from day one rather than starting when something goes wrong.",
  },
];

export default function ServicesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbStructuredData([
            { name: "Home", path: "/" },
            { name: "Services", path: "/services" },
          ]),
        )}
      />

      <PageHead
        eyebrow={`${services.length} services`}
        crumb="Services"
        title="We provide security personnel for these sites."
        lede="One thing, done properly: trained, disciplined and police-verified guards, posted where you need them and supervised after they get there."
        image="/img/nbss/guards-on-duty.jpg"
      />

      <Section>
        <ServiceBento services={services} />
      </Section>

      <Section alt>
        <SectionHead
          num="◆"
          kicker="How a contract starts"
          title="Four steps, and a visit before any number."
          lede="Nobody is asked to sign anything before the site has been walked and the quotation has been read line by line."
        />
        <StepList steps={STEPS} />
      </Section>

      <CtaBand />
    </>
  );
}
