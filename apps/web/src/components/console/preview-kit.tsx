"use client";

import { Loader2, X, type LucideIcon } from "lucide-react";

import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { initials } from "@/lib/ui/initials";
import { cn } from "@/lib/utils";

/**
 * The pieces every row popup in the console is built from, so a click on a
 * guard, a punch, a site, an SOS or a booking opens the same kind of card:
 * a gradient header saying what it is, figures, facts, and the things you can
 * do about it pinned along the bottom.
 */

type Tone = "brand" | "rose" | "amber" | "slate";

const HERO_TONE: Record<Tone, string> = {
  brand: "bg-brand-gradient-strong",
  rose: "bg-gradient-to-br from-rose-600 to-red-700",
  amber: "bg-gradient-to-br from-amber-500 to-orange-600",
  slate: "bg-gradient-to-br from-slate-600 to-slate-800",
};

export function PreviewDialog({
  open,
  onClose,
  label,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  /** Read by screen readers as the dialog's name. */
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0",
          wide ? "sm:max-w-3xl" : "sm:max-w-2xl",
        )}
      >
        <DialogClose
          aria-label="Close"
          className="absolute top-3 right-3 z-20 flex size-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/30"
        >
          <X className="size-4" />
        </DialogClose>
        <DialogTitle className="sr-only">{label}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** The coloured header: who or what this is, at a glance. */
export function PreviewHero({
  title,
  meta,
  badge,
  icon: Icon,
  avatar,
  tone = "brand",
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: LucideIcon;
  /** A name to draw initials from, instead of an icon. */
  avatar?: string;
  tone?: Tone;
}) {
  return (
    <div className={cn("relative shrink-0 overflow-hidden px-6 pt-6 pb-5 text-white", HERO_TONE[tone])}>
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-white/10" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/3 size-40 rounded-full bg-white/5" />
      <div className="relative flex items-center gap-4 pr-8">
        {(avatar || Icon) && (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-lg font-bold ring-2 ring-white/40">
            {avatar ? initials(avatar) : Icon ? <Icon className="size-6" strokeWidth={1.9} /> : null}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold">{title}</p>
          {meta && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-white/85">{meta}</div>
          )}
        </div>
      </div>
      {badge && <div className="relative mt-3 flex flex-wrap items-center gap-2">{badge}</div>}
    </div>
  );
}

/** A small pill for the header, readable on any of its tones. */
export function HeroPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">{children}</span>
  );
}

export function PreviewBody({ children }: { children: React.ReactNode }) {
  return <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">{children}</div>;
}

/** What can be done about it — pinned under the scrolling body. */
export function PreviewActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-app-line-soft bg-card/95 px-6 py-3">
      {children}
    </div>
  );
}

export function PreviewLoading() {
  return (
    <div className="flex h-72 items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}

export function PreviewError({ message }: { message: string }) {
  return <p className="p-10 text-center text-sm text-muted-foreground">{message}</p>;
}

export function Stat({
  icon: Icon,
  label,
  children,
  tone = "text-foreground",
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-app-line-soft bg-card p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <div className={cn("mt-1 truncate text-lg font-bold tabular-nums", tone)}>{children}</div>
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>;
}

export function Field({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
        <dd className={cn("mt-0.5 text-sm break-words", mono && "font-mono tabular-nums")}>{value || "—"}</dd>
      </div>
    </div>
  );
}

export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>;
}

export function Section({
  title,
  action,
  children,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A phone number that dials, set in mono so digits line up. */
export function PhoneLink({ phone, className }: { phone: string | null | undefined; className?: string }) {
  if (!phone) return <span className="text-muted-foreground">—</span>;
  return (
    <a
      href={`tel:${phone.replace(/[^\d+]/g, "")}`}
      onClick={(e) => e.stopPropagation()}
      className={cn("font-mono text-primary-ink hover:underline", className)}
    >
      {phone}
    </a>
  );
}

/** Timestamps in IST, the way the desk reads them. */
export function istDateTime(iso: string | null, withYear = false): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export function ago(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h ${mins % 60} min ago`;
  return istDateTime(iso);
}

export function duration(minutes: number | null): string {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** A clickable table row: the whole row opens its popup, keyboard included. */
export function rowProps(onOpen: () => void) {
  return {
    tabIndex: 0,
    onClick: onOpen,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen();
      }
    },
    className: "cursor-pointer",
  };
}

/** Padding for a plain table laid flush inside a panel, lining up with its header. */
export const FLUSH_TABLE =
  "[&_td:first-child]:pl-6 [&_th:first-child]:pl-6 [&_td:last-child]:pr-6 [&_th:last-child]:pr-6 [&_td]:py-3";
