"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, MapPin, Phone, ShieldCheck } from "lucide-react";

import { Marquee } from "@/components/marketing/marquee";
import { Button } from "@/components/ui/button";
import { coverage, site, tel, BOOK_HREF } from "@/content/site";

gsap.registerPlugin(ScrollTrigger);

const BADGES = [
  "Registered under Govt. of Assam",
  "Police-verified guards",
  "ESI & EPF as applicable",
  "24 × 7 supervision",
];

/**
 * The hero.
 *
 * One scroll-driven idea, and it is the argument the whole page rests on: the
 * photograph starts filling the frame and then recedes behind the copy as you
 * read, so the parade — the thing that makes this agency credible — is what you
 * see first and the words arrive over it rather than beside it.
 *
 * Three decisions worth naming:
 *
 * `scrub: 1` rather than `true`. A hard scrub welds the timeline to the
 * scrollbar, so a trackpad flick lands the whole move in one frame. The
 * one-second catch-up lets it arrive under its own momentum, which is the
 * entire reason for driving it from scroll instead of a timer.
 *
 * The photograph moves at a fraction of the scroll rather than with it. Equal
 * speed is not parallax, it is just a background; the difference is what makes
 * the plate read as sitting behind the page.
 *
 * `gsap.matchMedia` owns the reduced-motion case, and GSAP reverts the context
 * when the query stops matching — so a reader who turns the setting on gets a
 * plain stacked hero with everything visible, not a half-applied timeline.
 */
export function Hero() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Explicit values rather than `clearProps: "all"` — clearProps strips
      // every inline style GSAP wrote, including the `opacity: 1` set in the
      // same call, which would drop the copy back to its `opacity-0` starting
      // class and leave the hero blank for exactly the readers who cannot see
      // it animate in.
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(".hero-rise", { opacity: 1, y: 0, filter: "none" });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // The entrance. Not scroll-driven: this plays once, on arrival, because
        // the reader has not scrolled yet and there is nothing to drive it.
        gsap.from(".hero-rise", {
          opacity: 0,
          y: 24,
          filter: "blur(6px)",
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.09,
        });

        // The plate, receding as the page is read.
        gsap.to(".hero-plate", {
          yPercent: 14,
          scale: 1.08,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "bottom top",
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });

        // The copy leaves on blur as well as opacity. Two full-contrast layers
        // crossfading at hero size is where a crossfade looks most like two
        // objects; the blur collapses them into one transition.
        gsap.to(".hero-fade", {
          opacity: 0,
          filter: "blur(4px)",
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "40% top",
            end: "bottom top",
            scrub: 1,
          },
        });
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative isolate flex min-h-[92dvh] flex-col justify-end overflow-hidden bg-foreground text-background"
    >
      {/* The plate. `priority` and `fetchPriority` because this is the LCP
          element on the whole site and nothing else should be ahead of it. */}
      <div aria-hidden className="hero-plate absolute inset-0 -z-20">
        <Image
          src="/img/nbss/parade-salute.jpg"
          alt=""
          fill
          sizes="100vw"
          priority
          fetchPriority="high"
          className="object-cover object-[center_28%]"
        />
      </div>

      {/* Three veils. The copy sits on the left, so the density goes there and
          at the foot of the frame; the right of the photograph — the parade —
          stays open. A flat scrim strong enough for body text would bury it. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/65 to-black/15"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/20 to-black/40"
      />
      <div aria-hidden className="bg-grid absolute inset-0 -z-10 opacity-[0.05]" />

      <div className="mx-auto w-full max-w-6xl px-5 pt-44 pb-12 lg:pt-36">
        <div className="hero-fade">
          <p className="hero-rise mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-[10px] font-semibold tracking-[0.08em] whitespace-nowrap text-white/90 uppercase backdrop-blur-sm sm:px-3.5 sm:text-[11px] sm:tracking-[0.14em]">
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400" />
            {site.address.city} · Bodoland Territorial Region
          </p>

          <h1 className="hero-rise font-display text-[clamp(2.6rem,6.4vw,4.6rem)] leading-[1.02] font-bold tracking-[-0.03em] text-white [text-shadow:0_2px_30px_rgb(0_0_0/0.45)]">
            Your Safety,{" "}
            <span className="relative inline-block whitespace-nowrap">
              <span className="bg-gradient-to-r from-emerald-300 via-emerald-200 to-teal-200 bg-clip-text text-transparent">
                Our Responsibility.
              </span>
              <span
                aria-hidden
                className="glow-rule absolute -bottom-1 left-0 h-[3px] w-full rounded-full"
              />
            </span>
          </h1>

          <div className="mt-9 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <div className="min-w-0">
              <p className="hero-rise max-w-xl text-[17px] leading-relaxed text-white/90 sm:text-lg">
                Trained, uniformed and police-verified security guards for government
                offices, hospitals, banks, schools, industry and events — posted where you
                need them and supervised around the clock.
              </p>

              <div className="hero-rise mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="h-12 px-6 text-base shadow-lg shadow-emerald-900/40">
                  <Link href={BOOK_HREF}>
                    Book guards
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 border-white bg-white px-6 text-base text-foreground hover:bg-white/90 hover:text-foreground"
                >
                  <Link href="/services">See what we guard</Link>
                </Button>
              </div>

              <ul className="hero-rise mt-8 grid max-w-xl gap-2 sm:grid-cols-2">
                {BADGES.map((badge) => (
                  <li
                    key={badge}
                    className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-[13px] font-medium text-white backdrop-blur-sm"
                  >
                    <ShieldCheck className="size-4 shrink-0 text-emerald-400" strokeWidth={2} />
                    {badge}
                  </li>
                ))}
              </ul>
            </div>

            {/* The deployment desk. A card rather than a second column of prose:
                the single most likely next action from this page is a phone call,
                and it should not be something the reader has to go looking for. */}
            <aside className="hero-rise rounded-2xl border border-white/15 bg-black/55 p-6 text-white shadow-2xl backdrop-blur-md">
              <p className="text-[11px] font-bold tracking-[0.16em] text-emerald-300 uppercase">
                Deployment desk · 24 × 7
              </p>
              <a
                href={`tel:${tel(site.phone)}`}
                className="mt-2 flex items-center gap-2.5 font-display text-[26px] font-bold tracking-tight text-white transition-colors hover:text-emerald-300"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-emerald-500/20">
                  <Phone className="size-4.5 text-emerald-300" strokeWidth={2.2} />
                </span>
                {site.phone}
              </a>

              <dl className="mt-5 flex flex-col gap-3 text-sm">
                <div className="flex items-start justify-between gap-4 border-t border-white/15 pt-3">
                  <dt className="text-white/70">Head office</dt>
                  <dd className="text-right font-medium">
                    {site.address.city}, {site.address.state}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-t border-white/15 pt-3">
                  <dt className="text-white/70">Districts served</dt>
                  <dd className="text-right font-medium tabular-nums">{coverage.length} and nearby</dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-t border-white/15 pt-3">
                  <dt className="text-white/70">Supervision</dt>
                  <dd className="text-right font-medium">Round the clock</dd>
                </div>
              </dl>

              <Link
                href="/contact"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300 hover:text-emerald-200 hover:underline"
              >
                <MapPin className="size-4" strokeWidth={2} />
                Talk to us
              </Link>
            </aside>
          </div>
        </div>
      </div>

      {/* The districts, running. Decorative and aria-hidden — the same list is
          set out properly further down the page, where it can be read. */}
      <div className="relative border-t border-white/12 bg-black/60 py-3 backdrop-blur-sm">
        <Marquee
          items={coverage.map((d) => d.name)}
          duration={48}
          className="mask-fade-x"
          itemClassName="text-xs font-semibold tracking-[0.14em] uppercase text-white/80"
        />
      </div>
    </section>
  );
}
