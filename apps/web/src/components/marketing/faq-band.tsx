"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";
import type { FAQ } from "@/content/site";

/**
 * Questions and answers.
 *
 * The highest-leverage block on the site for answer engines specifically: an
 * `FAQPage` graph is a pre-chunked question/answer pair, which is the exact
 * shape a retrieval step wants and the exact shape an AI Overview quotes. The
 * JSON-LD is emitted by the page that renders this — see
 * `faqStructuredData` — from the same array, so what a reader sees and what a
 * crawler reads cannot drift apart.
 *
 * Built on `<details>` rather than a hand-rolled accordion: it opens with no
 * JavaScript, it is findable by the browser's own in-page search even while
 * closed, and it is already the right thing for a screen reader. The state here
 * exists only to rotate the chevron.
 */
export function FaqBand({ faqs }: { faqs: FAQ[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      {faqs.map((faq, i) => (
        <Reveal key={faq.q} delay={Math.min(i, 8) * 40}>
          <details
            open={open === faq.q}
            onToggle={(e) => setOpen(e.currentTarget.open ? faq.q : null)}
            className="group/faq overflow-hidden rounded-xl border border-app-line-soft bg-card shadow-card"
          >
            <summary
              className={cn(
                "flex cursor-pointer list-none items-center gap-4 px-5 py-4 outline-none",
                "font-semibold transition-colors hover:text-primary",
                "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
                "marker:content-none [&::-webkit-details-marker]:hidden",
              )}
            >
              <span className="min-w-0 flex-1">{faq.q}</span>
              <ChevronDown
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out-strong group-open/faq:rotate-180 motion-reduce:transition-none"
                strokeWidth={2}
              />
            </summary>
            <p className="border-t border-app-line-soft px-5 py-4 text-sm leading-relaxed text-muted-foreground">
              {faq.a}
            </p>
          </details>
        </Reveal>
      ))}
    </div>
  );
}
