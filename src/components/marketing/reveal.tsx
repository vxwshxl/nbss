"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Fades a block in the first time it reaches the viewport.
 *
 * The animation itself is CSS (`.reveal` in globals.css) and this component
 * only flips a `data-shown` attribute, which is deliberate: the page is
 * scrolling and GSAP already owns the main thread for the pinned hero, so the
 * dozens of section reveals are the wrong thing to also be driving from JS. A
 * class toggle hands them to the compositor and costs one attribute write.
 *
 * IntersectionObserver rather than a ScrollTrigger for the same reason — it
 * needs no per-frame work at all, and it keeps every reveal on the page working
 * if the GSAP bundle is still in flight.
 *
 * The observer disconnects on first intersection. Content that fades back out
 * when you scroll up reads as broken on the way back down, and re-running the
 * blur on every pass is exactly the kind of motion `prefers-reduced-motion`
 * users are trying to avoid.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** Stagger offset in ms. Keep siblings 40–80ms apart. */
  delay?: number;
  as?: "div" | "section" | "li" | "span" | "p";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Already on screen at mount (above the fold, or a reload mid-page): show it
    // immediately rather than animating content the user is already reading.
    if (el.getBoundingClientRect().top < window.innerHeight) {
      el.dataset.shown = "";
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.shown = "";
        io.disconnect();
      },
      // Fire once the element is ~12% up from the bottom edge, so it has
      // finished arriving by the time it is comfortably in view.
      { rootMargin: "0px 0px -12% 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={cn("reveal", className)}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
