import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Hue = "jade" | "gold" | "sky" | "brick" | "plum" | "teal";

/**
 * A page's head. The top bar already shows the page title (on every screen), so this keeps only
 * the page's actions: on phones and tablets they share the full width equally, on desktop they
 * size to their labels on the right (.action-row in globals.css). Title, subtitle and icon are
 * kept in the signature for the pages that pass them, but aren't drawn.
 */
export function PageHeader({ actions }: { title: string; subtitle?: string; actions?: React.ReactNode; icon?: LucideIcon; hue?: Hue }) {
  if (!actions) return null;
  return <div className="action-row mb-5">{actions}</div>;
}

/** The top of every dashboard: "Hello," and the person's full name. */
export function Hello({ name, note, actions }: { name: string | null | undefined; note?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[15px] font-medium text-secondary-fg">Hello,</p>
        <p className="display-section text-[clamp(1.6rem,3.4vw,2.4rem)] leading-tight">{name?.trim() || "there"}</p>
        {note && <p className="mt-1 text-[14px] text-secondary-fg">{note}</p>}
      </div>
      {actions && <div className="action-row w-full lg:w-auto">{actions}</div>}
    </div>
  );
}

/** The CRM's surface: white, softly lifted off the ground, with a hairline edge. */
export const cardSurface = "rounded-[24px] bg-elevated shadow-[0_0_0_1px_rgb(22_33_27/0.05),0_1px_2px_rgb(22_33_27/0.04),0_12px_32px_-16px_rgb(22_33_27/0.14)]";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("h-full p-4 sm:p-6", cardSurface, className)}>{children}</div>;
}

export function CardTitle({ title, hint, right, icon: Icon, hue = "jade" }: { title: string; hint?: string; right?: React.ReactNode; icon?: LucideIcon; hue?: Hue }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className={cn("flex min-w-0 items-start gap-3", `hue-${hue}`)}>
        {Icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--h-soft)] text-[var(--h-deep)]">
            <Icon className="size-[18px]" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-[-0.015em]">{title}</h2>
          {hint && <p className="mt-0.5 text-[13px] text-secondary-fg">{hint}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

const tones = {
  green: "bg-accent-subtle text-primary",
  gold: "bg-gold/15 text-foreground/80",
  grey: "bg-muted text-secondary-fg",
  red: "bg-danger/10 text-danger",
  ink: "bg-ink text-ink-fg",
};

export function Pill({ tone = "grey", children }: { tone?: keyof typeof tones; children: React.ReactNode }) {
  return <span className={cn("inline-flex h-6 items-center rounded-md px-2 text-[12px] font-medium whitespace-nowrap", tones[tone])}>{children}</span>;
}


/** Plain table on a card; rows highlight on hover. */
export function Table({ head, rows, align = [] }: { head: string[]; rows: React.ReactNode[][]; align?: ("left" | "right")[] }) {
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[560px] text-[14px]">
        <thead>
          <tr className="text-left text-[12px] text-secondary-fg">
            {head.map((h, i) => (
              <th key={h} className={cn("px-2 pb-3 font-medium", align[i] === "right" && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t border-border transition-colors hover:bg-subtle">
              {r.map((c, ci) => (
                <td key={ci} className={cn("px-2 py-3", align[ci] === "right" && "text-right tabular-nums")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
