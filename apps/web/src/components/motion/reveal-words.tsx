"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Words brighten one by one as the block scrolls through the viewport. Segments marked
 * `strong` start brighter, so the sentence reads before the reveal finishes.
 */
export function RevealWords({
  segments,
  as: Tag = "p",
  className,
  dim = 0.18,
}: {
  segments: { text: string; strong?: boolean }[];
  as?: "p" | "h2" | "h3";
  className?: string;
  dim?: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          "[data-word]",
          { opacity: (_i, el: HTMLElement) => (el.dataset.strong ? Math.max(dim, 0.45) : dim) },
          {
            opacity: 1,
            ease: "none",
            stagger: 0.08,
            scrollTrigger: { trigger: ref.current, start: "top 82%", end: "bottom 45%", scrub: true },
          },
        );
      });
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref as never} className={cn(className)}>
      {segments.flatMap((seg, si) =>
        seg.text.split(/(\s+)/).map((part, wi) =>
          /^\s+$/.test(part) || part === "" ? (
            part
          ) : (
            <span key={`${si}-${wi}`} data-word data-strong={seg.strong ? "" : undefined} className={cn(seg.strong && "font-medium")}>
              {part}
            </span>
          ),
        ),
      )}
    </Tag>
  );
}
