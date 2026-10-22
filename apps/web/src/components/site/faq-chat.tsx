"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Faq = { q: string; a: string };

// The FAQ as a conversation. The visitor asks (right, ink); NBSS answers
// (left, with the logo), one bubble at a time after a short "typing" pause. Each exchange plays
// when it scrolls into view and resets once it drops below the screen again, so scrolling back
// down replays it. Hidden bubbles keep their space (no scroll jumps). The text is always in the
// HTML for crawlers; with reduced motion or no JavaScript everything simply shows.

/** Splits an answer into message-sized bubbles at sentence ends ("Pvt. Ltd." stays whole). */
function bubbles(answer: string) {
  const sentences = answer.split(/(?<=[a-z0-9)]{2}[.!?])(?<!\b(?:Pvt|Ltd|No|Rd|St|Dr|Mr)\.)\s+(?=[A-Z])/);
  const out: string[] = [];
  for (const s of sentences) {
    const last = out.at(-1);
    if (last && (last.length + s.length < 140 || out.length === 3)) out[out.length - 1] = `${last} ${s}`;
    else out.push(s);
  }
  return out;
}

const TYPING_MS = 350; // the dots appear…
const FIRST_MS = 1050; // …and give way to the first answer bubble
const NEXT_MS = 650; // each further bubble

function Exchange({ item }: { item: Faq }) {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(-1); // -1 hidden · 0 question · 1 typing · 2+ answers shown
  const parts = bubbles(item.a);
  const count = parts.length;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timers: number[] = [];
    const clear = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        if (e.isIntersecting) {
          if (timers.length) return;
          const at = (ms: number, s: number) => timers.push(window.setTimeout(() => setStep((cur) => Math.max(cur, s)), ms));
          at(0, 0);
          at(TYPING_MS, 1);
          for (let i = 0; i < count; i++) at(FIRST_MS + i * NEXT_MS, 2 + i);
        } else if (e.boundingClientRect.top > 0) {
          // Left through the bottom (the reader scrolled back up): reset for a replay.
          clear();
          setStep(-1);
        }
      },
      { threshold: 0.25, rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clear();
    };
  }, [count]);

  return (
    <div ref={ref} className="grid gap-2">
      <h3
        className={cn(
          "faq-bubble faq-from-right w-fit max-w-[85%] justify-self-end rounded-[22px] rounded-br-md bg-ink px-5 py-3 text-[15px] leading-snug font-medium text-ink-fg sm:max-w-[75%]",
          step >= 0 && "is-in",
        )}
      >
        {item.q}
      </h3>
      <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-3">
        <Image src="/logo/nbss-128.webp" alt="NBSS" width={36} height={36} unoptimized className={cn("faq-bubble faq-from-left mt-1 size-9 self-start rounded-full bg-elevated p-1 shadow-e1", step >= 1 && "is-in")} />
        <div className="relative grid min-w-0 gap-2">
          <div aria-hidden className={cn("faq-typing absolute top-0 left-0 flex w-fit gap-1.5 rounded-[22px] rounded-tl-md bg-elevated px-4 py-4 shadow-e1", step === 1 ? "is-in" : "hidden")}>
            <span />
            <span />
            <span />
          </div>
          {parts.map((b, i) => (
            <p
              key={i}
              className={cn(
                "faq-bubble faq-from-left w-fit max-w-[95%] rounded-[22px] bg-elevated px-5 py-3 text-[15px] leading-relaxed shadow-e1 ring-1 ring-border sm:max-w-[88%]",
                i === 0 && "rounded-tl-md",
                step >= 2 + i && "is-in",
              )}
            >
              {b}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FaqChat({ items }: { items: Faq[] }) {
  return (
    <div className="grid gap-10">
      {items.map((f) => (
        <Exchange key={f.q} item={f} />
      ))}
    </div>
  );
}
