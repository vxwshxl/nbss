import { Check } from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

/**
 * The numbered mono eyebrow, on its own.
 *
 * `SectionHead` renders one already; this is for the places that need the
 * marker without a heading under it — a form panel, a sidebar block — so the
 * dossier numbering stays consistent instead of being re-typed as a `<p>` with
 * approximately the right classes.
 */
export function Eyebrow({
  num,
  text,
  className,
}: {
  num: React.ReactNode;
  text: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-3 font-mono text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase",
        className,
      )}
    >
      <span className="text-primary">{num}</span>
      <span aria-hidden className="h-px w-8 bg-app-line" />
      {text}
    </p>
  );
}

/**
 * A list where every item is a thing the contract actually covers.
 *
 * The tick is `aria-hidden` and the list is a plain `<ul>`: a screen reader
 * announcing "check mark" before each of nine scope items is reading the
 * decoration, not the scope.
 */
export function TickList({
  items,
  className,
  columns = 1,
}: {
  items: string[];
  className?: string;
  columns?: 1 | 2;
}) {
  return (
    <ul
      className={cn(
        "flex flex-col gap-2.5",
        columns === 2 && "sm:grid sm:grid-cols-2 sm:gap-x-6",
        className,
      )}
    >
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed">
          <span
            aria-hidden
            className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
          >
            <Check className="size-3" strokeWidth={3} />
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * A silent, looping clip of the agency's own footage.
 *
 * `muted` + `playsInline` + `loop` is the only combination that autoplays on
 * iOS at all, and `preload="none"` with a poster means a visitor on mobile data
 * downloads a still rather than several megabytes of parade they did not ask
 * for. Controls are offered rather than hidden: a video that plays itself and
 * cannot be stopped is the thing `prefers-reduced-motion` exists to prevent, so
 * the clip is also pausable by anyone who wants it to stop.
 */
export function VideoBand({
  src,
  poster,
  caption,
  className,
}: {
  src: string;
  poster: string;
  caption?: string;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-2xl border border-app-line-soft bg-card shadow-card",
        className,
      )}
    >
      <video
        className="aspect-video w-full object-cover"
        src={src}
        poster={poster}
        preload="none"
        controls
        muted
        loop
        playsInline
      />
      {caption && (
        <figcaption className="border-t border-app-line-soft px-4 py-3 text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * A bordered aside — "typically deployed at", "included on every contract".
 *
 * `tone="accent"` is for the one panel per page that is the offer rather than
 * context. More than one accented panel on a screen and neither reads as the
 * important one.
 */
export function Panel({
  title,
  children,
  tone = "plain",
  className,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  tone?: "plain" | "accent";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        tone === "accent"
          ? "border-primary/25 bg-primary/5"
          : "border-app-line-soft bg-card shadow-card",
        className,
      )}
    >
      {title && (
        <h3 className="mb-3 text-[11px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

/** A staggered wrapper, for a list of panels or cards that arrives together. */
export function RevealList({
  children,
  className,
}: {
  children: React.ReactNode[];
  className?: string;
}) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <Reveal key={i} delay={Math.min(i, 8) * 60}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}
