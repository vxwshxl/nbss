"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Photo } from "@/content/gallery";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger, useGSAP);


/**
 * Two rows of photos that drift in opposite directions as the page scrolls (scrubbed by GSAP),
 * each tile easing up into place as it arrives. Tap a photo to see it full screen; arrows, swipe
 * and the keyboard move through them.
 */
export function GalleryReel({ photos }: { photos: Photo[] }) {
  const root = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  // Enough tiles that both rows span the screen while drifting, repeating if there are few photos.
  const pool = photos.length >= 8 ? photos : Array.from({ length: Math.ceil(8 / photos.length) }, () => photos).flat();
  const half = Math.ceil(pool.length / 2);
  const rows = [pool.slice(0, half), pool.slice(half).length ? pool.slice(half) : pool.slice(0, half)];

  useGSAP(
    () => {
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>("[data-row]").forEach((row, i) => {
          gsap.fromTo(row, { xPercent: i ? -18 : 0 }, { xPercent: i ? 0 : -18, ease: "none", scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: 0.8 } });
        });
        gsap.from("[data-tile]", { y: 60, opacity: 0, scale: 0.94, duration: 0.9, ease: "power3.out", stagger: 0.05, scrollTrigger: { trigger: root.current, start: "top 80%" } });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="gallery-title" className="overflow-hidden bg-subtle py-24 sm:py-32">
      <div className="mx-auto mb-12 max-w-3xl px-4 text-center">
        <p className="eyebrow">Gallery</p>
        <h2 id="gallery-title" className="display-section mt-3 text-[clamp(1.75rem,4vw,3.25rem)] text-foreground">
          On parade, in training, <span className="text-secondary-fg">and at home in Bodoland.</span>
        </h2>
      </div>
      <div className="grid gap-4 sm:gap-6">
        {rows.map((row, r) => (
          <div key={r} data-row className={cn("flex w-max gap-4 sm:gap-6", r ? "-ml-[10vw]" : "ml-[4vw]")}>
            {row.map((p, k) => {
              const index = photos.findIndex((x) => x.src === p.src);
              return (
                <button
                  key={`${p.src}-${k}`}
                  data-tile
                  type="button"
                  onClick={() => setOpen(index)}
                  className="group relative h-56 w-80 shrink-0 overflow-hidden rounded-2xl bg-muted shadow-e1 sm:h-72 sm:w-[26rem]"
                  aria-label={p.caption ?? "Open photo"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt={p.alt} loading="lazy" className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
                  {p.caption && (
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pt-10 pb-3 text-left text-[14px] font-medium text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      {p.caption}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {open !== null && <Lightbox photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </section>
  );
}

function Lightbox({ photos, index, onIndex, onClose }: { photos: Photo[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const p = photos[index]!;
  const go = useCallback((d: number) => onIndex((index + d + photos.length) % photos.length), [index, onIndex, photos.length]);
  const touch = useRef(0);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", key);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.caption ?? "Photo"}
      className="fixed inset-0 z-[95] flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? 0)}
      onTouchEnd={(e) => {
        const dx = (e.changedTouches[0]?.clientX ?? 0) - touch.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-[13px] text-white/70 tabular-nums">
          {index + 1} / {photos.length}
        </span>
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 place-items-center rounded-full hover:bg-white/10">
          <X className="size-5" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={p.src} src={p.src} alt={p.alt} className="max-h-full max-w-full animate-in rounded-lg object-contain duration-300 fade-in-0 zoom-in-95" />
        {photos.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous" className="absolute left-3 grid size-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:left-6">
              <ChevronLeft className="size-6" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next" className="absolute right-3 grid size-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:right-6">
              <ChevronRight className="size-6" />
            </button>
          </>
        )}
      </div>
      {p.caption && <p className="px-6 pb-8 text-center text-[15px] text-white/85">{p.caption}</p>}
    </div>
  );
}
