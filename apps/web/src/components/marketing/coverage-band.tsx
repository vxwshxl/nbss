import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";
import { Section, SectionHead } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";
import { coverage } from "@/content/site";
import { cn } from "@/lib/utils";

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
  return (
    <Section id="coverage">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-start">
        <div>
          <SectionHead
            num="04"
            kicker="Where we deploy"
            title="Kokrajhar outward, as far as we can supervise."
            lede="If your site is just outside this list, ask. We would rather give you a straight answer than take on a posting we cannot check on properly."
            className="mb-8"
          />
          <Button asChild variant="outline">
            <Link href="/contact">
              Ask about your district
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {coverage.map((district, i) => (
            <Reveal as="li" key={district.name} delay={Math.min(i, 6) * 50}>
              <div
                className={cn(
                  "flex h-full items-start gap-3 rounded-xl border p-4",
                  district.core
                    ? "border-primary/25 bg-primary/5"
                    : "border-app-line-soft bg-card",
                )}
              >
                <MapPin
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    district.core ? "text-primary" : "text-muted-foreground",
                  )}
                  strokeWidth={2}
                />
                <div className="min-w-0">
                  <p className="font-semibold">{district.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {district.region}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  );
}
