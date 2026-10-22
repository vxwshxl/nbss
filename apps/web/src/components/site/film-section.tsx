"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Right after the hero: the NBSS parade film, played like a reel. Pinned while you scroll, it
 * rises from a small card tilted back under the heading, straightens and opens to fill the screen
 * (sized by height so it always fits under the header) as the heading clears.
 *
 * It starts by itself once on screen, with sound where the browser allows it. Browsers refuse
 * sound until the visitor has clicked, tapped or pressed a key on the page (scrolling doesn't
 * count), so then it plays muted and their first tap anywhere turns the sound on. The corner
 * speaker, or a tap on the film, toggles it like a reel.
 */
export function FilmSection() {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const userMuted = useRef(false);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({
            scrollTrigger: { trigger: root.current, start: "top top", end: "+=120%", scrub: 0.6, pin: true, anticipatePin: 1, invalidateOnRefresh: true },
          })
          // The heading clears first, then the film grows into the space: they never overlap.
          .fromTo("[data-film-head]", { y: 0, opacity: 1 }, { y: -90, opacity: 0, ease: "power2.in", duration: 0.22 }, 0)
          .fromTo("[data-film]", { scale: 0.5, rotateX: 26, yPercent: 14, borderRadius: 44 }, { scale: 1, rotateX: 0, yPercent: 0, borderRadius: 22, ease: "power2.out", duration: 0.85 }, 0.18)
          .fromTo("[data-film-glow]", { opacity: 0 }, { opacity: 1, ease: "none", duration: 1 }, 0);
      });
    },
    { scope: root },
  );

  // The hero above loads images and fonts after this measures where to pin, which shifts the page:
  // re-measure once everything has loaded and whenever the page changes height, so the pin always
  // starts with the section exactly at the top and the film never hangs off the bottom.
  useEffect(() => {
    let raf = 0;
    const refresh = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => ScrollTrigger.refresh());
    };
    if (document.readyState !== "complete") addEventListener("load", refresh, { once: true });
    void document.fonts?.ready.then(refresh);
    let last = document.body.scrollHeight;
    const ro = new ResizeObserver(() => {
      const h = document.body.scrollHeight;
      if (Math.abs(h - last) > 4) {
        last = h;
        refresh();
      }
    });
    ro.observe(document.body);
    return () => {
      removeEventListener("load", refresh);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // Plays while on screen (with sound if allowed), pauses when scrolled away.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const unmuteOnFirstTap = () => {
      if (userMuted.current) return;
      v.muted = false;
      setMuted(false);
      if (!v.paused) return;
      void v.play().catch(() => {});
    };
    const start = async () => {
      if (!userMuted.current) {
        v.muted = false;
        try {
          await v.play();
          setMuted(false);
          return;
        } catch {
          // No sound before the visitor has interacted with the page: play muted instead.
        }
      }
      v.muted = true;
      setMuted(true);
      await v.play().catch(() => {});
      for (const e of ["pointerdown", "keydown", "touchend"]) addEventListener(e, unmuteOnFirstTap, { once: true, passive: true });
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) void start();
        else v.pause();
      },
      { threshold: 0.5 },
    );
    io.observe(v);
    return () => {
      io.disconnect();
      for (const e of ["pointerdown", "keydown", "touchend"]) removeEventListener(e, unmuteOnFirstTap);
    };
  }, []);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    userMuted.current = v.muted;
    setMuted(v.muted);
    if (v.paused) void v.play().catch(() => {});
  };

  return (
    <section ref={root} aria-labelledby="film-title" className="relative h-svh overflow-hidden bg-subtle px-4 pt-[84px] [perspective:1400px]">
      <div data-film-glow aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_55%,color-mix(in_oklab,var(--ds-accent)_14%,transparent),transparent)] opacity-0" />
      <div data-film-head className="absolute inset-x-4 top-[calc(84px+4svh)] z-10 mx-auto max-w-3xl text-center">
        <p className="eyebrow">On the parade ground</p>
        <h2 id="film-title" className="display-section mt-3 text-[clamp(1.75rem,4vw,3.25rem)] text-foreground">
          Trained and drilled, <span className="text-secondary-fg">before they reach your gate.</span>
        </h2>
      </div>
      <div className="flex h-full items-center justify-center pb-4">
        <div data-film className="relative w-[min(72rem,100%,calc((100svh-84px-2.5rem)*16/9))] overflow-hidden rounded-3xl bg-ink shadow-e3 will-change-transform">
          <video
            ref={video}
            muted
            playsInline
            loop
            preload="metadata"
            poster="/img/nbss/parade-night.jpg"
            onClick={toggle}
            className="block aspect-video w-full cursor-pointer"
            aria-label="NBSS guards on parade"
          >
            <source src="/video/nbss-parade.mp4" type="video/mp4" />
          </video>
          <button
            type="button"
            onClick={toggle}
            aria-label={muted ? "Turn sound on" : "Mute"}
            aria-pressed={!muted}
            className="absolute right-3 bottom-3 grid size-11 place-items-center rounded-full bg-ink/60 text-white backdrop-blur transition-transform hover:scale-105 active:scale-95 sm:right-5 sm:bottom-5"
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
        </div>
      </div>
    </section>
  );
}
