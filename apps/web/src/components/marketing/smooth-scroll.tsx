"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * Momentum scrolling for the marketing pages, and the single place where Lenis
 * and GSAP are wired to each other.
 *
 * The two have to share one clock. Left alone, Lenis runs its own
 * requestAnimationFrame loop and ScrollTrigger runs another, so a pinned
 * section is laid out against a scroll position that is one frame stale — which
 * shows up as the pinned element shimmering by a pixel on every wheel tick.
 * Driving Lenis from GSAP's ticker and pushing every Lenis scroll into
 * `ScrollTrigger.update` collapses both onto GSAP's frame.
 *
 * `lagSmoothing(0)` matters for the same reason: GSAP's default is to notice a
 * long frame and quietly fast-forward its timelines to catch up. That is right
 * for a self-contained animation and wrong for a scroll-linked one, where the
 * position is not GSAP's to invent — it would jump the pin ahead of where the
 * page actually is.
 *
 * Under `prefers-reduced-motion` Lenis is never constructed. Its own
 * `respectReducedMotion` would keep the instance alive with smoothing off, but
 * that still moves scroll onto the main thread for no benefit; letting the
 * browser scroll natively is both cheaper and closer to what the setting asks
 * for. ScrollTrigger stays active either way — the reveals and counters still
 * need to know what is on screen, they just play without travel.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ScrollTrigger.refresh();
      return;
    }

    const lenis = new Lenis({
      // ~1s of glide. Long enough to read as momentum, short enough that a
      // deliberate flick to the next section still lands quickly.
      duration: 1.05,
      // Exponential decay: fast off the line, settling to a stop rather than
      // arriving at one. This is the standard Lenis curve.
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Touch devices already have momentum in hardware. Overriding it makes
      // the page feel detached from the finger.
      syncTouch: false,
      // In-page links (#features) route through Lenis so they glide instead of
      // teleporting past the sections between.
      anchors: true,
    });

    const onScroll = () => ScrollTrigger.update();
    lenis.on("scroll", onScroll);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.off("scroll", onScroll);
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);

  return null;
}
