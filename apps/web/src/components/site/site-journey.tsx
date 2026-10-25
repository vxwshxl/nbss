"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// The stages every contract goes through. Generic process, no invented clients or figures.
const stages = [
  {
    n: "01",
    title: "Site survey",
    text: "A field officer walks the site with you: the gates, the blind corners, the hours that matter and how many posts it needs.",
    img: "/img/nbss/guards-on-duty.webp",
    alt: "NBSS guards on duty at a site",
    // a boundary with its gate, two buildings and the posts marked
    art: ["M40 210V60h340v150H250", "M190 210H40", "M190 210v18M250 210v18", "M70 90h70v50H70z", "M280 90h70v80h-70z", "M215 150v-30M200 135h30"],
  },
  {
    n: "02",
    title: "Written quotation",
    text: "Wages, the statutory heads and our charge, set out separately, so you can see what the guard receives and what we charge on top.",
    img: "/img/nbss/vest-team.webp",
    alt: "An office desk with paperwork",
    art: ["M110 30h200v200H110z", "M140 70h140M140 100h140M140 130h90", "M140 180h60", "M230 165l15 15 30-30"],
  },
  {
    n: "03",
    title: "Selection & verification",
    text: "Guards picked for the posting, police verification completed and identity cards issued before anyone is deployed.",
    img: "/img/nbss/training-briefing.webp",
    alt: "NBSS guards at a briefing",
    art: ["M80 60h260v150H80z", "M110 90h70v90h-70z", "M200 100h110M200 130h110M200 160h70", "M131 128a14 14 0 1 0 28 0a14 14 0 1 0-28 0", "M120 175c6-22 44-22 50 0"],
  },
  {
    n: "04",
    title: "Training",
    text: "Guarding duties, parade and fitness, fire safety, first aid, access control and crowd handling, covered before the first posting.",
    img: "/img/nbss/training-demo.webp",
    alt: "Guards at a training demonstration",
    art: ["M30 220h360", "M100 110v60M88 220l12-50 12 50M84 130h32", "M180 110v60M168 220l12-50 12 50M164 130h32", "M260 110v60M248 220l12-50 12 50M244 130h32", "M340 220V60l40 18-40 18"],
  },
  {
    n: "05",
    title: "Posting & supervision",
    text: "The guard takes the post, checks in at the gate on the app, and a supervisor watches the site around the clock.",
    img: "/img/nbss/hall-gate.webp",
    alt: "A security camera watching a site",
    art: ["M30 220h360", "M260 220V120h90v100", "M250 120h110", "M90 178h150", "M240 160v60", "M300 92a24 24 0 0 1 24-24M300 76a40 40 0 0 1 40-40"],
  },
];

/**
 * "How a deployment comes together": pinned, scrolled sideways through five stages. A
 * ruled bar runs along the top as the progress bar, each stage's line drawing draws itself
 * as it arrives, and the photos slide at their own pace behind.
 */
export function SiteJourney() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const track = q("[data-track]")[0] as HTMLElement | undefined;
      if (!track) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Scroll until the last stage sits centred on screen, so the section ends on a whole card
        // (not part-way past it) at every screen width.
        const distance = () => {
          const last = track.querySelector<HTMLElement>("[data-stage]:last-of-type");
          if (!last) return 0;
          return Math.max(0, last.offsetLeft + last.offsetWidth / 2 - window.innerWidth / 2);
        };
        const slide = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: () => `+=${distance()}`, pin: true, scrub: 0.6, invalidateOnRefresh: true },
        });
        gsap.fromTo(q("[data-tape]"), { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: () => `+=${distance()}`, scrub: true } });

        q("[data-stage]").forEach((stage) => {
          const paths = stage.querySelectorAll<SVGPathElement>("[data-line]");
          paths.forEach((p) => {
            const len = p.getTotalLength();
            gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
          });
          const at = { trigger: stage, containerAnimation: slide, start: "left 85%", end: "center 55%", scrub: true };
          gsap.to(paths, { strokeDashoffset: 0, stagger: 0.08, ease: "none", scrollTrigger: at });
          gsap.from(stage.querySelectorAll("[data-rise]"), { y: 40, opacity: 0, stagger: 0.06, ease: "power2.out", scrollTrigger: { ...at, end: "left 45%" } });
          gsap.fromTo(stage.querySelector("[data-photo]"), { xPercent: -12 }, { xPercent: 12, ease: "none", scrollTrigger: { trigger: stage, containerAnimation: slide, start: "left right", end: "right left", scrub: true } });
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="journey-title" className="relative overflow-hidden bg-subtle text-foreground">
      <div className="blueprint pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex h-svh flex-col motion-reduce:h-auto">
        {/* Heading + measuring tape */}
        <div className="mx-auto w-full max-w-[1440px] px-4 pt-24 sm:px-8 sm:pt-28">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="journey-title" className="display-section text-[clamp(2rem,4.6vw,4rem)] leading-[0.95]">
              How a deployment <span className="text-secondary-fg">comes together.</span>
            </h2>
            <p className="max-w-sm text-[14px] text-secondary-fg sm:text-[15px]">From the first site visit to a guard at your gate. Keep scrolling.</p>
          </div>
          <div aria-hidden className="relative mt-6 h-7 overflow-hidden rounded-[3px] bg-muted">
            <div data-tape className="absolute inset-y-0 left-0 w-full origin-left bg-gold" />
            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgb(6_17_13/0.45)_0_1px,transparent_1px_12px),repeating-linear-gradient(90deg,rgb(6_17_13/0.6)_0_2px,transparent_2px_60px)] [mask-image:linear-gradient(to_bottom,black_55%,transparent_55%)]" />
          </div>
        </div>

        {/* Stages */}
        <div className="relative flex-1 overflow-visible">
          <ol data-track className="flex h-full w-max items-center gap-6 px-4 py-8 will-change-transform sm:gap-10 sm:px-8 motion-reduce:w-full motion-reduce:flex-col motion-reduce:items-stretch">
            {stages.map((s) => (
              <li key={s.n} data-stage className="relative grid h-full max-h-[560px] w-[86vw] shrink-0 grid-rows-[1fr_auto] overflow-hidden rounded-[28px] bg-elevated shadow-e1 ring-1 ring-border sm:w-[min(78vw,980px)] md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:grid-rows-1">
                <div className="relative min-h-[180px] overflow-hidden">
                  <div data-photo className="absolute inset-y-0 -right-[14%] -left-[14%]">
                    <Image src={s.img} alt={s.alt} fill sizes="(min-width: 768px) 520px, 86vw" className="object-cover" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-ink/20" />
                  <span className="display-hero absolute bottom-3 left-4 text-[clamp(4rem,10vw,8rem)] leading-none text-ink-fg/90 [text-shadow:0_4px_30px_rgb(0_0_0/0.4)]">{s.n}</span>
                </div>
                <div className="flex flex-col justify-between gap-4 p-5 sm:p-8">
                  <svg viewBox="0 0 420 250" className="h-auto w-full max-w-[380px]" aria-hidden>
                    {s.art.map((d, i) => (
                      <path key={i} data-line d={d} fill="none" stroke={i === 0 ? "var(--ds-gold)" : "var(--ds-ink)"} strokeOpacity={i === 0 ? 1 : 0.55} strokeWidth={i === 0 ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                  </svg>
                  <div>
                    <p data-rise className="eyebrow">Stage {s.n}</p>
                    <h3 data-rise className="display-section mt-2 text-[clamp(1.5rem,2.6vw,2.4rem)]">{s.title}</h3>
                    <p data-rise className="mt-3 max-w-md text-[15px] leading-relaxed text-secondary-fg">{s.text}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
