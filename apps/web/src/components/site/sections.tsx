import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Drift, ExpandOnScroll, FadeUp, Parallax } from "@/components/motion/scroll-fx";
import { RevealWords } from "@/components/motion/reveal-words";
import { BOOK_HREF, pillars, site } from "@/content/site";
import { cn } from "@/lib/utils";

// Everything said here comes from the company profile. No client names, figures or
// testimonials until NBSS supplies real ones.

const pill =
  "group inline-flex h-11 items-center gap-2 rounded-full pr-4 pl-5 text-sm font-medium transition-transform duration-[120ms] ease-quick hover:scale-[1.03] active:scale-[0.98]";

/* ---------------------------------------------------------------- aerial */

export function AerialSection() {
  return (
    <section aria-labelledby="aerial-title" className="bg-subtle pt-24 sm:pt-32">
      <FadeUp className="mx-auto max-w-3xl px-4 text-center">
        <h2 id="aerial-title" className="display-section text-[clamp(1.75rem,4vw,3.25rem)] text-foreground">
          From the first site visit to the night shift,{" "}
          <span className="text-secondary-fg">with verified guards, clear costs and a supervisor who answers the phone.</span>
        </h2>
      </FadeUp>
      <ExpandOnScroll className="relative mt-14 h-[82svh] min-h-[420px]">
        <Image data-zoom src="/img/nbss/parade-ranks.jpg" alt="NBSS guards standing in ranks on the parade ground" fill sizes="100vw" className="object-cover" />
      </ExpandOnScroll>
    </section>
  );
}

/* ------------------------------------------------------------- statement */

const strip = [
  { src: "/img/nbss/training-briefing.jpg", alt: "A training briefing" },
  { src: "/img/ops-control-room.jpg", alt: "A control room" },
  { src: "/img/nbss/guards-on-duty.jpg", alt: "Guards on duty" },
  { src: "/img/ops-fire-training.jpg", alt: "Fire safety training" },
  { src: "/img/nbss/training-classroom.jpg", alt: "Guards in a classroom session" },
];

export function StatementSection() {
  return (
    <section aria-label="What we stand for" className="overflow-hidden bg-subtle py-24 sm:py-32">
      <Drift distance={160} className="flex justify-center gap-3 sm:gap-5">
        {strip.map((img) => (
          <div key={img.src} className="relative h-28 w-40 shrink-0 -skew-x-[18deg] overflow-hidden rounded-md sm:h-40 sm:w-60">
            <Image src={img.src} alt={img.alt} fill sizes="240px" className="scale-125 skew-x-[18deg] object-cover" />
          </div>
        ))}
      </Drift>
      <RevealWords
        className="mx-auto mt-16 max-w-3xl px-4 text-center text-[clamp(1.25rem,2.6vw,2rem)] leading-[1.35] tracking-[-0.015em] text-foreground"
        segments={[
          { text: "It is about a gate that is never left open.", strong: true },
          { text: " A guard who knows the neighbourhood. A supervisor awake at three in the morning, and a replacement already on the way." },
          { text: " That is what we provide.", strong: true },
        ]}
      />
    </section>
  );
}

/* ----------------------------------------------------------------- help */

const help = [
  {
    word: "Guard",
    href: "/services",
    image: "/img/nbss/guards-on-duty.jpg",
    body: "Trained, uniformed guards for schools, hospitals, government offices, banks, hotels, malls, factories and construction sites.",
  },
  {
    word: "Protect",
    href: "/services/event-vip-protection",
    image: "/img/nbss/parade-night.jpg",
    body: "Events, gatherings and VIP movement, with access control and crowd handling planned before the day.",
  },
  {
    word: "Supervise",
    href: "/training",
    image: "/img/ops-control-room.jpg",
    body: "Attendance at the gate on the app, supervision around the clock and a replacement when a guard cannot report.",
  },
];

export function HelpSection() {
  return (
    <section aria-labelledby="help-title" className="bg-ink py-24 text-ink-fg sm:py-32">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-8">
        <div className="grid items-end gap-6 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <p className="text-sm font-semibold text-gold-soft">Services</p>
          <h2 id="help-title" className="display-section text-center text-[clamp(2.25rem,5vw,4.25rem)]">
            How NBSS
            <br />
            Can Help You
          </h2>
          <span />
        </div>
        <ul className="mt-16 border-t border-white/10">
          {help.map((h, i) => (
            <li key={h.word} className="border-b border-white/10">
              <Link
                href={h.href}
                className="group relative grid items-center gap-6 overflow-hidden py-10 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:py-12"
              >
                <Image
                  src={h.image}
                  alt=""
                  fill
                  sizes="100vw"
                  className="object-cover opacity-0 transition-opacity duration-[320ms] ease-soft group-hover:opacity-35 group-focus-visible:opacity-35"
                />
                <div className="relative flex gap-4">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full text-[11px] tabular-nums ring-1 ring-ink-fg/40">{i + 1}</span>
                  <p className="max-w-sm text-[15px] text-ink-fg/75">{h.body}</p>
                </div>
                <span className="display-hero relative text-[clamp(3.5rem,11vw,9rem)] transition-transform duration-[320ms] ease-soft group-hover:translate-x-3">
                  {h.word}
                </span>
                <ArrowRight
                  className="relative hidden size-14 -translate-x-4 opacity-0 transition-[opacity,translate] duration-[320ms] ease-soft group-hover:translate-x-0 group-hover:opacity-100 sm:block"
                  strokeWidth={1.25}
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
        <RevealWords
          className="mt-16 max-w-2xl text-[clamp(1.25rem,2.4vw,1.875rem)] leading-[1.3] tracking-[-0.015em]"
          dim={0.25}
          segments={[
            { text: "Every guard is police-verified and trained,", strong: true },
            { text: " and every site has a supervisor who checks on it day and night." },
          ]}
        />
        <Link href="/services" className={cn(pill, "mt-8 bg-ink-fg text-ink")}>
          Explore our services
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ why */

export function WhySection() {
  return (
    <section aria-labelledby="why-title" className="bg-subtle py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-4 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="flex flex-col justify-between gap-10">
          <p className="eyebrow">Why NBSS</p>
          <Parallax speed={22} className="relative hidden aspect-[3/4] w-48 rounded-md lg:block">
            <div className="absolute inset-[-12%]">
              <Image src="/img/ops-drill.jpg" alt="Guards at drill" fill sizes="200px" className="object-cover" />
            </div>
          </Parallax>
        </div>
        <div>
          <FadeUp>
            <h2 id="why-title" className="display-section text-[clamp(2.25rem,5vw,4.25rem)]">
              Trained. Uniformed. <span className="text-secondary-fg">Accountable.</span>
            </h2>
          </FadeUp>
          <Parallax speed={14} className="relative mt-10 aspect-[16/10] rounded-md">
            <div className="absolute inset-[-8%]">
              <Image src="/img/nbss/training-demo.jpg" alt="A training demonstration" fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
            </div>
          </Parallax>
          <ul className="mt-10 divide-y divide-border border-y border-border">
            {pillars.map((p) => (
              <li key={p.title} className="grid gap-1 py-5 sm:grid-cols-[16rem_minmax(0,1fr)] sm:gap-6">
                <span className="font-medium">{p.title}</span>
                <span className="text-secondary-fg">{p.body}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ cta */

export function CtaSection() {
  return (
    <section aria-labelledby="cta-title" className="relative isolate overflow-hidden">
      <Parallax speed={18} className="absolute inset-0 -z-10">
        <div className="absolute inset-[-10%]">
          <Image src="/img/nbss/parade-salute.jpg" alt="" fill sizes="100vw" className="object-cover" />
        </div>
      </Parallax>
      <div className="absolute inset-0 -z-10 bg-ink/60" />
      <div className="mx-auto flex min-h-[80svh] max-w-4xl flex-col items-center justify-center px-4 py-24 text-center text-ink-fg">
        <h2 id="cta-title" className="display-section text-[clamp(2.25rem,5.5vw,4.75rem)]">
          You Name the Site.
          <br />
          We Will Guard It.
        </h2>
        <p className="mt-5 max-w-lg text-lg text-ink-fg/75">{site.hours[1]}. Sign in with your email and book guards in two minutes.</p>
        <Link href={BOOK_HREF} className={cn(pill, "mt-8 bg-ink-fg text-ink")}>
          Book guards
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
