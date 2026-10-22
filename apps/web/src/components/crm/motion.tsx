"use client";

import { AnimatePresence, animate, motion, useInView, useReducedMotion, type Variants } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { formatInr } from "./format";
import { cn } from "@/lib/utils";

const ease = [0.05, 0.7, 0.1, 1] as const;

/** Page heading: words come up out of a blur, one after another. */
export function BlurTitle({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <h1 className={className} aria-label={text}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          aria-hidden
          className="inline-block whitespace-pre"
          initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.55, ease, delay: 0.05 + i * 0.06 }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </h1>
  );
}

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } } };
const child: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease } },
};

/** Cards rise in one after another. Wrap a grid in <Stagger>, each card in <Item>. */
export function Stagger({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <motion.div className={className} variants={container} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

export function Item({ className, children, hover = false }: { className?: string; children: React.ReactNode; hover?: boolean }) {
  return (
    <motion.div className={className} variants={child} whileHover={hover ? { y: -3 } : undefined} transition={{ type: "spring", stiffness: 380, damping: 28 }}>
      {children}
    </motion.div>
  );
}

/** Counts up to `value` when it comes into view. */
// Last value each counter showed, by page and position, so a revisit (or a background refresh)
// counts on from the old number to the new one instead of starting at zero.
const lastShown = new Map<string, number>();

/** A number that counts to `value`: 1 → 2 → 3 → 4 → 5, from whatever it showed last. */
export function CountUp({ value, format = "number", className }: { value: number; format?: "number" | "inr" | "percent"; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const key = `${usePathname()}#${useId()}`;
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [n, setN] = useState(() => (reduce ? value : (lastShown.get(key) ?? 0)));
  const current = useRef(n);

  useEffect(() => {
    if (!inView) return;
    if (reduce || current.current === value) {
      current.current = value;
      setN(value);
      lastShown.set(key, value);
      return;
    }
    const steps = Math.abs(value - current.current);
    const c = animate(current.current, value, {
      duration: Math.min(1.4, 0.35 + steps * 0.12),
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        current.current = v;
        setN(v);
      },
      onComplete: () => lastShown.set(key, value),
    });
    return () => {
      c.stop();
      lastShown.set(key, current.current);
    };
  }, [inView, value, reduce, key]);

  const text = format === "inr" ? formatInr(n) : format === "percent" ? `${Math.round(n)}%` : Math.round(n).toLocaleString("en-IN");
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {text}
    </span>
  );
}

/** A bar that fills to `value`% on first view. */
export function Progress({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-muted", className)}>
      <motion.div
        className={cn("h-full origin-left rounded-full bg-primary", barClassName)}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: value / 100 }}
        transition={{ duration: 1, ease, delay: 0.2 }}
        style={{ width: "100%" }}
      />
    </div>
  );
}

/**
 * Stacked bars (hatched income over solid expense) that grow up from the axis in sequence.
 * Hover a month for its figures; click to pin it and see the margin underneath.
 */
export function Bars({
  data,
  max,
  height = 200,
  labels = ["Income", "Expense"],
}: {
  data: { label: string; a: number; b: number }[];
  max: number;
  height?: number;
  labels?: [string, string];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const focus = hover ?? pinned;
  const sel = pinned !== null ? data[pinned] : null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-4 text-xs text-secondary-fg">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" /> {labels[0]}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-ink" /> {labels[1]}
        </span>
      </div>
      <div className="relative flex items-end justify-between gap-2" style={{ height }} onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => {
          const dim = focus !== null && focus !== i;
          return (
            <button
              type="button"
              key={d.label}
              aria-label={`${d.label}: ${labels[0]} ${formatInr(d.a)}, ${labels[1]} ${formatInr(d.b)}`}
              aria-pressed={pinned === i}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => setPinned(pinned === i ? null : i)}
              className="relative flex h-full flex-1 cursor-pointer flex-col items-center justify-end gap-2 outline-none"
            >
              <AnimatePresence>
                {hover === i && (
                  <motion.span
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.14 }}
                    className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-xl bg-ink px-3 py-2 text-left text-[12px] whitespace-nowrap text-ink-fg shadow-e3"
                  >
                    <span className="block font-semibold">{d.label}</span>
                    <span className="block text-ink-fg/75">
                      {labels[0]} {formatInr(d.a)}
                    </span>
                    <span className="block text-ink-fg/75">
                      {labels[1]} {formatInr(d.b)}
                    </span>
                  </motion.span>
                )}
              </AnimatePresence>
              <motion.span className="flex h-full w-full max-w-9 flex-col justify-end gap-1" animate={{ opacity: dim ? 0.35 : 1, y: pinned === i ? -4 : 0 }} transition={{ duration: 0.2 }}>
                <motion.span
                  className="block w-full origin-bottom rounded-md bg-[repeating-linear-gradient(-45deg,var(--ds-accent)_0_4px,color-mix(in_oklab,var(--ds-accent)_70%,white)_4px_8px)]"
                  style={{ height: `${(d.a / max) * 100 * 0.55}%` }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.8, ease, delay: 0.35 + i * 0.07 }}
                />
                <motion.span
                  className="block w-full origin-bottom rounded-md bg-ink"
                  style={{ height: `${(d.b / max) * 100 * 0.45}%` }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.8, ease, delay: 0.25 + i * 0.07 }}
                />
              </motion.span>
              <span className={cn("text-[11px] transition-colors", pinned === i ? "font-semibold text-foreground" : "text-secondary-fg")}>{d.label}</span>
            </button>
          );
        })}
      </div>
      <AnimatePresence initial={false}>
        {sel && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-elevated p-3 text-[13px] shadow-e0">
              <span>
                <span className="block text-secondary-fg">{sel.label} {labels[0].toLowerCase()}</span>
                <span className="font-semibold">{formatInr(sel.a)}</span>
              </span>
              <span>
                <span className="block text-secondary-fg">{labels[1]}</span>
                <span className="font-semibold">{formatInr(sel.b)}</span>
              </span>
              <span>
                <span className="block text-secondary-fg">Margin</span>
                <span className="font-semibold text-primary">{Math.round(((sel.a - sel.b) / sel.a) * 100)}%</span>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
