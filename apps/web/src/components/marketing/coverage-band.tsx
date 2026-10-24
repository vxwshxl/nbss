import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";
import { Section, SectionHead } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";
import { coverage } from "@/content/site";

/**
 * Where the agency will actually deploy.
 *
 * Worth being literal about why this is a section and not a line of prose. This
 * is a local business, and "security agency in Chirang" is the query it should
 * win — a district that is not named on the page is a district this site cannot
 * be the answer for. The same list is what feeds `areaServed` in the JSON-LD
 * graph, so the words a reader sees and the claim a crawler reads come from one
 * array in `content/site`.
 *
 * The core / nearby split is honest rather than decorative: the client's own
 * profile draws that line, and taking on a posting nobody can supervise
 * properly is the failure this whole product exists to prevent.
 */
export function CoverageBand() {
  const home = coverage.filter((d) => d.core);
  const state = coverage.filter((d) => !d.core);
  return (
    <Section id="coverage">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-start">
        <div>
          <SectionHead
            kicker="Where we deploy"
            title="All of Assam, from our home in Bodoland."
            lede="The Bodoland Territorial Region is where we started, recruit and supervise most closely. From there we deploy across every district of Assam. Tell us your district and we will plan the posting."
            className="mb-8"
          />
          <Button asChild variant="outline">
            <Link href="/contact">
              Ask about your district
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary-ink">
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">Home</span>
              Bodoland Territorial Region
            </p>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {home.map((district, i) => (
                <Reveal as="li" key={district.name} delay={Math.min(i, 6) * 50}>
                  <div className="flex h-full items-start gap-3 rounded-xl border border-primary/30 bg-primary/8 p-4 shadow-sm">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.2} />
                    <div className="min-w-0">
                      <p className="font-semibold">{district.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{district.region}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold">Across Assam · {state.length} more districts</p>
            <ul className="flex flex-wrap gap-2">
              {state.map((district) => (
                <li key={district.name} className="rounded-full border border-app-line-soft bg-card px-3 py-1.5 text-[13px] text-foreground/80">
                  {district.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  );
}
