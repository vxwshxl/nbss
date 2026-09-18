import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONES, toneFor, type Tone } from "@/lib/ui/tones";

// Kept for back-compat with existing call sites that import StatTone.
export type StatTone = Tone;

/**
 * A headline figure on the console dashboards.
 *
 * The card itself is white and the colour lives in the icon chip. It used to be
 * the other way round — a fully tinted surface with a tinted number — and four
 * of those in a row is a paint chart: every tile shouts equally, so the figures,
 * which are the only thing anyone came for, have to compete with their own
 * backgrounds. On a plain surface the number is the loudest thing on the card
 * and the tint still does its real job, which is letting you find the same tile
 * again tomorrow without reading it.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  cta,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  /** When set, the whole card links here. */
  href?: string;
  /** Wording for the visible link at the foot of a linked card. */
  cta?: string;
  /** Override the auto-picked accent colour. */
  tone?: Tone;
}) {
  const t = TONES[tone ?? toneFor(label)];

  const body = (
    <>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          t.chip,
        )}
      >
        <Icon className="size-5" strokeWidth={1.9} />
      </span>
      <div className="mt-4 flex-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-display text-4xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {href && (
        // Spelled out rather than left to the cursor: on a touch screen there
        // is no cursor to change, and a card that silently happens to be a link
        // is a card nobody taps.
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          {cta ?? "View"}
          <ArrowRight
            className="size-4 transition-transform group-hover/stat:translate-x-0.5 motion-reduce:transition-none"
            strokeWidth={2}
          />
        </span>
      )}
    </>
  );

  const className =
    "relative flex flex-col rounded-2xl border border-app-line-soft bg-card p-5 shadow-card print:shadow-none";

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          className,
          "group/stat press transition-shadow hover:shadow-raised focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        )}
      >
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}
