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
        "relative px-4 py-24 sm:px-8 sm:py-32",
        alt ? "bg-subtle" : "bg-background",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[1280px]">{children}</div>
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
          <h2 className="display-section text-[clamp(2.25rem,5vw,4.25rem)] text-balance">
            {title}
          </h2>
          {lede && (
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-secondary-fg">
              {lede}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </Reveal>
  );
}
