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
  hero = false,
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
  /** The one solid card at the head of a dashboard, as birdev's console has it. */
  hero?: boolean;
}) {
  const t = TONES[tone ?? toneFor(label)];

  const body = (
    <>
      {hero && (
        <span aria-hidden className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full border-[18px] border-white/10" />
      )}
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          hero ? "bg-white/15 text-white" : t.chip,
        )}
      >
        <Icon className="size-5" strokeWidth={1.9} />
      </span>
      <div className="mt-4 flex-1">
        <p className={cn("text-sm font-medium", hero ? "text-white/80" : "text-muted-foreground")}>{label}</p>
        <p className="mt-0.5 font-display text-4xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        {hint && <p className={cn("mt-1 text-xs", hero ? "text-white/75" : "text-muted-foreground")}>{hint}</p>}
      </div>
      {href && (
        // Spelled out rather than left to the cursor: on a touch screen there
        // is no cursor to change, and a card that silently happens to be a link
        // is a card nobody taps.
        <span className={cn("mt-4 inline-flex items-center gap-1.5 text-sm font-semibold", hero ? "text-white" : "text-primary")}>
          {cta ?? "View"}
          <ArrowRight
            className="size-4 transition-transform group-hover/stat:translate-x-0.5 motion-reduce:transition-none"
            strokeWidth={2}
          />
        </span>
      )}
    </>
  );

  const className = cn(
    "relative flex flex-col overflow-hidden rounded-2xl p-5 print:shadow-none",
    hero
      ? "bg-[linear-gradient(135deg,#0f9f6e,#047857_60%,#065f46)] text-white shadow-[0_18px_40px_-18px_rgb(4_120_87/0.7)]"
      : "border border-app-line-soft bg-card shadow-card",
  );

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
