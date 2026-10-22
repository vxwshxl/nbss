"use client";

import { motion } from "framer-motion";
import { useId, useState } from "react";
import { formatInr } from "./format";
import { cn } from "@/lib/utils";
import type { Hue } from "./ui";

// The CRM's charts, drawn in SVG in the hue palette (globals.css .hue-*): a trend with filled
// areas, sparklines for stat tiles, a ring gauge, a donut with its total in the middle and a
// ranked bar list. Every chart animates in once and reads well with no data.

const ease = [0.22, 1, 0.36, 1] as const;
const HUE_VAR: Record<Hue, string> = { jade: "var(--hue-jade)", gold: "var(--hue-gold)", sky: "var(--hue-sky)", brick: "var(--hue-brick)", plum: "var(--hue-plum)", teal: "var(--hue-teal)" };
export const hueColor = (h: Hue) => HUE_VAR[h];

/** Short money for axes: ₹4.2L, ₹1.3Cr. */
export function shortInr(n: number) {
  const a = Math.abs(n);
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`;
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(a >= 1e6 ? 0 : 1)}L`;
  if (a >= 1e3) return `₹${Math.round(n / 1e3)}k`;
  return `₹${Math.round(n)}`;
}

/** A smooth path through points (monotone, so it never overshoots below zero). */
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return pts.length ? `M${pts[0]![0]},${pts[0]![1]}` : "";
  const d: string[] = [`M${pts[0]![0]},${pts[0]![1]}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const cx = (x1 - x0) / 2;
    d.push(`C${x0 + cx},${y0} ${x1 - cx},${y1} ${x1},${y1}`);
  }
  return d.join(" ");
}

/** A tiny trend line with a soft fill, in the tile's hue. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const id = useId();
  const w = 120;
  const h = 40;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * w, h - 4 - (v / max) * (h - 8)] as [number, number]);
  const line = smoothPath(pts);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-10 w-28 text-[var(--h)]", className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {values.length > 1 && (
        <>
          <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
          <motion.path d={line} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease, delay: 0.3 }} vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  );
}

export type Series = { label: string; hue: Hue; values: number[] };

/**
 * Months along the bottom, one filled line per series (billed and spent, billed and collected).
 * Hover a month for its figures.
 */
export function AreaTrend({ labels, series, height = 240, money = true }: { labels: string[]; series: Series[]; height?: number; money?: boolean }) {
  const uid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const pad = { l: 44, r: 12, t: 12, b: 28 };
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const nice = niceMax(max);
  const x = (i: number) => pad.l + (i / Math.max(1, labels.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / nice) * (H - pad.t - pad.b);
  const fmt = (v: number) => (money ? shortInr(v) : String(Math.round(v)));
  const empty = series.every((s) => s.values.every((v) => !v));

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center justify-end gap-4 text-xs text-secondary-fg">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: hueColor(s.hue) }} /> {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height: H }} preserveAspectRatio="none" onMouseLeave={() => setHover(null)} role="img" aria-label={series.map((s) => s.label).join(" and ")}>
        <defs>
          {series.map((s, k) => (
            <linearGradient key={s.label} id={`${uid}-${k}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={hueColor(s.hue)} stopOpacity="0.32" />
              <stop offset="1" stopColor={hueColor(s.hue)} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(nice * t)} y2={y(nice * t)} stroke="currentColor" className="text-border" strokeDasharray={t ? "3 5" : undefined} vectorEffect="non-scaling-stroke" />
            <text x={pad.l - 8} y={y(nice * t) + 4} textAnchor="end" className="fill-secondary-fg text-[10.5px]">
              {fmt(nice * t)}
            </text>
          </g>
        ))}
        {series.map((s, k) => {
          const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
          const line = smoothPath(pts);
          return (
            <g key={s.label}>
              <motion.path d={`${line} L${x(s.values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${uid}-${k})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 + k * 0.15 }} />
              <motion.path d={line} fill="none" stroke={hueColor(s.hue)} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease, delay: 0.2 + k * 0.15 }} />
            </g>
          );
        })}
        {labels.map((l, i) => (
          <g key={l + i}>
            <text x={x(i)} y={H - 8} textAnchor="middle" className={cn("text-[10.5px]", hover === i ? "fill-foreground font-semibold" : "fill-secondary-fg")}>
              {l}
            </text>
            <rect x={x(i) - (W - pad.l - pad.r) / Math.max(1, labels.length - 1) / 2} y={0} width={(W - pad.l - pad.r) / Math.max(1, labels.length - 1)} height={H - pad.b} fill="transparent" onMouseEnter={() => setHover(i)} />
          </g>
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="currentColor" className="text-foreground/25" vectorEffect="non-scaling-stroke" />
            {series.map((s) => (
              <circle key={s.label} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r="5" fill="white" stroke={hueColor(s.hue)} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-8 z-10 -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-[12px] whitespace-nowrap text-ink-fg shadow-e3" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <span className="block font-semibold">{labels[hover]}</span>
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5 text-ink-fg/80">
              <span className="size-2 rounded-full" style={{ background: hueColor(s.hue) }} />
              {s.label} {money ? formatInr(s.values[hover] ?? 0) : s.values[hover]}
            </span>
          ))}
        </div>
      )}
      {empty && <p className="pointer-events-none absolute inset-0 grid place-items-center text-[13px] text-secondary-fg">Nothing recorded yet</p>}
    </div>
  );
}

function niceMax(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** A ring that fills to `value` of 100, with the figure in the middle. */
export function Ring({ value, hue = "jade", size = 132, label, sub }: { value: number; hue?: Hue; size?: number; label?: React.ReactNode; sub?: string }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke={hueColor(hue)} strokeOpacity="0.14" strokeWidth="10" />
        <motion.circle cx="50" cy="50" r={r} fill="none" stroke={hueColor(hue)} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v / 100) }} transition={{ duration: 1.2, ease, delay: 0.2 }} />
      </svg>
      <span className="relative text-center">
        <span className="block text-[22px] leading-none font-semibold tracking-[-0.03em] tabular-nums">{label ?? `${Math.round(v)}%`}</span>
        {sub && <span className="mt-1 block text-[11px] text-secondary-fg">{sub}</span>}
      </span>
    </div>
  );
}

/** Shares of a whole as a ring with gaps between pieces, the total in the middle and a legend. */
export function DonutChart({ data, total: totalLabel, money = true }: { data: { label: string; value: number; hue: Hue }[]; total?: string; money?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((n, d) => n + d.value, 0);
  const r = 40;
  const c = 2 * Math.PI * r;
  const gap = total > 0 && data.filter((d) => d.value > 0).length > 1 ? 2.2 : 0;
  let offset = 0;
  const focus = hover !== null ? data[hover] : null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <div className="relative grid size-44 place-items-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" className="stroke-muted" strokeWidth="13" />
          {total > 0 &&
            data.map((d, i) => {
              if (d.value <= 0) return null;
              const len = (d.value / total) * c;
              const el = (
                <motion.circle
                  key={d.label}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke={hueColor(d.hue)}
                  strokeWidth={hover === i ? 16 : 13}
                  strokeLinecap="butt"
                  strokeDasharray={`${Math.max(0.1, len - gap)} ${c - Math.max(0.1, len - gap)}`}
                  strokeDashoffset={-offset}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: hover === null || hover === i ? 1 : 0.35 }}
                  transition={{ duration: 0.4, delay: hover === null ? 0.2 + i * 0.08 : 0 }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              );
              offset += len;
              return el;
            })}
        </svg>
        <span className="relative max-w-24 text-center">
          <span className="block text-[11px] text-secondary-fg">{focus ? focus.label : "Total"}</span>
          <span className="block text-[17px] leading-tight font-semibold tracking-[-0.02em] tabular-nums">{focus ? (money ? shortInr(focus.value) : focus.value) : (totalLabel ?? (money ? shortInr(total) : total))}</span>
        </span>
      </div>
      <ul className="grid min-w-40 gap-2 text-[13px]">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2.5" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="size-3 shrink-0 rounded-[4px]" style={{ background: hueColor(d.hue) }} />
            <span className="flex-1 truncate">{d.label}</span>
            <span className="font-semibold tabular-nums">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ranked horizontal bars, each in its own hue, value on the right. */
export function BarList({ data, money = true }: { data: { label: string; value: number; hue: Hue; sub?: string }[]; money?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="grid gap-3">
      {data.map((d, i) => (
        <li key={d.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate">
              {d.label}
              {d.sub && <span className="text-secondary-fg"> · {d.sub}</span>}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{money ? formatInr(d.value) : d.value}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <motion.div className="h-full origin-left rounded-full" style={{ width: `${Math.max(d.value ? 3 : 0, (d.value / max) * 100)}%`, background: `linear-gradient(90deg, color-mix(in oklab, ${hueColor(d.hue)} 70%, white), ${hueColor(d.hue)})` }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, ease, delay: 0.15 + i * 0.07 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Columns for counts by category (leads by stage, projects by stage), each in its hue. */
export function Columns({ data, height = 170 }: { data: { label: string; value: number; hue: Hue }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2.5" style={{ height }}>
      {data.map((d, i) => (
        <div key={d.label} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-[12px] font-semibold tabular-nums">{d.value}</span>
          <motion.span
            className="relative block w-full max-w-12 origin-bottom overflow-hidden rounded-t-[10px] rounded-b-[4px]"
            style={{ height: `${Math.max(3, (d.value / max) * 78)}%`, background: `linear-gradient(180deg, ${hueColor(d.hue)}, color-mix(in oklab, ${hueColor(d.hue)} 60%, white))` }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.7, ease, delay: 0.15 + i * 0.06 }}
          >
            <span className="absolute inset-x-0 top-0 h-1/3 bg-white/20" />
          </motion.span>
          <span className="w-full truncate text-center text-[11px] text-secondary-fg">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
