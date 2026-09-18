import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Eyebrow, TickList, VideoBand } from "@/components/marketing/blocks";
import { CtaBand } from "@/components/marketing/cta-band";
import { PageHead } from "@/components/marketing/page-head";
import { PhotoStrip } from "@/components/marketing/photo-strip";
import { Reveal } from "@/components/marketing/reveal";
import { Section, SectionHead } from "@/components/marketing/section";
import { StepList, type Step } from "@/components/marketing/step-list";
import { Button } from "@/components/ui/button";
import { photosIn, syllabus } from "@/content/gallery";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { breadcrumbStructuredData, jsonLd } from "@/lib/seo/structured-data";

export const metadata: Metadata = pageMetadata({
  title: "Training — the six areas every guard is trained in",
  description:
    "Guarding duties, physical fitness and parade, fire safety and emergency response, first aid, access control and crowd control — completed before a first posting, and revisited afterwards.",
  path: "/training",
  keywords: [
    "security guard training Assam",
    "security guard training Kokrajhar",
    "fire safety training security guard",
    "police verification security guard Assam",
  ],
});

const VERIFICATION: Step[] = [
  {
    n: "01",
    title: "Police verification",
    body: "Every guard is police-verified before deployment. This is not waived for an urgent posting, and it is not something we start after the guard is already on your gate.",
  },
  {
    n: "02",
    title: "Identity and address",
    body: "Aadhaar and permanent address documents are checked and held on file as part of the same verification, not accepted as a photocopy handed over at interview.",
  },
  {
    n: "03",
    title: "Fitness for duty",
    body: "Guarding is physical work on long shifts. Basic fitness is assessed before posting, and parade and fitness training continue afterwards.",
  },
];

export default function TrainingPage() {
  const photos = photosIn("training");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbStructuredData([
            { name: "Home", path: "/" },
            { name: "Training", path: "/training" },
          ]),
        )}
      />

      <PageHead
        eyebrow="Training"
        crumb="Training"
        title="Trained before anyone stands at your gate."
        lede="Six areas, covered before a first posting and revisited afterwards. A guard who freezes at a fire alarm has not been careless — somebody skipped the training."
        image="/img/nbss/training-classroom.jpg"
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr] lg:items-start">
          <Reveal>
            <SectionHead
              num="01"
              kicker="The premise"
              title="Most guarding failures are training failures."
              className="mb-6"
            />
            <div className="flex flex-col gap-4 text-base leading-relaxed text-muted-foreground">
              <p>
                A guard who lets a vehicle out because the paperwork looked roughly right
                has not been dishonest — he has been untrained. A guard who argues with an
                agitated attendant in a hospital corridor has not been rude. In each case
                there is a module behind the mistake.
              </p>
              <p>
                So we do not deploy on the strength of an interview. Our guards undergo
                training in guarding duties, physical fitness and parade, fire safety and
                emergency response, first-aid support, access control and gate management,
                and crowd control and discipline. Sessions are run with external instructors
                where the subject calls for it — the emergency-response training on this
                page was conducted with SDRF Assam.
              </p>
            </div>
            <TickList
              className="mt-7"
              items={[
                "Training completed before the first independent posting",
                "Uniform, cap and identity card issued to every guard",
                "Parade and turnout inspection as continuing practice",
                "Police verification completed before deployment",
                "Site-specific briefing before every new posting",
              ]}
            />
          </Reveal>

          <Reveal delay={80}>
            <figure>
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-app-line-soft bg-muted">
                <Image
                  src="/img/nbss/parade-ranks.jpg"
                  alt="NBSS guards drawn up in ranks with batons during parade drill"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Drill ranks — bearing, spacing and discipline.{" "}
                <span className="text-muted-foreground/70">
                  National Bodo Security Service
                </span>
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </Section>

      <Section alt>
        <SectionHead
          num="02"
          kicker="What we train"
          title="Six areas, every guard."
          lede="These are the areas named in our training programme. They are the ones that decide what happens on a site at three in the morning."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {syllabus.map((module, i) => (
            <Reveal key={module.code} delay={Math.min(i, 6) * 60}>
              <article className="flex h-full flex-col rounded-2xl border border-app-line-soft bg-card p-6 shadow-card">
                <span className="font-mono text-xs font-bold tracking-[0.18em] text-primary">
                  {module.code}
                </span>
                <h3 className="mt-4 font-display text-lg leading-snug font-bold tracking-tight">
                  {module.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  {module.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHead
          num="03"
          kicker="Before the uniform"
          title="Verification runs alongside, and it is the harder gate."
          lede="Training makes a guard useful. Verification is what makes them safe to put on your site in the first place, and it is the step an agency in a hurry is most tempted to skip."
        />
        <StepList steps={VERIFICATION} />
      </Section>

      <Section alt>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <Eyebrow num="04" text="Parade" />
            <h2 className="mt-4 font-display text-[clamp(1.6rem,3.5vw,2.25rem)] leading-tight font-bold tracking-tight text-balance">
              Turnout, in motion.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              Parade is where discipline becomes visible. It is also where a supervisor
              catches the uniform, the cap, the identity card and the bearing — before a
              client has to notice any of them.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <VideoBand
              src="/video/nbss-parade.mp4"
              poster="/img/nbss/parade-salute.jpg"
              caption="NBSS parade, Kokrajhar."
            />
          </Reveal>
        </div>
      </Section>

      {photos.length > 0 && (
        <Section>
          <SectionHead num="05" kicker="Sessions" title="Training and parade, photographed." />
          <PhotoStrip photos={photos.slice(0, 6)} />
        </Section>
      )}

      <Section alt>
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow num="◆" text="Join us" className="justify-center" />
          <h2 className="mt-4 font-display text-[clamp(1.6rem,3.5vw,2.25rem)] leading-tight font-bold tracking-tight text-balance">
            Freshers welcome. Training is provided.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
            You need to be reasonably fit, willing to work shifts, and able to produce
            Aadhaar and address proof for verification. Everything else, we teach.
          </p>
          <Button asChild size="lg" className="mt-7 h-11 px-6 text-base">
            <Link href="/careers">
              See open positions
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </Reveal>
      </Section>

      <CtaBand />
    </>
  );
}
