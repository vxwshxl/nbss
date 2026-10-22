"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowDown, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { BOOK_HREF, site } from "@/content/site";

gsap.registerPlugin(ScrollTrigger, useGSAP);


/**
 * The opening sequence, pinned for about 1.4 screens of scroll, set in a control room:
 *   a pale map grid with range rings and a radar sweep behind the headline; the parade
 *   is a live camera feed in a viewfinder (brackets, crosshair, REC, a clock running
 *   through the shift). Scrolling, the headline drifts out, the camera pushes in, a
 *   haze rises over the feed, and N, B, S, S drop in one after another, filled with
 *   the parade, and settle.
 */
export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-intro]", { y: 28, opacity: 0, duration: 1, ease: "power3.out", stagger: 0.08, delay: 0.15 });
        gsap.from("[data-build]", { yPercent: 22, duration: 1.8, ease: "power3.out" });
        gsap.from("[data-strip] > *", { opacity: 0, y: 12, duration: 0.8, delay: 0.9, ease: "power2.out" });
        gsap.from("[data-hud] > *", { opacity: 0, duration: 0.6, delay: 1.1, stagger: 0.08, ease: "power2.out" });

        // The shift clock: 06:00 at rest, into the night as the page scrolls.
        const clock = { m: 6 * 60 };
        const time = document.querySelector<HTMLElement>("[data-shift-time]");
        const label = document.querySelector<HTMLElement>("[data-shift-label]");
        const show = () => {
          const m = Math.round(clock.m / 15) * 15;
          const h = Math.floor(m / 60) % 24;
          if (time) time.textContent = `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
          if (label) label.textContent = h >= 18 || h < 6 ? "Night shift" : "Day shift";
        };
        show();

        gsap.to("[data-radar]", { rotate: 360, duration: 9, ease: "none", repeat: -1 });

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: 0.6 },
        });
        tl.to("[data-sky]", { scale: 1.14, duration: 1 }, 0)
          .to("[data-copy]", { yPercent: -60, opacity: 0, duration: 0.3 }, 0)
          .to("[data-strip]", { opacity: 0, duration: 0.12 }, 0)
          .to("[data-build]", { yPercent: -46, scale: 1.18, duration: 0.6 }, 0)
          .to(clock, { m: 22 * 60, duration: 0.5, onUpdate: show }, 0)
          .to("[data-feed]", { scale: 1.12, duration: 0.5 }, 0)
          .to("[data-mist]", { yPercent: -36, duration: 0.6 }, 0.05)
          .to("[data-build]", { opacity: 0, duration: 0.18 }, 0.5)
          .set("[data-mark]", { opacity: 1 }, 0.56)
          .fromTo(
            "[data-letter]",
            { yPercent: -120, opacity: 0, rotate: -5 },
            { yPercent: 0, opacity: 1, rotate: 0, duration: 0.1, stagger: 0.045, ease: "back.out(1.8)" },
            0.58,
          )
          .fromTo("[data-mark-shadow]", { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.62)
          .fromTo("[data-mark-bar]", { scaleX: 0 }, { scaleX: 1, duration: 0.12 }, 0.76)
          .to("[data-mark-sub]", { opacity: 1, y: 0, duration: 0.15 }, 0.8);
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} data-hero aria-label="Introduction" className="relative h-[240svh] motion-reduce:h-svh">
      <div className="sticky top-0 h-svh overflow-hidden bg-muted text-ink">
        {/* The control room: a map grid, range rings and a radar sweep, all pale. */}
        <div data-sky aria-hidden className="absolute inset-0 will-change-transform">
          <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_35%,#f2fbf7,#e3efe9_70%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgb(4_120_87/0.07)_1px,transparent_1px),linear-gradient(90deg,rgb(4_120_87/0.07)_1px,transparent_1px)] bg-[size:48px_48px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgb(4_120_87/0.1)_1px,transparent_1px),linear-gradient(90deg,rgb(4_120_87/0.1)_1px,transparent_1px)] bg-[size:240px_240px]" />
          <svg className="absolute top-[38%] left-1/2 h-[170vmax] w-[170vmax] -translate-x-1/2 -translate-y-1/2" viewBox="-100 -100 200 200">
            {[18, 36, 54, 72, 90].map((r) => (
              <circle key={r} r={r} fill="none" stroke="rgb(4 120 87 / 0.14)" strokeWidth="0.25" strokeDasharray={r % 36 ? "1 1.5" : undefined} />
            ))}
            <path d="M-100 0H100M0 -100V100" stroke="rgb(4 120 87 / 0.1)" strokeWidth="0.2" />
          </svg>
          <div
            data-radar
            className="absolute top-[38%] left-1/2 size-[170vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_0deg,rgb(16_185_129/0.14),rgb(16_185_129/0)_14%,transparent_100%)]"
          />
          {/* Posts on the map: small blips the sweep passes over. */}
          {[
            [18, 30], [76, 22], [64, 58], [28, 64], [86, 48], [44, 18],
          ].map(([x, y], i) => (
            <span key={i} className="absolute size-2 rounded-full bg-emerald-500/60 shadow-[0_0_0_6px_rgb(16_185_129/0.12)]" style={{ left: `${x}%`, top: `${y}%`, animation: `hero-blip 3s ${i * 0.5}s ease-in-out infinite` }} />
          ))}
        </div>
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_30%,rgb(255_255_255/0.55),transparent_65%)]" />

        <div data-copy className="relative z-20 mx-auto flex max-w-5xl flex-col items-center px-4 pt-[max(118px,15svh)] text-center sm:pt-[max(128px,14svh)]">
          <p data-intro className="text-sm font-semibold text-primary-ink sm:text-base">
            {site.name} · {site.address.city}
          </p>
          <h1 data-intro className="display-hero mt-5 text-[clamp(2.6rem,6.6vw,6rem)] text-ink/90">
            Your Safety, Our Responsibility
          </h1>
          <p data-intro className="mt-4 max-w-2xl text-[clamp(1rem,1.6vw,1.25rem)] text-ink/65">
            Trained, uniformed and police-verified guards for offices, hospitals, banks, schools, industry and events{" "}
            <span className="text-ink/90">across Bodoland.</span>
          </p>
          <div data-intro className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={BOOK_HREF}
              className="group inline-flex h-11 items-center gap-2 rounded-full bg-ink pr-4 pl-5 text-sm font-medium text-ink-fg transition-transform duration-[120ms] ease-quick hover:scale-[1.03] active:scale-[0.98]"
            >
              Book guards
              <ArrowRight className="size-4 transition-transform duration-[180ms] ease-quick group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/services"
              className="inline-flex h-11 items-center rounded-full bg-white/50 px-5 text-sm font-medium text-ink shadow-[0_0_0_1px_rgb(255_255_255/0.7)] backdrop-blur-md transition-colors hover:bg-white/70"
            >
              Our services
            </Link>
          </div>
        </div>

        <div
          data-build
          aria-hidden
          className="absolute top-[68svh] left-1/2 z-10 w-[min(1120px,150vw)] -translate-x-1/2 origin-top will-change-transform sm:top-[66svh] sm:w-[min(1040px,84vw)]"
        >
          {/* The parade as a live camera feed, framed in a viewfinder. */}
          <div className="relative overflow-hidden rounded-[28px] bg-ink shadow-[0_30px_80px_-30px_rgb(6_17_13/0.55)] ring-1 ring-white/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              data-feed
              src="/img/nbss/parade-salute.jpg"
              alt=""
              width={1600}
              height={714}
              fetchPriority="high"
              className="h-auto w-full origin-center object-cover [filter:saturate(0.95)_contrast(1.05)]"
            />
            <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,rgb(255_255_255/0.035)_0_1px,transparent_1px_3px)]" />
            <div data-hud className="pointer-events-none absolute inset-0 font-mono text-[11px] text-white sm:text-[13px]">
              {/* corner brackets */}
              <span className="absolute top-4 left-4 size-8 border-t-2 border-l-2 border-white/85 sm:top-6 sm:left-6 sm:size-12" />
              <span className="absolute top-4 right-4 size-8 border-t-2 border-r-2 border-white/85 sm:top-6 sm:right-6 sm:size-12" />
              <span className="absolute bottom-4 left-4 size-8 border-b-2 border-l-2 border-white/85 sm:bottom-6 sm:left-6 sm:size-12" />
              <span className="absolute right-4 bottom-4 size-8 border-r-2 border-b-2 border-white/85 sm:right-6 sm:bottom-6 sm:size-12" />
              {/* crosshair */}
              <span className="absolute top-1/2 left-1/2 h-8 w-px -translate-1/2 bg-white/60" />
              <span className="absolute top-1/2 left-1/2 h-px w-8 -translate-1/2 bg-white/60" />
              <span className="absolute top-6 left-14 flex items-center gap-1.5 sm:top-9 sm:left-20">
                <span className="size-2 animate-pulse rounded-full bg-red-500" /> REC
              </span>
              <span className="absolute top-6 right-14 text-right tabular-nums sm:top-9 sm:right-20">
                <span data-shift-label className="block text-white/75">Day shift</span>
                <span data-shift-time className="block text-[15px] font-semibold sm:text-lg">06:00</span>
              </span>
              <span className="absolute bottom-6 left-14 sm:bottom-9 sm:left-20">CAM 01 · Main gate · {site.address.city}</span>
            </div>
          </div>
        </div>

        <div
          data-mist
          aria-hidden
          className="absolute inset-x-0 -bottom-[32svh] z-10 h-[64svh] bg-[linear-gradient(to_top,#eef6f2_45%,rgb(238_246_242/0)_88%)] will-change-transform"
        />

        <div
          data-strip
          aria-hidden
          className="absolute inset-x-0 bottom-0 z-20 h-3 bg-[repeating-linear-gradient(90deg,rgb(6_17_13/0.35)_0_1px,transparent_1px_12px),repeating-linear-gradient(90deg,rgb(6_17_13/0.55)_0_1px,transparent_1px_96px)] opacity-70 [mask-image:linear-gradient(to_top,black,black_50%,transparent)]"
        />
        <div data-strip className="absolute inset-x-0 bottom-3 z-20 hidden items-end justify-between pr-28 pb-5 pl-8 text-[13px] font-medium text-ink/70 md:flex">
          <p>Schools · Hospitals · Government offices · Banks · Industry · Events</p>
          <p className="inline-flex items-center gap-2">
            Scroll <ArrowDown className="size-3.5 animate-bounce" aria-hidden />
          </p>
        </div>

        <div data-mark aria-hidden className="pointer-events-none absolute inset-0 z-30 grid place-items-center opacity-0 motion-reduce:hidden">
          <div className="relative px-4 text-center">
            <div data-mark-shadow className="absolute inset-x-[10%] top-[6%] h-[60%] rounded-full bg-ink/25 blur-[70px]" />
            <p className="display-hero relative flex justify-center text-[clamp(6.5rem,28vw,24rem)] leading-[0.8] tracking-[-0.05em]">
              {site.shortName.split("").map((l, i) => (
                <span
                  key={i}
                  data-letter
                  className="text-photo inline-block [filter:contrast(1.2)_saturate(1.15)_drop-shadow(0_10px_24px_rgb(6_17_13/0.35))]"
                  style={{
                    backgroundImage: "url(/img/nbss/parade-ranks.jpg)",
                    backgroundSize: "340% auto",
                    backgroundPosition: `${12 + i * 26}% 40%`,
                  }}
                >
                  {l}
                </span>
              ))}
            </p>
            <div
              data-mark-bar
              className="mx-auto mt-5 h-[3px] w-[min(70vw,560px)] origin-center rounded-full bg-[linear-gradient(90deg,transparent,var(--ds-gold),transparent)]"
            />
            <p data-mark-sub className="display-section relative mt-4 translate-y-3 text-[clamp(1.125rem,3vw,2.5rem)] text-ink/80 opacity-0">
              {site.name}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
