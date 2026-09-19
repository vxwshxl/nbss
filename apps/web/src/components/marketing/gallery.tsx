"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";

import type { Photo } from "@/content/gallery";
import { cn } from "@/lib/utils";

/**
 * The gallery mosaic plus its full-view lightbox.
 *
 * The frames carry the same duotone grade as `PhotoStrip`, lifting to full
 * colour on hover — the source photographs are a mix of the agency's own and
 * licensed stock, and one treatment across all of them turns that
 * inconsistency into an intent.
 *
 * The open photograph is addressed by index rather than by object, because
 * every control on the panel is really "move the index": the arrows, the
 * arrow keys and the swipe all wrap around the ends of the filtered set.
 */
export function GalleryMosaic({
  photos,
  sizes = "(max-width: 700px) 100vw, 30vw",
}: {
  photos: Photo[];
  sizes?: string;
}) {
  /** `null` is closed. */
  const [open, setOpen] = useState<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  /** The frame that opened the lightbox, so focus can go back where it was. */
  const opener = useRef<HTMLElement | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpen((i) => (i === null ? i : (i + delta + photos.length) % photos.length)),
    [photos.length],
  );

  const openAt = (i: number) => {
    opener.current = document.activeElement as HTMLElement | null;
    setOpen(i);
  };

  /* Keys, and the scroll lock, live for exactly as long as the panel does. */
  useEffect(() => {
    if (open === null) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "Tab") {
        // A small trap: the panel holds four controls at most, so keeping the
        // ring inside it is a matter of bouncing off the first and the last.
        const stops = panel.current?.querySelectorAll<HTMLElement>("button");
        const first = stops?.[0];
        const last = stops?.[stops.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const { overflow, paddingRight } = document.body.style;
    document.body.style.overflow = "hidden";
    // Compensating for the vanished scrollbar stops the page behind the veil
    // from jolting sideways as the lightbox opens.
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [open, close, step]);

  /* Opening moves focus into the panel; closing hands it back to the frame. */
  useEffect(() => {
    if (open !== null) panel.current?.querySelector("button")?.focus();
    else opener.current?.focus();
  }, [open]);

  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const from = touch.current;
    const t = e.changedTouches[0];
    touch.current = null;
    if (!from || !t) return;
    const dx = t.clientX - from.x;
    const dy = t.clientY - from.y;
    // Horizontal intent only — a diagonal drag is not a page turn.
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  };

  const photo = open === null ? null : photos[open];

  return (
    <>
      {/* A masonry-ish mosaic rather than a uniform grid: some of these are
          portrait parade shots and some are wide landscapes, and forcing both
          into one aspect ratio crops the subject out of half of them. */}
      <div className="grid auto-rows-[180px] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p, i) => (
          <figure
            key={p.src}
            className={cn(
              "group/shot relative overflow-hidden rounded-xl border border-app-line-soft bg-muted",
              p.tall && "row-span-2",
            )}
          >
            <Image
              src={p.src}
              alt={p.alt}
              fill
              sizes={sizes}
              loading="lazy"
              className={cn(
                "object-cover transition-[filter,scale] duration-700 ease-out-strong",
                "grayscale-[0.55] sepia-[0.15] hue-rotate-[80deg] saturate-[0.85] contrast-[1.05]",
                "group-hover/shot:scale-[1.04] group-hover/shot:grayscale-0 group-hover/shot:sepia-0 group-hover/shot:hue-rotate-0 group-hover/shot:saturate-100",
                "motion-reduce:transition-none motion-reduce:group-hover/shot:scale-100",
              )}
            />

            {/* The whole frame is the button. A small zoom affordance in the
                corner would be a 24px target on a phone; the frame is 180px. */}
            <button
              type="button"
              onClick={() => openAt(i)}
              aria-label={`View “${p.caption}” full size`}
              className="absolute inset-0 flex items-start justify-end p-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-inset"
            >
              <span
                aria-hidden
                className="flex size-8 items-center justify-center rounded-lg bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover/shot:opacity-100 group-focus-visible/shot:opacity-100 motion-reduce:transition-none"
              >
                <Maximize2 className="size-4" strokeWidth={2} />
              </span>
            </button>

            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/90 to-transparent p-3 text-white opacity-0 transition-[translate,opacity] duration-300 ease-out-strong group-hover/shot:translate-y-0 group-hover/shot:opacity-100 motion-reduce:transition-none">
              <span className="block text-[11px] leading-snug">{p.caption}</span>
              <span className="mt-0.5 block text-[10px] text-white/60">
                {p.licence ? `${p.credit} \u00b7 ${p.licence}` : p.credit}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      {photo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photograph ${open! + 1} of ${photos.length} \u2014 ${photo.caption}`}
          /* Only a click that lands on the veil itself closes; one that lands
             on the photograph or a control bubbles up from a child and is
             ignored. */
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-8"
        >
          <div
            ref={panel}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="flex max-h-full w-full max-w-5xl flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-4 text-white">
              <p className="font-mono text-xs tabular-nums text-white/60">
                {open! + 1} / {photos.length}
              </p>
              <button
                type="button"
                onClick={close}
                aria-label="Close full view"
                className="press flex size-9 items-center justify-center rounded-full bg-white/10 outline-none transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <X className="size-4.5" strokeWidth={2} />
              </button>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-black/40">
              <Image
                key={photo.src}
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(max-width: 900px) 100vw, 85vw"
                className="object-contain"
                priority
              />

              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="Previous photograph"
                    className="press absolute top-1/2 left-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white outline-none backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white/70"
                  >
                    <ChevronLeft className="size-5" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="Next photograph"
                    className="press absolute top-1/2 right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white outline-none backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white/70"
                  >
                    <ChevronRight className="size-5" strokeWidth={2} />
                  </button>
                </>
              )}
            </div>

            <figcaption className="flex flex-col gap-0.5 text-white">
              <span className="text-sm">{photo.caption}</span>
              <span className="text-xs text-white/50">
                {photo.licence ? `${photo.credit} \u00b7 ${photo.licence}` : photo.credit}
              </span>
            </figcaption>
          </div>
        </div>
      )}
    </>
  );
}
