"use client";

import { CountUp } from "@/components/marketing/count-up";
import { Reveal } from "@/components/marketing/reveal";
import { stats } from "@/content/site";

/**
 * The figures, immediately under the hero.
 *
 * Every one of these follows directly from the client's own profile — the
 * districts it lists, the service categories it lists, the training areas it
 * lists. There is no headcount here, and no renewal rate, because nobody has
 * confirmed one and a security agency inventing a number about itself is the
 * exact thing this site is trying not to be.
 *
 * The count-up is decorative and, importantly, not load-bearing: the final
 * value is server-rendered as text, so the figure is correct with JavaScript
 * off and correct for a crawler. The tween only replaces `textContent`.
 */
export function StatBand() {
  return (
    <section
      aria-label="At a glance"
      className="border-b border-app-line-soft bg-card/50 px-5 py-10"
    >
      <dl className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat, i) => {
          // The label carries the meaning, so the numeral only has to animate
          // if it is genuinely a numeral — "24" counts, "24 × 7" would count to
          // a number that was never the point.
          const numeric = Number(stat.value);
          return (
            <Reveal key={stat.label} delay={i * 60}>
              <div className="flex flex-col gap-1">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="font-display text-4xl leading-none font-bold tracking-tight tabular-nums sm:text-5xl">
                  {Number.isFinite(numeric) ? (
                    <CountUp to={numeric} format={(v) => String(Math.round(v))} />
                  ) : (
                    stat.value
                  )}
                  <span className="text-primary">{stat.suffix}</span>
                </dd>
                <p className="text-sm font-semibold">{stat.label}</p>
                <p className="text-xs text-muted-foreground">{stat.note}</p>
              </div>
            </Reveal>
          );
        })}
      </dl>
    </section>
  );
}
