import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CountUp } from "./motion";
import { cardSurface, type Hue } from "./ui";
import { Sparkline } from "./viz";

/**
 * A metric tile in its own hue: a coloured icon tile, the figure (counting up), a note and an
 * optional sparkline, over a corner of soft shapes. `solid` fills the tile with the hue, for
 * the one figure a page leads with. Rows of these replace the plain white KPI boxes.
 */
export function StatTile({
  label,
  value,
  format = "number",
  hue = "jade",
  icon: Icon,
  href,
  note,
  noteTone,
  trend,
  solid = false,
  className,
}: {
  label: string;
  value: number;
  format?: "number" | "inr" | "percent";
  hue?: Hue;
  icon?: LucideIcon;
  href?: string;
  note?: React.ReactNode;
  noteTone?: "up" | "down" | "bad";
  trend?: number[];
  solid?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {/* The corner shapes: a turned square and a ring, in the tile's hue. */}
      <span aria-hidden className={cn("pointer-events-none absolute -top-8 -right-8 size-28 rotate-[18deg] rounded-[30px] transition-transform duration-500 group-hover:rotate-[30deg]", solid ? "bg-white/12" : "bg-[var(--h-soft)]")} />
      <span aria-hidden className={cn("pointer-events-none absolute top-10 -right-3 size-12 rounded-full border-[6px]", solid ? "border-white/15" : "border-[color-mix(in_oklab,var(--h)_16%,transparent)]")} />
      <span className="relative flex items-center gap-2.5">
        {Icon && (
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl sm:size-9", solid ? "bg-white/18 text-white" : "bg-[var(--h)] text-white shadow-[0_6px_16px_-8px_var(--h)]")}>
            <Icon className="size-[18px]" />
          </span>
        )}
        <span className={cn("text-[13px] leading-tight font-medium", solid ? "text-white/85" : "text-secondary-fg")}>{label}</span>
      </span>
      <span className="relative mt-3 flex items-end justify-between gap-2 sm:mt-4">
        <span className={cn("text-[clamp(1.2rem,5cqi,1.85rem)] leading-none font-semibold tracking-[-0.03em]", solid && "text-white")}>
          <CountUp value={value} format={format} />
        </span>
        {trend && trend.length > 1 && <Sparkline values={trend} className={cn("-mb-1 hidden shrink-0 @[15rem]:block", solid && "text-white")} />}
      </span>
      {note && (
        <span className={cn("relative mt-2.5 block text-[12px] font-medium", solid ? "text-white/85" : noteTone === "bad" || noteTone === "down" ? "text-danger" : noteTone === "up" ? "text-[var(--h-deep)]" : "text-secondary-fg")}>{note}</span>
      )}
    </>
  );
  const cls = cn(
    `hue-${hue}`,
    "group @container relative block h-full overflow-hidden p-3.5 transition-[transform,box-shadow] duration-200 sm:p-4",
    solid ? "rounded-[24px] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--h)_82%,white),var(--h)_55%,var(--h-deep))] text-white shadow-[0_18px_36px_-18px_var(--h)]" : cardSurface,
    href && "hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgb(22_33_27/0.06),0_18px_36px_-16px_rgb(22_33_27/0.22)]",
    className,
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Shorthand for "▲ 12% vs last month". */
export function delta(v: number | null, bad = false): { note: string; tone?: "up" | "down" } {
  if (v === null) return { note: "First month on record" };
  const good = v >= 0 !== bad;
  return { note: `${v >= 0 ? "▲" : "▼"} ${Math.abs(v)}% vs last month`, tone: good ? "up" : "down" };
}

const ROW_HUES: Hue[] = ["jade", "sky", "gold", "plum", "teal", "brick"];
const ROW_COLS: Record<number, string> = {
  2: "",
  3: "@3xl:grid-cols-3",
  4: "@4xl:grid-cols-4",
  5: "@3xl:grid-cols-3 @6xl:grid-cols-5",
  6: "@3xl:grid-cols-3 @6xl:grid-cols-6",
};

export type Kpi = { t: string; v: number; f?: "number" | "inr" | "percent"; sub?: string; bad?: boolean; href?: string; icon?: LucideIcon };

/** A page's row of figures as stat tiles: the first filled, the rest in turn through the hues; `bad` ones in brick. */
export function KpiRow({ items, format = "number", className }: { items: Kpi[]; format?: "number" | "inr" | "percent"; className?: string }) {
  return (
    <div className={cn("mb-4 grid grid-cols-2 gap-3 sm:gap-4", ROW_COLS[items.length] ?? ROW_COLS[4], className)}>
      {items.map((k, i) => (
        <StatTile key={k.t} solid={i === 0 && !k.bad} hue={k.bad ? "brick" : ROW_HUES[i % ROW_HUES.length]!} icon={k.icon} label={k.t} value={k.v} format={k.f ?? format} note={k.sub} noteTone={k.bad ? "bad" : undefined} href={k.href} />
      ))}
    </div>
  );
}
