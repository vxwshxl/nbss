import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone, TriangleAlert } from "lucide-react";

import { Panel, TickList } from "@/components/marketing/blocks";
import { PageHead } from "@/components/marketing/page-head";
import { Section } from "@/components/marketing/section";
import { ApplyForm } from "@/components/forms/ApplyForm";
import { Button } from "@/components/ui/button";
import { vacancies, vacancyById } from "@/content/gallery";
import { site, tel } from "@/content/site";
import { absoluteUrl } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { breadcrumbStructuredData, jsonLd, ORG_ID } from "@/lib/seo/structured-data";

type Params = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return vacancies.map((v) => ({ id: v.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const vacancy = vacancyById(id);
  if (!vacancy) return {};

  return pageMetadata({
    title: `${vacancy.title} — careers`,
    description: vacancy.summary,
    path: `/careers/${vacancy.id}`,
    keywords: [
      `${vacancy.title} Kokrajhar`,
      `${vacancy.title} Assam`,
      "security guard job Bodoland",
    ],
  });
}

const WE_GIVE = [
  "Training in all six areas before your first posting",
  "Uniform, cap and photo identity card",
  "ESI and EPF facility as applicable",
  "Posting in or near your home district wherever possible",
  "Supervision and a supervisor you can actually reach",
  "A route up — guard to supervisor to field officer",
];

export default async function VacancyPage({ params }: Params) {
  const { id } = await params;
  const vacancy = vacancyById(id);
  if (!vacancy) notFound();

  const others = vacancies.filter((v) => v.id !== vacancy.id).slice(0, 3);

  /**
   * A real `JobPosting`, so the role can appear in Google Jobs — which is
   * where someone in Kokrajhar looking for guard work actually searches.
   *
   * `directApply` is true because the form on this page is the application;
   * claiming it while sending people elsewhere is exactly what the property
   * exists to prevent. No `baseSalary` is asserted: the pay is a band stated
   * in prose, and a structured figure would be a number we would then have to
   * honour for every posting in every district.
   */
  const posting = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: vacancy.title,
    description: vacancy.summary,
    employmentType: vacancy.type.toUpperCase().replace(/[^A-Z]/g, "_"),
    hiringOrganization: { "@id": ORG_ID },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: vacancy.location,
        addressRegion: site.address.state,
        addressCountry: "IN",
      },
    },
    experienceRequirements: vacancy.experience,
    qualifications: vacancy.requirements.join(" "),
    directApply: true,
    url: absoluteUrl(`/careers/${vacancy.id}`),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(posting)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbStructuredData([
            { name: "Home", path: "/" },
            { name: "Careers", path: "/careers" },
            { name: vacancy.title, path: `/careers/${vacancy.id}` },
          ]),
        )}
      />

      <PageHead
        eyebrow={vacancy.type}
        crumb={vacancy.title}
        title={vacancy.title}
        lede={vacancy.summary}
        action={
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-11 px-5">
              <Link href="#apply">Apply for this role</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 px-5">
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
              About the role
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {vacancy.summary}
            </p>

            <h3 className="mt-10 mb-4 text-[11px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
              What we need from you
            </h3>
            <TickList items={vacancy.requirements} />

            <h3 className="mt-10 mb-4 text-[11px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
              What we give you
            </h3>
            <TickList items={WE_GIVE} />

            <div className="mt-10 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-100/50 p-4 text-sm leading-relaxed">
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-amber-700"
                strokeWidth={2}
              />
              <p>
                NBSS never charges a fee for a job, training, a uniform or a placement. If
                anyone asks you for money in our name, call{" "}
                <a
                  href={`tel:${tel(site.phone)}`}
                  className="font-semibold underline underline-offset-2"
                >
                  {site.phone}
                </a>{" "}
                and report it.
              </p>
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <Panel title="At a glance">
              <dl className="flex flex-col gap-2.5 text-sm">
                {[
                  ["Location", vacancy.location],
                  ["Type", vacancy.type],
                  ["Experience", vacancy.experience],
                  ["Pay", vacancy.pay],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-start justify-between gap-4 border-b border-app-line-soft pb-2.5 last:border-0 last:pb-0"
                  >
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

            <Panel tone="accent">
              <p className="text-[11px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
                Questions about the role
              </p>
              <a
                href={`tel:${tel(site.phone)}`}
                className="mt-2 flex items-center gap-2 font-display text-xl font-bold tracking-tight transition-colors hover:text-primary"
              >
                <Phone className="size-4 text-primary" strokeWidth={2} />
                {site.phone}
              </a>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Monday to Saturday, {site.officeOpen}–{site.officeClose} IST. Or walk into
                the Kokrajhar office.
              </p>
            </Panel>

            {others.length > 0 && (
              <Panel title="Other openings">
                <ul className="flex flex-col gap-2 text-sm">
                  {others.map((other) => (
                    <li key={other.id}>
                      <Link
                        href={`/careers/${other.id}`}
                        className="flex items-baseline justify-between gap-3 transition-colors hover:text-primary"
                      >
                        <span>{other.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {other.type}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </aside>
        </div>
      </Section>

      <Section alt id="apply">
        <div className="mx-auto max-w-2xl">
          <ApplyForm vacancy={vacancy} />
        </div>
      </Section>
    </>
  );
}
