import type { Metadata } from "next";
import { Clock3, MapPin, Phone } from "lucide-react";

import { Eyebrow, Panel, TickList } from "@/components/marketing/blocks";
import { CoverageBand } from "@/components/marketing/coverage-band";
import { FaqBand } from "@/components/marketing/faq-band";
import { PageHead } from "@/components/marketing/page-head";
import { Reveal } from "@/components/marketing/reveal";
import { Section, SectionHead } from "@/components/marketing/section";
import { EnquiryForm } from "@/components/forms/EnquiryForm";
import { QuoteForm } from "@/components/forms/QuoteForm";
import { faqs, site, tel } from "@/content/site";
import { pageMetadata } from "@/lib/seo/page-metadata";
import {
  breadcrumbStructuredData,
  faqStructuredData,
  jsonLd,
} from "@/lib/seo/structured-data";

export const metadata: Metadata = pageMetadata({
  title: "Book guards — Kokrajhar, Bodoland Territorial Region",
  description:
    "Book trained, police-verified security guards for your site. Tell the deployment desk the district, the site type and the headcount, and a field officer surveys the site before any number is quoted.",
  path: "/contact",
  keywords: [
    "book security guards Kokrajhar",
    "hire security guards Assam",
    "security guard booking Bodoland",
    "security agency quotation Assam",
  ],
});

/** How the desk can be reached, as three facts rather than three paragraphs. */
const CHANNELS = [
  {
    icon: Phone,
    title: "Deployment desk",
    body: "Bookings, quotations, site visits, live contracts and complaints.",
  },
  {
    icon: MapPin,
    title: site.address.label,
    body: site.address.lines.join(", "),
  },
  {
    icon: Clock3,
    title: "Hours",
    body: site.hours.join(" · "),
  },
];

export default function ContactPage() {
  return (
    <>
      {/* The FAQ markup is valid here because the same answers are rendered on
          this page — Google drops the rich result when the markup describes
          questions the visitor cannot actually see. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(faqStructuredData(faqs))}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbStructuredData([
            { name: "Home", path: "/" },
            { name: "Book guards", path: "/contact" },
          ]),
        )}
      />

      <PageHead
        eyebrow="Book guards"
        crumb="Book guards"
        title="Tell us what needs guarding."
        lede="Where the site is, what it is, and roughly how many guards you have in mind. If you are not sure about the number, say so — working that out is what the survey is for."
      />

      <Section>
        <div className="grid gap-4 sm:grid-cols-3">
          {CHANNELS.map((channel, i) => {
            const Icon = channel.icon;
            const isPhone = i === 0;
            return (
              <Reveal key={channel.title} delay={i * 70}>
                <Panel tone={isPhone ? "accent" : "plain"} className="h-full">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <Icon className="size-5" strokeWidth={1.9} />
                  </span>
                  <h2 className="mt-4 font-display text-base font-bold tracking-tight">
                    {channel.title}
                  </h2>
                  {isPhone ? (
                    <a
                      href={`tel:${tel(site.phone)}`}
                      className="mt-1.5 block font-display text-2xl font-bold tracking-tight transition-colors hover:text-primary"
                    >
                      {site.phone}
                    </a>
                  ) : null}
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {channel.body}
                  </p>
                  {i === 1 && (
                    <a
                      href={site.address.mapUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
                    >
                      Open in maps
                    </a>
                  )}
                </Panel>
              </Reveal>
            );
          })}
        </div>
      </Section>

      <Section alt id="quote">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-start">
          <Reveal>
            <Eyebrow num="01" text="Request a booking" />
            <h2 className="mt-4 font-display text-[clamp(1.6rem,3.5vw,2.25rem)] leading-tight font-bold tracking-tight text-balance">
              Four details, then a field officer calls.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              Give us the district, the site type and roughly how many people you have in
              mind. If you are not sure about the headcount, leave it blank — working that
              out is what the site visit is for.
            </p>
            <TickList
              className="mt-7"
              items={[
                "A site visit before any number is quoted",
                "Wage, statutory heads and service charge shown separately",
                "Police-verified, trained and uniformed personnel",
                "A client login, so you can see who is on your gate",
                "No obligation, and we will say so if you do not need us",
              ]}
            />
          </Reveal>

          <Reveal delay={80}>
            <QuoteForm boxed />
          </Reveal>
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-start">
          <Reveal>
            <EnquiryForm />
          </Reveal>

          <Reveal delay={80}>
            <Eyebrow num="02" text="General enquiry" />
            <h2 className="mt-4 font-display text-[clamp(1.6rem,3.5vw,2.25rem)] leading-tight font-bold tracking-tight text-balance">
              Something else on your mind?
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              Compliance documents, a tender query, a complaint about one of our guards, a
              request to see our registration papers — this form reaches the same desk, and
              a complaint reaches it faster.
            </p>
            <ul className="mt-6 flex flex-col gap-2.5">
              {site.hours.map((h) => (
                <li key={h} className="flex items-start gap-2.5 text-sm">
                  <Clock3
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    strokeWidth={1.9}
                  />
                  {h}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Section>

      <Section alt>
        <SectionHead
          num="03"
          kicker="Before you ask"
          title="The questions we get first."
          className="text-center [&>div]:justify-center [&_p]:mx-auto"
        />
        <FaqBand faqs={faqs} />
      </Section>

      <CoverageBand />
    </>
  );
}
