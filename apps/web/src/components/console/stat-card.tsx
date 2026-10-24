import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardSurface, type Hue } from "@/components/crm/ui";
import { toneFor, type Tone } from "@/lib/ui/tones";

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
  // The dashboard's tile (components/crm/stat.tsx): the colour in a solid icon tile and
  // a corner of soft shapes, so every page's figures read the same as the dashboard's.
  const hue = HUE[tone ?? toneFor(label)] ?? "jade";

  const body = (
    <>
      <span aria-hidden className={cn("pointer-events-none absolute -top-8 -right-8 size-28 rotate-[18deg] rounded-[30px] transition-transform duration-500 group-hover/stat:rotate-[30deg]", hero ? "bg-white/12" : "bg-[var(--h-soft)]")} />
      <span aria-hidden className={cn("pointer-events-none absolute top-10 -right-3 size-12 rounded-full border-[6px]", hero ? "border-white/15" : "border-[color-mix(in_oklab,var(--h)_16%,transparent)]")} />
      <span className="relative flex items-center gap-2.5">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", hero ? "bg-white/18 text-white" : "bg-[var(--h)] text-white shadow-[0_6px_16px_-8px_var(--h)]")}>
          <Icon className="size-[18px]" strokeWidth={2} />
        </span>
        <span className={cn("text-[13px] leading-tight font-medium", hero ? "text-white/85" : "text-secondary-fg")}>{label}</span>
      </span>
      <span className="relative mt-4 block flex-1">
        <span className="block text-[clamp(1.3rem,5cqi,1.95rem)] leading-none font-semibold tracking-[-0.03em] tabular-nums">{value}</span>
        {hint && <span className={cn("mt-2.5 block text-[12px] font-medium", hero ? "text-white/85" : "text-secondary-fg")}>{hint}</span>}
      </span>
      {href && (
        <span className={cn("relative mt-3 inline-flex items-center gap-1.5 text-sm font-semibold", hero ? "text-white" : "text-[var(--h-deep)]")}>
          {cta ?? "View"}
          <ArrowRight className="size-4 transition-transform group-hover/stat:translate-x-0.5 motion-reduce:transition-none" strokeWidth={2} />
        </span>
      )}
    </>
  );

  const className = cn(
    `hue-${hue}`,
    "group/stat @container relative flex flex-col overflow-hidden p-4 print:shadow-none",
    hero
      ? "rounded-[24px] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--h)_82%,white),var(--h)_55%,var(--h-deep))] text-white shadow-[0_18px_36px_-18px_var(--h)]"
      : cardSurface,
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(className, "press transition-[transform,box-shadow] hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none")}
      >
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

/** The console's tones mapped onto the dashboard's six hues. */
const HUE: Partial<Record<Tone, Hue>> = {
  emerald: "jade",
  teal: "teal",
  sky: "sky",
  indigo: "sky",
  violet: "plum",
  rose: "brick",
  amber: "gold",
  slate: "teal",
};
