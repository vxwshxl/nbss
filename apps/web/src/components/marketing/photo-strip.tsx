import Image from "next/image";

import { Reveal } from "@/components/marketing/reveal";
import type { Photo } from "@/content/gallery";
import { cn } from "@/lib/utils";

/**
 * A row of the agency's own photographs.
 *
 * Shown in full colour, with a slow zoom on hover — the same treatment the
 * service cards use.
 *
 * `sizes` is not a guess here: these render six-up on a wide screen and two-up
 * on a phone, so a browser told `100vw` would download six full-width images
 * for a strip that is 180px tall.
 */
export function PhotoStrip({
  photos,
  className,
}: {
  photos: Photo[];
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6", className)}>
      {photos.map((photo, i) => (
        <Reveal key={photo.src} delay={Math.min(i, 6) * 50}>
          <figure className="group/shot relative aspect-square overflow-hidden rounded-xl border border-app-line-soft bg-muted">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
              className={cn(
                "object-cover transition-[scale] duration-700 ease-out-strong",
                "group-hover/shot:scale-[1.06]",
                "motion-reduce:transition-none motion-reduce:group-hover/shot:scale-100",
              )}
            />
            {/* Caption on hover only. Six captions permanently on screen is a
                wall of small type; the alt text carries the same information
                to anyone who cannot hover. */}
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/85 to-transparent p-3 text-[11px] leading-snug text-white opacity-0 transition-[translate,opacity] duration-300 ease-out-strong group-hover/shot:translate-y-0 group-hover/shot:opacity-100 motion-reduce:transition-none">
              {photo.caption}
            </figcaption>
          </figure>
        </Reveal>
      ))}
    </div>
  );
}
