import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Mark } from "@/components/brand";
import { CoverageBand } from "@/components/marketing/coverage-band";
import { CtaBand } from "@/components/marketing/cta-band";
import { PageHead } from "@/components/marketing/page-head";
import { PillarGrid } from "@/components/marketing/pillar-grid";
import { Reveal } from "@/components/marketing/reveal";
import { Section, SectionHead } from "@/components/marketing/section";
import { StatBand } from "@/components/marketing/stat-band";
import { TickList } from "@/components/marketing/blocks";
import { Button } from "@/components/ui/button";
import { leadership, mission, site, vision } from "@/content/site";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { breadcrumbStructuredData, jsonLd } from "@/lib/seo/structured-data";

export const metadata: Metadata = pageMetadata({
  title: "About — a security agency run from Kokrajhar",
  description:
    "The company profile, vision and mission of National Bodo Security Service, the management behind it, and the registration and labour compliance it operates under.",
  path: "/about",
  keywords: [
    "National Bodo Security Service company profile",
    "security agency Kokrajhar about",
    "Bodoland security company",
  ],
});

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbStructuredData([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
        )}
      />

      <PageHead
        eyebrow="Company profile"
        crumb="About"
        title="Safety, protection and peace of mind."
        lede={site.descriptor}
        image="/img/nbss/parade-night.jpg"
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr] lg:items-start">
          <Reveal>
            <SectionHead
              num="01"
              kicker="Who we are"
              title="A regional agency, run from Kokrajhar."
              className="mb-6"
            />
            <div className="flex flex-col gap-4 text-base leading-relaxed text-muted-foreground">
              <p>
                We specialise in providing trained, disciplined and responsible security
                personnel to government departments, corporate offices, educational
                institutions, hospitals, industrial sectors, banks, hotels, residential
                complexes and commercial establishments.
              </p>
              <p>
                Kokrajhar is the administrative seat of the Bodoland Territorial Council,
                and it is where we recruit, train and run the business from. Our people
                come from the districts they are posted in. They know the roads, the
                languages and the neighbours — which is the difference between a guard
                watching a gate and a guard who knows who belongs at it.
              </p>
              <p>
                The name carries the region:{" "}
                <strong className="text-foreground">Bodo</strong> is the community, and the
                diamond in our shield is drawn from the <em>Aronai</em>, the woven scarf a
                Bodo household gives to honour a guest. It is a promise of hospitality and
                protection — a reasonable thing for a security company to put on its badge.
              </p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <figure>
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-app-line-soft bg-muted">
                <Image
                  src="/img/gallery/aronai.jpg"
                  alt="An Aronai, the traditional woven Bodo scarf, with its diamond motifs"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-3 text-xs leading-relaxed text-muted-foreground">
                The <em>Aronai</em> — the woven band our mark is drawn from.{" "}
                <span className="text-muted-foreground/70">
                  Wikimedia Commons, CC BY 4.0
                </span>
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </Section>

      <StatBand />

      <Section alt>
        <SectionHead num="02" kicker="What we hold to" title="Our vision and our mission." />
        <div className="grid gap-4 lg:grid-cols-2">
          <Reveal>
            <article className="flex h-full flex-col rounded-2xl border border-app-line-soft bg-card p-7 shadow-card">
              <h3 className="font-display text-xl font-bold tracking-tight">
                {vision.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                {vision.body}
              </p>
            </article>
          </Reveal>
          <Reveal delay={70}>
            <article className="flex h-full flex-col rounded-2xl border border-primary/25 bg-primary/5 p-7">
              <h3 className="font-display text-xl font-bold tracking-tight">
                {mission.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                {mission.body}
              </p>
              {mission.points && (
                <TickList items={[...mission.points]} className="mt-5" />
              )}
            </article>
          </Reveal>
        </div>
      </Section>

      <Section>
        <SectionHead num="03" kicker="Why choose us" title="The parts that take work." />
        <PillarGrid />
      </Section>

      <Section alt>
        <SectionHead
          num="04"
          kicker="Management"
          title="Who runs it."
          action={
            <Button asChild variant="outline">
              <Link href="/contact">
                Get in touch
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leadership.map((person, i) => (
            <Reveal key={person.name} delay={i * 70}>
              <article className="flex h-full flex-col rounded-2xl border border-app-line-soft bg-card p-6 shadow-card">
                <Mark size={44} />
                <h3 className="mt-5 font-display text-lg font-bold tracking-tight">
                  {person.name}
                </h3>
                <p className="mt-0.5 text-sm font-medium text-primary">{person.role}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {person.bio}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHead
          num="05"
          kicker="Legal compliance"
          title="Paperwork you can ask to see."
          lede="Registration and compliance documents are shared with the contract, or earlier on request. No registration numbers are printed here — a security agency publishing one it does not hold is a legal problem, not a copy problem."
          action={
            <Button asChild variant="outline">
              <Link href="/contact">
                Request copies
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {site.compliance.map((credential, i) => (
            <Reveal key={credential.label} delay={Math.min(i, 6) * 60}>
              <article className="flex h-full flex-col rounded-2xl border border-app-line-soft bg-card p-6 shadow-card">
                <h3 className="font-display text-base leading-snug font-bold tracking-tight">
                  {credential.label}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{credential.body}</p>
                <p className="mt-auto pt-4 text-xs text-muted-foreground/75">
                  {credential.note}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      <CoverageBand />
      <CtaBand />
    </>
  );
}
