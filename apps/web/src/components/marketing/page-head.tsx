import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { ExpandOnScroll, FadeUp } from "@/components/motion/scroll-fx";

/**
 * The opening band of an inner page: a big title on the pale ground, the lede set to the
 * right, and (when the page has one) a photograph that starts as an inset card and opens
 * to full bleed as it scrolls up. Clears the fixed header itself, so pages need no padding.
 *
 * A page with nothing worth photographing passes no `image` and simply gets the title.
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
  /** A photograph under the title. Omit where there is nothing apt. */
  image?: string;
  /** The current page, for the trail. The root is always "Home". */
  crumb?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="bg-subtle pt-32 sm:pt-40">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-8">
        <FadeUp>
          {crumb && (
            <nav aria-label="Breadcrumb" className="mb-5">
              <ol className="flex items-center gap-1.5 text-[13px] text-secondary-fg">
                <li>
                  <Link href="/" className="transition-colors hover:text-foreground">
                    Home
                  </Link>
                </li>
                <li aria-hidden>
                  <ChevronRight className="size-3.5 opacity-50" />
                </li>
                <li aria-current="page" className="font-medium text-foreground">
                  {crumb}
                </li>
              </ol>
            </nav>
          )}
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display-hero mt-4 max-w-5xl text-[clamp(2.5rem,7vw,6.25rem)] text-balance">{title}</h1>
        </FadeUp>
        {(lede || action) && (
          <FadeUp delay={0.1} className="mt-8 flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl text-lg text-secondary-fg">{lede}</div>
            {action && <div className="shrink-0">{action}</div>}
          </FadeUp>
        )}
      </div>
      {image ? (
        <ExpandOnScroll className="relative mt-14 h-[64svh] min-h-[340px]">
          <Image data-zoom src={image} alt="" fill priority sizes="100vw" className="object-cover" />
        </ExpandOnScroll>
      ) : (
        <div className="h-16 sm:h-20" />
      )}
    </header>
  );
}
