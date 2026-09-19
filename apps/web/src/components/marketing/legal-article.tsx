import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageHead } from "@/components/marketing/page-head";
import { Section } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";
import { site, tel } from "@/content/site";
import type { LegalDoc } from "@/content/legal";

/**
 * One legal document: masthead, a sticky in-page contents list, the numbered
 * sections, and a cross-link to the other document so the pair reads as one set
 * of paperwork rather than two unrelated pages.
 *
 * Everything here is static HTML — anchors, not JavaScript. A privacy policy
 * that needs a bundle to be navigable is a privacy policy that fails for
 * exactly the reader most likely to have scripting restricted, and these are
 * the two pages on the site most likely to be printed or archived.
 *
 * The prose is set narrow on purpose. This is the only place on the site
 * somebody reads several hundred continuous words, and a 75-character measure
 * is the difference between a document that can be read and one that is
 * skimmed and agreed to blindly.
 */
export function LegalArticle({ doc, other }: { doc: LegalDoc; other: LegalDoc }) {
  return (
    <>
      <PageHead eyebrow="Legal" crumb={doc.shortTitle} title={doc.title} lede={doc.lede} />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[16rem_1fr] lg:items-start">
          <aside className="lg:sticky lg:top-24">
            <p className="flex flex-col gap-0.5 rounded-xl border border-app-line-soft bg-card p-4 text-xs">
              <span className="text-muted-foreground">Last updated</span>
              <time dateTime={doc.updatedISO} className="font-semibold">
                {doc.updated}
              </time>
            </p>

            <nav aria-label="On this page" className="mt-5">
              <p className="mb-3 text-[11px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
                On this page
              </p>
              <ol className="flex flex-col gap-1.5">
                {doc.sections.map((section, i) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="flex gap-2.5 rounded-md py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <span className="font-mono text-xs text-primary tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <Button asChild variant="outline" size="sm" className="mt-6">
              <Link href={other.href}>
                {other.shortTitle}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </aside>

          <article className="min-w-0 max-w-[75ch]">
            {doc.sections.map((section, i) => (
              // `scroll-mt` clears the floating header, which is fixed and
              // would otherwise cover the heading an anchor jumps to.
              <section
                id={section.id}
                key={section.id}
                className="scroll-mt-28 border-b border-app-line-soft py-8 first:pt-0 last:border-0"
              >
                <h2 className="flex gap-3 font-display text-xl font-bold tracking-tight">
                  <span className="font-mono text-sm text-primary tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {section.heading}
                </h2>

                <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
                  {section.body.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>

                {section.list && (
                  <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-primary">
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}

                {section.after && (
                  <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
                    {section.after.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </div>
                )}
              </section>
            ))}

            <footer className="mt-8 rounded-xl border border-app-line-soft bg-muted/50 p-5 text-sm leading-relaxed text-muted-foreground">
              <p>
                Questions about this document are answered by the office, in person:{" "}
                <a
                  href={`tel:${tel(site.phone)}`}
                  className="font-medium text-primary hover:underline"
                >
                  {site.phone}
                </a>
                , or the {site.address.label.toLowerCase()} at{" "}
                {site.address.lines.join(", ")}.
              </p>
            </footer>
          </article>
        </div>
      </Section>
    </>
  );
}
