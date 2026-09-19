"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type Props = {
  to: number;
  /** Turns the tweened number into the string on screen (₹, %, 1.2L, …). */
  format?: (value: number) => string;
  duration?: number;
  className?: string;
};

const defaultFormat = (v: number) => Math.round(v).toLocaleString("en-IN");

/**
 * Counts a figure up when it scrolls into view.
 *
 * Two details do most of the work here:
 *
 * `power2.out` — a counter that decelerates lands on its final value instead of
 * slamming into it, and the eye can actually read the last few hundred. A
 * linear count arrives while you are still looking at the middle digits.
 *
 * `tabular-nums` — proportional digits are different widths, so an animating
 * number reflows on nearly every frame and the label beside it jitters. The
 * server renders the final value as text so the figure is correct with no JS
 * and correct for a crawler; the tween only replaces `textContent`.
 */
export function CountUp({ to, format = defaultFormat, duration = 1.6, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = format(to);
      return;
    }

    const counter = { value: 0 };
    const tween = gsap.to(counter, {
      value: to,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = format(counter.value);
      },
      scrollTrigger: { trigger: el, start: "top 85%", once: true },
      // Held until the trigger fires, so the figure does not flash 0 → final
      // for anyone who lands further down the page.
      paused: false,
      immediateRender: false,
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [to, duration, format]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {format(to)}
    </span>
  );
}
