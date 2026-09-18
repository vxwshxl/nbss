import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { AronaiBand } from "@/components/brand";
import { cn } from "@/lib/utils";

/**
 * The masthead of an interior page.
 *
 * Two jobs, and the second is the one that earns the photograph. It states what
 * the page is; and it gives a page that is otherwise a wall of prose — a
 * training syllabus, a legal document — one image to establish that this is a
 * real agency in a real place before the reader starts reading.
 *
 * A page with nothing worth photographing passes no `image` and gets the same
 * masthead on the app's own ground instead. That is the honest outcome: a stock
 * photograph chosen to fill a slot is worse than an empty slot.
 */
export function PageHead({
  eyebrow,
  title,
  lede,
  image,
  crumb,
  action,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  /** A photograph behind the masthead. Omit where there is nothing apt. */
  image?: string;
  /** The current page, for the trail. The root is always "Home". */
  crumb?: string;
  action?: React.ReactNode;
}) {
  const dark = Boolean(image);

  return (
    <header
      className={cn(
        "relative isolate overflow-hidden",
        dark
          ? "bg-foreground text-background"
          : "border-b border-app-line-soft bg-muted/40",
      )}
    >
      {image && (
        <>
          <Image
            src={image}
            alt=""
            fill
            sizes="100vw"
            priority
            className="-z-20 object-cover object-center"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-t from-black/92 via-black/70 to-black/45"
          />
          <div aria-hidden className="bg-grid absolute inset-0 -z-10 opacity-[0.06]" />
        </>
      )}

      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
        {crumb && (
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-1.5 text-xs">
              <li>
                <Link
                  href="/"
                  className={cn(
                    "transition-colors",
                    dark
                      ? "text-background/55 hover:text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Home
                </Link>
              </li>
              <li aria-hidden>
                <ChevronRight
                  className={cn(
                    "size-3.5",
                    dark ? "text-background/30" : "text-muted-foreground/40",
                  )}
                  strokeWidth={2}
                />
              </li>
              <li aria-current="page" className="font-semibold">
                {crumb}
              </li>
            </ol>
          </nav>
        )}

        <p
          className={cn(
            "mb-4 flex items-center gap-3 font-mono text-[11px] font-bold tracking-[0.18em] uppercase",
            dark ? "text-background/55" : "text-muted-foreground",
          )}
        >
          <span className="text-primary">◆</span>
          <span aria-hidden className={cn("h-px w-8", dark ? "bg-background/25" : "bg-app-line")} />
          {eyebrow}
        </p>

        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0 max-w-3xl">
            <h1 className="font-display text-[clamp(2rem,5.5vw,3.5rem)] leading-[1.04] font-bold tracking-[-0.03em] text-balance">
              {title}
            </h1>
            {lede && (
              <p
                className={cn(
                  "mt-5 max-w-2xl text-base leading-relaxed sm:text-lg",
                  dark ? "text-background/70" : "text-muted-foreground",
                )}
              >
                {lede}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </div>

      <AronaiBand className={dark ? "text-primary/40" : "text-primary/25"} />
    </header>
  );
}
