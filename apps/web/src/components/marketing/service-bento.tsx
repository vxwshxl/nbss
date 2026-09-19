import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";
import type { Service } from "@/content/services";
import { cn } from "@/lib/utils";

/**
 * The service catalogue, as a bento rather than a uniform grid.
 *
 * The first card is given two columns and a taller frame because the catalogue
 * is not a list of equals — one or two of these postings are what a visitor
 * arrived looking for, and a grid of nine identical tiles makes the reader do
 * the sorting. The rest run at one column each.
 *
 * Every photograph is duotoned to the brand green and lifts to full colour on
 * hover. The source images are freely-licensed and vary wildly in exposure and
 * white balance; putting them all through one treatment turns that
 * inconsistency into an intent, which is the only honest way to use a stock
 * photograph next to a real one.
 */
export function ServiceBento({
  services,
  className,
}: {
  services: Service[];
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {services.map((service, i) => {
        const feature = i === 0;
        return (
          <Reveal
            key={service.slug}
            delay={Math.min(i, 6) * 60}
            className={cn(feature && "sm:col-span-2 lg:row-span-2")}
          >
            <Link
              href={`/services/${service.slug}`}
              className={cn(
                "group/card relative flex h-full flex-col overflow-hidden rounded-2xl border border-app-line-soft bg-card shadow-card outline-none",
                "transition-shadow hover:shadow-raised focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
            >
              <div
                className={cn(
                  "relative overflow-hidden bg-muted",
                  feature ? "aspect-[16/10] lg:aspect-[16/11]" : "aspect-[16/9]",
                )}
              >
                <Image
                  src={service.image}
                  alt=""
                  fill
                  sizes={
                    feature
                      ? "(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 66vw"
                      : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  }
                  className={cn(
                    "object-cover transition-[filter,scale] duration-700 ease-out-strong",
                    "grayscale-[0.55] sepia-[0.15] hue-rotate-[80deg] saturate-[0.85] contrast-[1.05]",
                    "group-hover/card:scale-[1.04] group-hover/card:grayscale-0 group-hover/card:sepia-0 group-hover/card:hue-rotate-0 group-hover/card:saturate-100",
                    "motion-reduce:transition-none motion-reduce:group-hover/card:scale-100",
                  )}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent"
                />
                <ArrowUpRight
                  aria-hidden
                  className="absolute top-3 right-3 size-5 text-white/70 transition-transform duration-300 group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5 motion-reduce:transition-none"
                  strokeWidth={2}
                />
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h3
                  className={cn(
                    "font-display font-bold tracking-tight",
                    feature ? "text-2xl" : "text-lg",
                  )}
                >
                  {service.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {service.summary}
                </p>

                {/* The feature card has room to say what the posting actually
                    covers, which is the question a facilities manager is
                    really asking. The smaller cards do not, and a truncated
                    list of three is worse than none. */}
                {feature && service.scope.length > 0 && (
                  <ul className="mt-5 flex flex-wrap gap-1.5">
                    {service.scope.slice(0, 5).map((item) => (
                      <li
                        key={item}
                        className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                )}

                <span className="mt-auto pt-5 text-sm font-semibold text-primary">
                  What this posting covers
                </span>
              </div>
            </Link>
          </Reveal>
        );
      })}
    </div>
  );
}
