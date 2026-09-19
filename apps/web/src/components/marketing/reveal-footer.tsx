"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pins the footer to the bottom of the viewport and lets the page scroll off
 * the top of it, so the last thing you do on the page is uncover the footer
 * rather than arrive at it.
 *
 * The mechanics: the footer is taken out of flow (`fixed`, bottom-anchored,
 * behind the page), and a transparent spacer of exactly its height is left
 * where it used to be. The document therefore still scrolls the same total
 * distance, but the final screenful is spacer — so the opaque page content
 * slides up and the already-present footer is revealed underneath.
 *
 * Two details make it safe rather than clever:
 *
 * The spacer height is measured, not guessed. A footer whose columns rewrap at
 * a breakpoint changes height, and a hardcoded spacer would then either clip
 * the footer or leave a gap of blank page below it.
 *
 * It gives up when the footer is taller than the viewport. A `fixed` element
 * bottom-anchored at more than 100vh has its top cut off with no way to scroll
 * to it — the contact details would simply be unreachable. Below that
 * threshold the footer stays in normal flow and behaves like any other footer,
 * which is the right answer on a short phone screen.
 *
 * It also stays in flow until the first measurement, so the footer is reachable
 * with no JS at all.
 */
export function RevealFooter({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // null = ordinary document flow (the pre-measurement and too-tall cases).
  const [spacer, setSpacer] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const height = el.offsetHeight;
      // 92% rather than 100%: a footer that exactly fills the viewport leaves
      // no hint that it was revealed, and mobile browser chrome moves the
      // goalposts by a few percent as you scroll.
      setSpacer(height > 0 && height <= window.innerHeight * 0.92 ? height : null);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // ResizeObserver sees the footer resize, but not a viewport that shrinks
    // around a footer whose height did not change — which is the case that
    // decides whether the reveal is safe at all.
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const revealing = spacer !== null;

  return (
    <>
      {/* While revealing, the footer's own top edge sits still under the
          page and is mostly covered. The visible edge of the footer is where
          the page content ends, which is the top of this spacer. So the spacer
          is the navbar's stop line. It comes before the footer in document
          order, and PlatformTopNav uses the first one it finds. */}
      {revealing && <div aria-hidden data-nav-stop style={{ height: spacer }} />}
      <div
        ref={ref}
        // z-0 rather than a negative index: a negative z-index can paint an
        // element behind the canvas background in some engines, and the page
        // above only needs to be *higher*, not the footer lower.
        className={revealing ? "fixed inset-x-0 bottom-0 z-0" : undefined}
      >
        {children}
      </div>
    </>
  );
}
