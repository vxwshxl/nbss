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
 *   through the shift), fading into the map at its foot. Scrolling, the headline drifts
 *   out, the camera pushes in and rises, and N, B, S, S drop in one after another,
 *   filled with the parade, and settle.
 */
export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-intro]", { y: 28, opacity: 0, duration: 1, ease: "power3.out", stagger: 0.08, delay: 0.15 });
        // Slide only: an opacity tween here would hand the scroll timeline below a starting
        // opacity of 0, and the wall would stay invisible at the top of the page.
        gsap.from("[data-build]", { y: 60, duration: 1.4, ease: "power3.out", delay: 0.2 });
        gsap.from("[data-strip] > *", { opacity: 0, y: 12, duration: 0.8, delay: 0.9, ease: "power2.out" });
        gsap.from("[data-cam]", { opacity: 0, y: 16, duration: 0.7, delay: 0.5, stagger: 0.12, ease: "power3.out" });

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

        <div className="relative z-20 mx-auto flex h-full max-w-[1360px] flex-col gap-6 px-4 pt-[max(108px,13svh)] pb-4 sm:px-8 md:pb-16 lg:flex-row lg:items-center lg:gap-12 lg:pt-[max(104px,12svh)] lg:pb-16 [@media(max-height:760px)]:pb-4">
          <div data-copy className="flex flex-col items-center text-center lg:w-[46%] lg:shrink-0 lg:items-start lg:text-left">
            <p data-intro className="text-sm font-semibold text-primary-ink sm:text-base">
              {site.name} · {site.address.city}
            </p>
            <h1 data-intro className="display-hero mt-5 text-[clamp(2.6rem,6.6vw,6rem)] text-ink/90 lg:text-[clamp(3rem,4.9vw,5.5rem)]">
              Your Safety, Our Responsibility
            </h1>
            <p data-intro className="mt-4 max-w-2xl text-[clamp(1rem,1.6vw,1.25rem)] text-ink/65 lg:max-w-xl">
              Trained, uniformed and police-verified guards for offices, hospitals, banks, schools, industry and events{" "}
              <span className="text-ink/90">across Assam,</span> with the <span className="font-semibold text-primary-ink">Bodoland Territorial Region</span> at our heart.
            </p>
            <div data-intro className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
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
            {/* The app, for guards, the office and clients. */}
            <div data-intro className="mt-4 flex flex-wrap items-center justify-center gap-2.5 lg:justify-start">
              <Link
                href="/android"
                className="inline-flex h-11 items-center gap-2.5 rounded-xl bg-ink px-3.5 text-ink-fg transition-transform duration-[120ms] ease-quick hover:scale-[1.03] active:scale-[0.98]"
              >
                <AndroidMark className="size-5" />
                <span className="flex flex-col text-left leading-none">
                  <span className="text-[10px] text-ink-fg/70">Get it on</span>
                  <span className="text-sm font-semibold">Android</span>
                </span>
              </Link>
              <span
                aria-disabled
                title="The iPhone app is on its way"
                className="inline-flex h-11 cursor-default items-center gap-2.5 rounded-xl bg-white/50 px-3.5 text-ink/55 shadow-[0_0_0_1px_rgb(255_255_255/0.7)] backdrop-blur-md"
              >
                <AppleMark className="size-5" />
                <span className="flex flex-col text-left leading-none">
                  <span className="text-[10px]">Coming soon on</span>
                  <span className="text-sm font-semibold">iOS</span>
                </span>
              </span>
            </div>
          </div>

          {/* What is left of the screen, as a size container: the wall below scales to fit
              it whole, so neither photo is ever cropped, faded or run off the edge. */}
          <div className="flex min-h-0 flex-1 items-center justify-center self-stretch [container-type:size] lg:justify-end">
            <CameraWall />
          </div>
        </div>

        <div
          data-strip
          aria-hidden
          className="absolute inset-x-0 bottom-0 z-20 h-3 bg-[repeating-linear-gradient(90deg,rgb(6_17_13/0.35)_0_1px,transparent_1px_12px),repeating-linear-gradient(90deg,rgb(6_17_13/0.55)_0_1px,transparent_1px_96px)] opacity-70 [mask-image:linear-gradient(to_top,black,black_50%,transparent)]"
        />
        <div data-strip className="absolute inset-x-0 bottom-3 z-20 hidden items-end justify-between pr-28 pb-5 pl-8 text-[13px] font-medium text-ink/70 md:flex [@media(max-height:760px)]:hidden">
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
                    backgroundImage: "url(/img/nbss/parade-ranks.webp)",
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

/**
 * The control room's monitor wall: two camera feeds shown whole, plus the shift clock.
 *
 * Laid out in units of its own width (`--w`), which is the largest that fits the space
 * it is given (a size container) in both directions. That keeps both photos at their
 * true aspect ratio on every screen: nothing is cropped, faded or hidden behind a HUD,
 * only a small label sits in each corner.
 *
 *   ┌───────────────────────────────┐
 *   │ CAM 01  stadium     1280 × 571 │
 *   ├──────────┬────────────────────┤
 *   │ CAM 02   │ shift clock        │
 *   │ team 3:4 │ posts covered      │
 *   └──────────┴────────────────────┘
 */
function CameraWall() {
  return (
    <div
      data-build
      aria-hidden
      className="grid w-(--w) origin-center grid-cols-[calc(var(--w)*0.369)_1fr] grid-rows-[calc(var(--w)*0.44625)_calc(var(--w)*0.5)] gap-[calc(var(--w)*0.025)] will-change-transform [--w:min(100cqw,calc(100cqh/0.97125),760px)]"
    >
      <Feed
        className="col-span-2"
        src="/img/nbss/cam-main.webp"
        width={1280}
        height={571}
        label="CAM 01 · Stadium duty"
        priority
      />
      <Feed src="/img/nbss/cam-event.webp" width={720} height={968} label="CAM 02 · Building post" />

      <div
        data-cam
        className="flex flex-col justify-between rounded-[calc(var(--w)*0.03)] bg-ink p-[calc(var(--w)*0.035)] font-mono text-white shadow-[0_24px_60px_-28px_rgb(6_17_13/0.6)] ring-1 ring-white/10"
      >
        <div className="flex items-center justify-between text-[max(9px,calc(var(--w)*0.018))] tracking-wide text-white/60 uppercase">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-[0.7em] animate-pulse rounded-full bg-red-500" /> Live
          </span>
          <span>2 cams</span>
        </div>
        <div>
          <span data-shift-label className="block text-[max(10px,calc(var(--w)*0.022))] text-emerald-300">
            Day shift
          </span>
          <span data-shift-time className="block text-[calc(var(--w)*0.1)] leading-none font-semibold tabular-nums">
            06:00
          </span>
        </div>
        <ul className="space-y-[0.5em] text-[max(9px,calc(var(--w)*0.018))] text-white/75">
          <li className="flex items-center gap-1.5">
            <span className="size-[0.6em] rounded-full bg-emerald-400" /> Stadium duty · {site.address.city}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-[0.6em] rounded-full bg-emerald-400" /> Building post · {site.address.city}
          </li>
        </ul>
      </div>
    </div>
  );
}

function Feed({
  src,
  width,
  height,
  label,
  className,
  priority = false,
}: {
  src: string;
  width: number;
  height: number;
  label: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      data-cam
      className={`relative overflow-hidden rounded-[calc(var(--w)*0.03)] bg-ink shadow-[0_24px_60px_-28px_rgb(6_17_13/0.6)] ring-1 ring-white/60 ${className ?? ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={width}
        height={height}
        fetchPriority={priority ? "high" : undefined}
        className="size-full object-cover"
      />
      <span className="absolute top-[calc(var(--w)*0.02)] left-[calc(var(--w)*0.02)] inline-flex items-center gap-1.5 rounded-full bg-black/45 px-[0.8em] py-[0.35em] font-mono text-[max(8px,calc(var(--w)*0.016))] text-white backdrop-blur-sm">
        <span className="size-[0.6em] animate-pulse rounded-full bg-red-500" />
        {label}
      </span>
    </div>
  );
}

function AndroidMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="#3DDC84">
      <path d="M17.6 9.48l1.84-3.18a.38.38 0 0 0-.66-.38l-1.86 3.22A11.4 11.4 0 0 0 12 8.13c-1.77 0-3.43.38-4.92 1.01L5.22 5.92a.38.38 0 0 0-.66.38L6.4 9.48A10.78 10.78 0 0 0 1 18h22a10.78 10.78 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
    </svg>
  );
}

function AppleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M16.37 12.7c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.71-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.25 2.73 2.2 1.1-.04 1.51-.7 2.84-.7 1.32 0 1.7.7 2.86.68 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.29-3.52zM14.2 6.23c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.68-.92 2.67.97.07 1.96-.49 2.56-1.22z" />
    </svg>
  );
}
