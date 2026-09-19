import { Reveal } from "@/components/marketing/reveal";

export type Step = { n: string; title: string; body: string };

/**
 * An ordered process, drawn as a connected column rather than four loose cards.
 *
 * The rule down the left is the whole point: these steps happen in order and
 * each one depends on the one above it, and a grid of equal tiles says the
 * opposite. On a phone the rule stays and the cards stack, which is the same
 * shape at a different width rather than a different component.
 */
export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="relative flex flex-col gap-6 border-l border-app-line pl-8 sm:pl-10">
      {steps.map((step, i) => (
        <Reveal as="li" key={step.n} delay={Math.min(i, 6) * 70} className="relative">
          {/* The node on the rule. `-left-*` is measured against the list's own
              padding so the dot sits centred on the line at both widths. */}
          <span
            aria-hidden
            className="absolute top-1 -left-[2.25rem] flex size-7 items-center justify-center rounded-full border border-app-line bg-card font-mono text-[11px] font-bold text-primary sm:-left-[3.25rem]"
          >
            {step.n}
          </span>
          <h3 className="font-display text-lg leading-snug font-bold tracking-tight">
            {step.title}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {step.body}
          </p>
        </Reveal>
      ))}
    </ol>
  );
}
