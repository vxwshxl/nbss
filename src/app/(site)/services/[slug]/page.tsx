import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Phone } from "lucide-react";

import { CtaBand } from "@/components/marketing/cta-band";
import { Eyebrow, Panel, TickList } from "@/components/marketing/blocks";
import { PageHead } from "@/components/marketing/page-head";
import { Section, SectionHead } from "@/components/marketing/section";
import { ServiceBento } from "@/components/marketing/service-bento";
import { QuoteForm } from "@/components/forms/QuoteForm";
import { Button } from "@/components/ui/button";
import { relatedServices, serviceBySlug, services } from "@/content/services";
import { site, tel } from "@/content/site";
import { pageMetadata } from "@/lib/seo/page-metadata";
import {
  breadcrumbStructuredData,
  jsonLd,
  serviceStructuredData,
} from "@/lib/seo/structured-data";

type Params = { params: Promise<{ slug: string }> };

/** Every detail page is prerendered at build time. */
export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  if (!service) return {};

  return pageMetadata({
    title: service.name,
    description: service.summary,
    path: `/services/${service.slug}`,
    // The one case where a page overrides the generated card: a service page
    // shared into a WhatsApp group should preview as the site it describes,
    // not as the agency's generic banner.
    image: {
      url: service.image,
      width: 1200,
      height: 630,
      alt: `${service.name} — ${site.name}`,
    },
    keywords: [
      `${service.name} Kokrajhar`,
      `${service.name} Assam`,
      `${service.name} Bodoland`,
      "security agency Kokrajhar",
    ],
  });
}

/** Included on every contract, whatever the posting. */
const ALWAYS_INCLUDED = [
  "Police-verified personnel",
  "Training completed before posting",
  "Uniformed and disciplined staff",
  "24 × 7 monitoring and supervision",
  "Quick replacement and backup support",
  "ESI and EPF facility as applicable",
];

export default async function ServiceDetailPage({ params }: Params) {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  if (!service) notFound();

  const related = relatedServices(service, 3);
  const graph = serviceStructuredData(slug);

  return (
    <>
      {/* The page declares itself as this service rather than relying on being
          mentioned inside the agency's catalogue — which is what lets it rank
          for "hospital security agency Kokrajhar" on its own. */}
      {graph && (
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(graph)} />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbStructuredData([
            { name: "Home", path: "/" },
            { name: "Services", path: "/services" },
            { name: service.name, path: `/services/${service.slug}` },
          ]),
        )}
      />

      <PageHead
        eyebrow="Security services"
        crumb={service.name}
        title={service.name}
        lede={service.summary}
        image={service.image}
        action={
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-11 px-5">
              <Link href="#quote">Get a quote for this</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 border-background/25 bg-background/8 px-5 text-background backdrop-blur-sm hover:bg-background/15 hover:text-background"
            >
              <a href={`tel:${tel(site.phone)}`}>
                <Phone data-icon="inline-start" />
                {site.phone}
              </a>
            </Button>
          </div>
        }
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold tracking-tight">
              What this posting actually involves
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {service.detail}
            </p>

            <h3 className="mt-10 mb-4 text-[11px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
              Scope of work
            </h3>
            <TickList items={service.scope} columns={2} />
          </div>

          <aside className="flex flex-col gap-4">
            <Panel title="Typically deployed at">
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                {service.fit.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </Panel>

            <Panel title="Included on every contract" tone="accent">
              <TickList items={ALWAYS_INCLUDED} />
            </Panel>

            <Panel>
              <p className="text-[11px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
                Talk to the deployment desk
              </p>
              <a
                href={`tel:${tel(site.phone)}`}
                className="mt-2 flex items-center gap-2 font-display text-xl font-bold tracking-tight transition-colors hover:text-primary"
              >
                <Phone className="size-4 text-primary" strokeWidth={2} />
                {site.phone}
              </a>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {site.hoursShort}. Supervision and deployment run 24 × 7.
              </p>
            </Panel>
          </aside>
        </div>
      </Section>

      <Section alt id="quote">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <Eyebrow num="◆" text="Costed for your site" className="justify-center" />
            <h2 className="mt-4 font-display text-[clamp(1.6rem,3.5vw,2.25rem)] leading-tight font-bold tracking-tight text-balance">
              Four details, then a field officer calls.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
              The service is already selected. Give us the district and the site type,
              and we will arrange the survey.
            </p>
          </div>
          <QuoteForm service={service.slug} />
        </div>
      </Section>

      {related.length > 0 && (
        <Section>
          <SectionHead
            num="◆"
            kicker="Other sites we guard"
            title="We post guards here too."
            action={
              <Button asChild variant="outline">
                <Link href="/services">
                  All {services.length} services
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            }
          />
          <ServiceBento services={related} />
        </Section>
      )}

      <CtaBand />
    </>
  );
}
