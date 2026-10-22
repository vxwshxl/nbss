"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const calm = "(prefers-reduced-motion: no-preference)";

/** Moves its child against the scroll — `speed` is the yPercent travelled across the viewport. */
export function Parallax({ speed = 12, className, children }: { speed?: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      gsap.matchMedia().add(calm, () => {
        gsap.fromTo(
          ref.current!.firstElementChild,
          { yPercent: -speed / 2 },
          { yPercent: speed / 2, ease: "none", scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true } },
        );
      });
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className={cn("overflow-hidden", className)}>
      {children}
    </div>
  );
}

/** Starts as an inset, rounded card and opens to full bleed as it reaches the top. */
export function ExpandOnScroll({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      gsap.matchMedia().add(calm, () => {
        gsap.fromTo(
          ref.current,
          { clipPath: "inset(6% 7% 6% 7% round 24px)" },
          {
            clipPath: "inset(0% 0% 0% 0% round 0px)",
            ease: "none",
            scrollTrigger: { trigger: ref.current, start: "top 90%", end: "top 10%", scrub: true },
          },
        );
        gsap.fromTo("[data-zoom]", { scale: 1.18 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true } });
      });
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className={cn("overflow-hidden", className)}>
      {children}
    </div>
  );
}

/** Rises and fades in once, when it enters the viewport. */
export function FadeUp({ className, children, delay = 0 }: { className?: string; children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      gsap.matchMedia().add(calm, () => {
        gsap.from(ref.current, { y: 32, opacity: 0, duration: 0.9, delay, ease: "power3.out", scrollTrigger: { trigger: ref.current, start: "top 88%", once: true } });
      });
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Slides a row sideways with the scroll (the angled photo strip). */
export function Drift({ distance = 120, className, children }: { distance?: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      gsap.matchMedia().add(calm, () => {
        gsap.fromTo(ref.current, { x: distance / 2 }, { x: -distance / 2, ease: "none", scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true } });
      });
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
