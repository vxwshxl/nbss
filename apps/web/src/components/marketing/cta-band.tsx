import Link from "next/link";
import { ArrowRight, Building2, Phone, ShieldUser } from "lucide-react";

import { AronaiBand } from "@/components/brand";
import { Reveal } from "@/components/marketing/reveal";
import { Button } from "@/components/ui/button";
import { site, tel } from "@/content/site";

/**
 * The close.
 *
 * This is a booking surface, not a brochure, so the primary action is booking
 * guards rather than reading more — and the two panels underneath name the two
 * kinds of person who arrive here already knowing that. A client who has signed
 * a contract wants their own screen showing who is on their gate this morning;
 * a guard wants the one button that marks them present. Both of those live
 * behind the same login, and neither of them is served by being told to call
 * the office.
 *
 * The phone number stays, as the secondary. A procurement officer in a district
 * office will still ring rather than fill in a form, and losing that call to
 * make the layout tidier would be an expensive piece of design.
 */
export function CtaBand() {
  return (
    <section className="relative overflow-hidden border-t border-app-line-soft bg-foreground px-5 py-20 text-background sm:py-28">
      <div aria-hidden className="bg-grid absolute inset-0 opacity-[0.06]" />
      <div aria-hidden className="bg-bloom-center absolute inset-0" />

      <div className="relative mx-auto w-full max-w-4xl">
        <Reveal className="text-center">
          <AronaiBand className="mx-auto mb-10 w-32 text-primary" />

          <h2 className="font-display text-[clamp(1.9rem,5vw,3.25rem)] leading-[1.05] font-bold tracking-[-0.03em] text-balance">
            Book guards for your site.
          </h2>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-background/70">
            Tell us the site, the hours and the number of guards. A field officer
            surveys it, and you get a written quotation showing the wages, the
            statutory heads and our charge separately — so you can see exactly what
            the guard receives and what we charge on top.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link href="/contact#quote">
                Book guards
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-background/25 bg-background/8 px-6 text-base text-background backdrop-blur-sm hover:bg-background/15 hover:text-background"
            >
              <a href={`tel:${tel(site.phone)}`}>
                <Phone data-icon="inline-start" />
                {site.phone}
              </a>
            </Button>
          </div>
        </Reveal>

        {/* Already with us. Two doors into the same console, named by who walks
            through them — "Sign in" alone makes a client wonder whether it is
            for them at all. */}
        <Reveal delay={90} className="mt-14">
          <p className="mb-4 text-center text-[11px] font-bold tracking-[0.18em] text-background/45 uppercase">
            Already with us
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/console/login"
              className="group/panel press flex items-start gap-3.5 rounded-2xl border border-background/15 bg-background/8 p-5 text-left backdrop-blur-sm transition-colors hover:border-background/30 hover:bg-background/12"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Building2 className="size-5" strokeWidth={1.9} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-semibold">
                  Client panel
                  <ArrowRight
                    aria-hidden
                    className="size-3.5 transition-transform group-hover/panel:translate-x-0.5 motion-reduce:transition-none"
                    strokeWidth={2.2}
                  />
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-background/60">
                  Who is on your gate right now, the man-hours behind this month&apos;s
                  invoice, and an assistant that answers questions about your own site.
                </span>
              </span>
            </Link>

            <Link
              href="/console/login"
              className="group/panel press flex items-start gap-3.5 rounded-2xl border border-background/15 bg-background/8 p-5 text-left backdrop-blur-sm transition-colors hover:border-background/30 hover:bg-background/12"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <ShieldUser className="size-5" strokeWidth={1.9} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-semibold">
                  Guard panel
                  <ArrowRight
                    aria-hidden
                    className="size-3.5 transition-transform group-hover/panel:translate-x-0.5 motion-reduce:transition-none"
                    strokeWidth={2.2}
                  />
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-background/60">
                  Check in at the gate, see your hours and overtime, and ask about your
                  own shifts. Sign in with the code on your identity card.
                </span>
              </span>
            </Link>
          </div>
        </Reveal>

        <p className="mt-9 text-center text-sm text-background/50">
          {site.hoursShort} · Supervision and deployment desk, 24 × 7
        </p>
      </div>
    </section>
  );
}
