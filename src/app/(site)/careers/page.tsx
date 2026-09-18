import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  IdCard,
  Layers,
  type LucideIcon,
  Radio,
  ShieldCheck,
  Sprout,
  Target,
  TriangleAlert,
} from "lucide-react";

import { Eyebrow } from "@/components/marketing/blocks";
import { CtaBand } from "@/components/marketing/cta-band";
import { PageHead } from "@/components/marketing/page-head";
import { Reveal } from "@/components/marketing/reveal";
import { Section, SectionHead } from "@/components/marketing/section";
import { StepList, type Step } from "@/components/marketing/step-list";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { vacancies } from "@/content/gallery";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { breadcrumbStructuredData, jsonLd } from "@/lib/seo/structured-data";

export const metadata: Metadata = pageMetadata({
  title: "Careers — join NBSS in Kokrajhar and the BTR districts",
  description:
    "Security guards, lady guards, supervisors and field officers in Kokrajhar, Chirang, Baksa and Udalguri. Freshers welcome — training is provided before your first posting, and we never charge a fee for a job.",
  path: "/careers",
  keywords: [
    "security guard jobs Kokrajhar",
    "security guard vacancy Assam",
    "security jobs Bodoland",
    "lady guard job Assam",
    "security supervisor job Kokrajhar",
  ],
});

const PERKS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Target,
    title: "Training provided",
    body: "Guarding duties, parade and fitness, fire safety, first aid, access control and crowd handling — taught before your first posting.",
  },
  {
    icon: ShieldCheck,
    title: "ESI & EPF as applicable",
    body: "Statutory benefits are extended to deployed personnel as applicable, and we help you with the paperwork rather than leaving you to it.",
  },
  {
    icon: IdCard,
    title: "Uniform and identity card",
    body: "Uniform, cap and photo identity card are issued to every guard. You do not turn up to a client site improvising.",
  },
  {
    icon: Sprout,
    title: "Posted near home",
    body: "We recruit locally and post locally wherever the deployment allows. Most of our people work in their own district.",
  },
  {
    icon: Layers,
    title: "A way up",
    body: "Guard to supervisor to field officer. Experience on a gate is the qualification that counts most here.",
  },
  {
    icon: Radio,
    title: "Real supervision",
    body: "You are not left alone on a site to work it out. Supervision runs 24 × 7 and there is someone to call.",
  },
];

const STEPS: Step[] = [
  {
    n: "01",
    title: "Apply online or walk in",
    body: `Use the form on any role page, or come to the Kokrajhar office between ${site.officeOpen} and ${site.officeClose} IST, Monday to Saturday.`,
  },
  {
    n: "02",
    title: "Interview and verification",
    body: "Bring Aadhaar and address proof. Police verification is completed before deployment — for every guard, without exception.",
  },
  {
    n: "03",
    title: "Training, then posting",
    body: "You are trained in the six areas every NBSS guard covers, then posted to a site with a briefing for that specific gate.",
  },
];

export default function CareersPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbStructuredData([
            { name: "Home", path: "/" },
            { name: "Careers", path: "/careers" },
          ]),
        )}
      />

      <PageHead
        eyebrow={`${vacancies.length} open positions`}
        crumb="Careers"
        title="Honest work, trained properly, supervised well."
        lede="We hire from Kokrajhar, Chirang, Baksa, Udalguri and the districts around them. Freshers are welcome — training is provided before your first posting."
        image="/img/nbss/parade-salute.jpg"
      />

      <Section>
        <SectionHead
          num="01"
          kicker="Vacancies"
          title="Roles we recruit for."
          lede="Openings vary by district and by season. Call the office to check what is live before you travel."
          action={
            <Button asChild variant="outline">
              <Link href="/training">
                How the training works
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vacancies.map((vacancy, i) => (
            <Reveal key={vacancy.id} delay={Math.min(i, 6) * 60}>
              <article className="group/job flex h-full flex-col rounded-2xl border border-app-line-soft bg-card p-6 shadow-card transition-shadow hover:shadow-raised">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg leading-snug font-bold tracking-tight">
                    {/* The whole card is the target via the stretched link, so
                        the heading carries the href rather than a second
                        "view" link competing with it for the same tap. */}
                    <Link
                      href={`/careers/${vacancy.id}`}
                      className="outline-none before:absolute before:inset-0 before:content-[''] focus-visible:underline"
                    >
                      {vacancy.title}
                    </Link>
                  </h3>
                  <StatusPill label={vacancy.type} tone="emerald" />
                </div>

                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {vacancy.summary}
                </p>

                <dl className="mt-5 flex flex-col gap-2 border-t border-app-line-soft pt-4 text-sm">
                  {[
                    ["Location", vacancy.location],
                    ["Experience", vacancy.experience],
                    ["Pay", vacancy.pay],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="text-right">{value}</dd>
                    </div>
                  ))}
                </dl>

                <span className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-semibold text-primary">
                  View &amp; apply
                  <ArrowRight
                    aria-hidden
                    className="size-3.5 transition-transform group-hover/job:translate-x-0.5 motion-reduce:transition-none"
                    strokeWidth={2.2}
                  />
                </span>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section alt>
        <SectionHead num="02" kicker="What you get" title="The terms, stated plainly." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PERKS.map((perk, i) => {
            const Icon = perk.icon;
            return (
              <Reveal key={perk.title} delay={Math.min(i, 6) * 60}>
                <article className="flex h-full flex-col rounded-2xl border border-app-line-soft bg-card p-6 shadow-card">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <Icon className="size-5" strokeWidth={1.9} />
                  </span>
                  <h3 className="mt-5 font-display text-lg leading-snug font-bold tracking-tight">
                    {perk.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {perk.body}
                  </p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <Reveal className="mb-10">
            <Eyebrow num="03" text="How to apply" />
            <h2 className="mt-4 font-display text-[clamp(1.6rem,3.5vw,2.25rem)] leading-tight font-bold tracking-tight text-balance">
              Three steps, and nobody asks you for money.
            </h2>
            {/* The loudest thing on this page, deliberately. Job-fee fraud in
                the name of a real agency is common enough in the region that
                this warning is worth more to a reader than any of the copy
                above it. */}
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-100/50 p-4 text-sm leading-relaxed">
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-amber-700"
                strokeWidth={2}
              />
              <p>
                NBSS never charges a fee for a job, for training, for a uniform or for a
                &ldquo;placement&rdquo;. If anyone asks you for money in our name, call{" "}
                <span className="font-semibold">{site.phone}</span> and tell us.
              </p>
            </div>
          </Reveal>
          <StepList steps={STEPS} />
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
