import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

/**
 * A major region of a marketing page.
 *
 * The surface, the rhythm and the type scale come from the same tokens the
 * console uses. The kicker above the title uses the shared `eyebrow` style.
 */
export function Section({
  id,
  children,
  className,
  alt = false,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  /** A tinted ground, to separate two sections that would otherwise run on. */
  alt?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative px-5 py-20 sm:py-28",
        alt && "border-y border-app-line-soft bg-muted/40",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

export function SectionHead({
  kicker,
  title,
  lede,
  action,
  className,
}: {
  kicker: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={cn("mb-10 sm:mb-14", className)}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 max-w-3xl">
          <p className="eyebrow mb-3">{kicker}</p>
          <h2 className="font-display text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.08] font-bold tracking-[-0.025em] text-balance">
            {title}
          </h2>
          {lede && (
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {lede}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </Reveal>
  );
}
