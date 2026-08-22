"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { Shot } from "@/components/blocks";
import { Icon } from "@/components/Icon";
import type { Photo } from "@/content/gallery";

/**
 * The gallery mosaic plus its full-view lightbox.
 *
 * The grid itself is the same `Shot` used on the homepage and the training
 * page — the only difference here is that each frame gets an overlay button
 * that opens the photograph at full size. Keeping the frame markup shared
 * means the duotone grade, the tall spans and the caption reveal stay in one
 * place in the stylesheet.
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
      <div className="mosaic">
        {photos.map((p, i) => (
          <Shot key={p.src} photo={p} index={i} sizes={sizes} onOpen={() => openAt(i)} />
        ))}
      </div>

      {photo && (
        <div
          className="lb"
          role="dialog"
          aria-modal="true"
          aria-label={`Photograph ${open! + 1} of ${photos.length} — ${photo.caption}`}
          /* Only a click that lands on the veil itself closes; one that lands
             on the photograph or a control bubbles up from a child and is
             ignored. */
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="lb__panel" ref={panel} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div className="lb__bar">
              <p className="lb__count">
                {open! + 1} / {photos.length}
              </p>
              <button type="button" className="lb__x" onClick={close} aria-label="Close full view">
                <Icon name="close" />
              </button>
            </div>

            <div className="lb__stage">
              <Image
                key={photo.src}
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(max-width: 900px) 100vw, 85vw"
                className="lb__img"
                priority
              />

              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    className="lb__nav lb__nav--prev"
                    onClick={() => step(-1)}
                    aria-label="Previous photograph"
                  >
                    <Icon name="arrow" />
                  </button>
                  <button
                    type="button"
                    className="lb__nav lb__nav--next"
                    onClick={() => step(1)}
                    aria-label="Next photograph"
                  >
                    <Icon name="arrow" />
                  </button>
                </>
              )}
            </div>

            <figcaption className="lb__cap">
              <span className="lb__capt">{photo.caption}</span>
              <span className="lb__credit">
                {photo.licence ? `${photo.credit} · ${photo.licence}` : photo.credit}
              </span>
            </figcaption>
          </div>
        </div>
      )}
    </>
  );
}
