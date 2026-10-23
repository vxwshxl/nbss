"use client";

import {
  ArrowUpRight,
  Banknote,
  ClipboardCheck,
  Layers,
  MapPin,
  MessageCircleQuestion,
  Plus,
  Radio,
  Target,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { FadeUp } from "@/components/motion/scroll-fx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { faqs, pillars } from "@/content/site";

const ICONS: Record<string, LucideIcon> = {
  drill: Target,
  "clipboard-check": ClipboardCheck,
  radio: Radio,
  layers: Layers,
  rupee: Banknote,
  roots: MapPin,
};

/**
 * Why NBSS, as a dark bento: the six pillars as cards, the training photo standing two
 * rows tall beside them, and the ninth cell opens the questions in a side sheet. The FAQ
 * used to be its own long section here; the full list (and its structured data) lives on
 * /contact, so the home page only offers it on demand.
 */
export function WhySection() {
  return (
    <section aria-labelledby="why-title" className="relative isolate overflow-hidden bg-ink py-24 text-ink-fg sm:py-32">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(50%_40%_at_15%_0%,rgb(16_185_129/0.18),transparent_70%),radial-gradient(40%_35%_at_95%_100%,rgb(20_184_166/0.14),transparent_70%)]" />
      <div aria-hidden className="bg-grid absolute inset-0 -z-10 opacity-[0.05]" />

      <div className="mx-auto max-w-[1280px] px-4 sm:px-8">
        <FadeUp className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end">
          <div>
            <p className="text-sm font-semibold text-emerald-300">Why NBSS</p>
            <h2 id="why-title" className="display-section mt-4 text-[clamp(2.25rem,5vw,4.25rem)]">
              Trained. Uniformed. <span className="text-emerald-300">Accountable.</span>
            </h2>
          </div>
          <p className="max-w-md text-lg text-ink-fg/65 lg:justify-self-end">
            Six promises we are held to on every posting, from the first day of training to the last
            shift change.
          </p>
        </FadeUp>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FadeUp className="relative min-h-[320px] overflow-hidden rounded-3xl ring-1 ring-white/10 sm:col-span-2 lg:col-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-1">
            <Image
              src="/img/nbss/training-demo.jpg"
              alt="An NBSS training demonstration"
              fill
              sizes="(min-width: 1024px) 400px, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgb(6_17_13/0.85),transparent_55%)]" />
            <p className="absolute inset-x-6 bottom-6 font-display text-2xl leading-tight font-bold">
              Drilled on the ground <span className="text-emerald-300">before the gate.</span>
            </p>
          </FadeUp>

          {pillars.map((p, i) => {
            const Icon = ICONS[p.icon] ?? ClipboardCheck;
            return (
              <FadeUp key={p.title} delay={(i % 3) * 0.06} className="h-full">
                <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 transition-colors duration-200 hover:bg-white/[0.07] sm:p-7">
                  <span aria-hidden className="absolute -top-4 right-4 font-display text-[5.5rem] leading-none font-extrabold text-white/[0.05] transition-colors group-hover:text-emerald-300/10">
                    {p.index}
                  </span>
                  <span className="grid size-11 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/20">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-6 text-lg font-semibold">{p.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-fg/60">{p.body}</p>
                </article>
              </FadeUp>
            );
          })}

          <FadeUp delay={0.12} className="h-full">
            <FaqSheet />
          </FadeUp>
        </div>
      </div>
    </section>
  );
}

function FaqSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="group flex h-full w-full flex-col justify-between gap-8 rounded-3xl bg-emerald-400 p-6 text-left text-ink transition-transform duration-200 hover:-translate-y-0.5 sm:p-7"
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-ink/10">
            <MessageCircleQuestion className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block font-display text-2xl leading-tight font-bold">Still have questions?</span>
            <span className="mt-2 flex items-center gap-1.5 text-[15px] font-medium text-ink/70">
              {faqs.length} answers, one tap away
              <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
            </span>
          </span>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border p-6">
          <SheetTitle className="font-display text-2xl font-bold">Questions, answered</SheetTitle>
          <SheetDescription>
            Not here?{" "}
            <Link href="/contact" className="font-medium text-primary-ink hover:underline">
              Ask us directly
            </Link>
            .
          </SheetDescription>
        </SheetHeader>
        <div className="divide-y divide-border px-6 pb-10">
          {faqs.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <Plus className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45" aria-hidden />
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-secondary-fg">{f.a}</p>
            </details>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
