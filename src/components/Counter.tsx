"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts a figure up once, the first time it scrolls into view.
 *
 * Renders the final value on the server so the number is correct with
 * JavaScript disabled, in a screen reader, and in the HTML a crawler sees —
 * the animation is purely an enhancement on top of that.
 */
export function Counter({ to, duration = 1100 }: { to: string; duration?: number }) {
  const target = Number.parseInt(to, 10);
  const [display, setDisplay] = useState(to);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!Number.isFinite(target)) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / duration, 1);
          // easeOutExpo — fast, then a long settle, which reads as "counting".
          const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
          setDisplay(String(Math.round(target * eased)));
          if (p < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [target, duration]);

  return <span ref={ref}>{display}</span>;
}
