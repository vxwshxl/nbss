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
import { coverage, site, tel } from "@/content/site";

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

      {/* Two veils, not one. A flat scrim at the strength the headline needs
          would bury the photograph; a gradient keeps the top of the frame open
          and puts the density where the text actually sits. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/60 to-black/25"
      />
      <div aria-hidden className="bg-grid absolute inset-0 -z-10 opacity-[0.06]" />

      <div className="mx-auto w-full max-w-6xl px-5 pt-32 pb-10">
        <div className="hero-fade grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:items-end">
          <div className="min-w-0">
            <p className="hero-rise mb-5 flex flex-wrap items-center gap-2.5 text-[11px] font-bold tracking-[0.18em] text-background/60 uppercase">
              <span className="text-primary">{site.shortName}</span>
              <span aria-hidden className="h-px w-8 bg-background/25" />
              {site.address.city} · {site.address.region}
            </p>

            <h1 className="hero-rise font-display text-[clamp(2.5rem,7vw,4.75rem)] leading-[0.98] font-bold tracking-[-0.03em] text-balance">
              Your Safety,
              <br />
              <span className="relative inline-block">
                Our Responsibility.
                <span
                  aria-hidden
                  className="glow-rule absolute -bottom-1 left-0 h-[3px] w-full rounded-full"
                />
              </span>
            </h1>

            <p className="hero-rise mt-7 max-w-2xl text-base leading-relaxed text-background/75 sm:text-lg">
              {site.name} supplies trained, disciplined and police-verified security
              personnel to government departments, corporate offices, educational
              institutions, hospitals, banks, industry and commercial establishments
              across the Bodoland Territorial Region.
            </p>

            <div className="hero-rise mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 px-5 text-base">
                <Link href="/contact#quote">
                  Request a quotation
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 border-background/25 bg-background/8 px-5 text-base text-background backdrop-blur-sm hover:bg-background/15 hover:text-background"
              >
                <Link href="/services">See what we guard</Link>
              </Button>
            </div>

            <ul className="hero-rise mt-8 flex flex-wrap gap-2">
              {BADGES.map((badge) => (
                <li
                  key={badge}
                  className="inline-flex items-center gap-1.5 rounded-full border border-background/15 bg-background/8 px-3 py-1.5 text-xs font-medium text-background/75 backdrop-blur-sm"
                >
                  <ShieldCheck className="size-3.5 text-primary" strokeWidth={2} />
                  {badge}
                </li>
              ))}
            </ul>
          </div>

          {/* The deployment desk. A card rather than a second column of prose:
              the single most likely next action from this page is a phone call,
              and it should not be something the reader has to go looking for. */}
          <aside className="hero-rise rounded-2xl border border-background/15 bg-background/8 p-6 backdrop-blur-md">
            <p className="text-[11px] font-bold tracking-[0.16em] text-background/55 uppercase">
              Deployment desk
            </p>
            <a
              href={`tel:${tel(site.phone)}`}
              className="mt-2 flex items-center gap-2 font-display text-2xl font-bold tracking-tight transition-colors hover:text-primary"
            >
              <Phone className="size-5 text-primary" strokeWidth={2} />
              {site.phone}
            </a>

            <dl className="mt-5 flex flex-col gap-3 text-sm">
              <div className="flex items-start justify-between gap-4 border-t border-background/12 pt-3">
                <dt className="text-background/55">Head office</dt>
                <dd className="text-right">
                  {site.address.city}, {site.address.state}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-background/12 pt-3">
                <dt className="text-background/55">Districts served</dt>
                <dd className="text-right tabular-nums">{coverage.length} and nearby</dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-background/12 pt-3">
                <dt className="text-background/55">Supervision</dt>
                <dd className="text-right">24 × 7</dd>
              </div>
            </dl>

            <Link
              href="/contact"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <MapPin className="size-4" strokeWidth={2} />
              Talk to us
            </Link>
          </aside>
        </div>
      </div>

      {/* The districts, running. Decorative and aria-hidden — the same list is
          set out properly further down the page, where it can be read. */}
      <div className="relative border-t border-background/12 bg-black/35 py-3 backdrop-blur-sm">
        <Marquee
          items={coverage.map((d) => d.name)}
          duration={48}
          className="mask-fade-x"
          itemClassName="text-xs font-semibold tracking-[0.14em] uppercase text-background/60"
        />
      </div>
    </section>
  );
}
