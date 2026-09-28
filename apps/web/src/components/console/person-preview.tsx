"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarRange,
  CalendarCheck,
  Clock,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Timer,
  TriangleAlert,
  X,
} from "lucide-react";

import { personPreview, type DayMark, type PersonPreview } from "@/app/console/guards/preview";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Field, PhoneLink, Stat } from "@/components/console/preview-kit";
import { StatusPill } from "@/components/ui/status-pill";
import { initials } from "@/lib/ui/initials";
import { daysLabel, windowLabel } from "@/lib/roster";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  supervisor: "Supervisor",
  guard: "Guard",
  client: "Client",
};

const IST = "Asia/Kolkata";

function when(iso: string | null, withTime = false): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: withTime ? undefined : "numeric",
    hour: withTime ? "numeric" : undefined,
    minute: withTime ? "2-digit" : undefined,
    hour12: true,
    timeZone: IST,
  });
}

function ago(iso: string | null): string {
  if (!iso) return "Never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return when(iso);
}

const DAY_TONE: Record<DayMark["state"], string> = {
  present: "bg-primary",
  late: "bg-amber-400",
  absent: "bg-rose-400",
  review: "bg-sky-400",
  none: "bg-muted",
};

function DayStrip({ days }: { days: DayMark[] }) {
  return (
    <div className="flex gap-1">
      {days.map((d) => (
        <span
          key={d.date}
          title={`${new Date(`${d.date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${d.state === "none" ? "No punch" : d.state}`}
          className={cn("h-7 flex-1 rounded-md", DAY_TONE[d.state])}
        />
      ))}
    </div>
  );
}

function Card({ p, children }: { p: PersonPreview; children?: React.ReactNode }) {
  return (
    <div>
      <div className="relative overflow-hidden bg-brand-gradient-strong px-6 pt-6 pb-5 text-white">
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/3 size-40 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4 pr-8">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-xl font-bold ring-2 ring-white/40">
            {initials(p.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold">{p.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-white/85">
              <span className="font-mono">{p.code}</span>
              <span aria-hidden>·</span>
              {ROLE_LABEL[p.role]}
              {!p.active && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">Inactive</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {p.guard && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat icon={Timer} label="Right now" tone={p.guard.onDuty ? "text-primary-ink" : "text-muted-foreground"}>
                {p.guard.onDuty ? "On duty" : "Off duty"}
              </Stat>
              <Stat icon={CalendarCheck} label="Days · 30d" tone="text-primary-ink">
                {p.guard.days30}
              </Stat>
              <Stat icon={Clock} label="Hours · 30d" tone="text-sky-700">
                {p.guard.hours30}
              </Stat>
              <Stat icon={TriangleAlert} label="Late · 30d" tone={p.guard.late30 ? "text-amber-600" : "text-foreground"}>
                {p.guard.late30}
              </Stat>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-app-line-soft px-3.5 py-3">
              <CalendarRange className="size-4 shrink-0 text-primary-ink" />
              <span className="min-w-0 flex-1 text-sm">
                {p.guard.posting ? (
                  <>
                    Posted at <span className="font-semibold">{p.guard.posting.site}</span> ·{" "}
                    {windowLabel(p.guard.posting.starts, p.guard.posting.ends)} · {daysLabel(p.guard.posting.days)}
                  </>
                ) : (
                  <span className="text-muted-foreground">No standing post — free for cover shifts.</span>
                )}
              </span>
              <Link href={`/console/roster?guard=${p.id}`} className="text-xs font-medium text-primary-ink hover:underline">
                {p.guard.posting ? "Move" : "Post"}
              </Link>
            </div>
            {p.guard.onDuty && (
              <p className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
                <MapPin className="size-4" />
                At <span className="font-semibold">{p.guard.onDuty.site}</span> since {when(p.guard.onDuty.since, true)}
              </p>
            )}
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Last 14 days</p>
              <DayStrip days={p.guard.strip} />
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                {(["present", "late", "absent", "review"] as const).map((s) => (
                  <span key={s} className="flex items-center gap-1 capitalize">
                    <span className={cn("size-2 rounded-full", DAY_TONE[s])} />
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {p.client && (
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Sites · {p.client.sites.length}
            </p>
            {p.client.sites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sites linked to this client yet.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {p.client.sites.map((s) => (
                  <li key={s.name} className="flex items-center gap-2.5 rounded-xl border border-app-line-soft p-2.5">
                    <Building2 className="size-4 text-primary-ink" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className="block text-xs text-muted-foreground">{s.district ?? "—"}</span>
                    </span>
                    {!s.active && <StatusPill status="inactive" />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field icon={Mail} label="Email" value={p.email} />
          <Field icon={Phone} label="Phone" value={<PhoneLink phone={p.phone} />} />
          <Field icon={CalendarCheck} label="Joined" value={when(p.joined)} />
          <Field icon={Clock} label="Last seen" value={ago(p.lastSeen)} />
        </dl>

        {children}
      </div>
    </div>
  );
}

/**
 * Click a person anywhere → their profile, in place.
 *
 * The card loads when it opens (a server action that re-checks the viewer's
 * role), so a long table never pays for profiles nobody opens. `children`
 * receives the loaded person for anything the page wants to add below — the
 * account controls on the people pages.
 */
export function PersonPreviewDialog({
  personId,
  onClose,
  version = 0,
  children,
}: {
  personId: string | null;
  onClose: () => void;
  /** Bump to re-read the open card after an edit. */
  version?: number;
  children?: (p: PersonPreview) => React.ReactNode;
}) {
  const [data, setData] = useState<PersonPreview | { error: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!personId) return;
    start(async () => {
      setData(await personPreview(personId));
    });
  }, [personId, version]);

  return (
    <Dialog
      open={!!personId}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setData(null);
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-2xl"
      >
        <DialogClose
          aria-label="Close"
          className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/30"
        >
          <X className="size-4" />
        </DialogClose>
        <DialogTitle className="sr-only">Profile</DialogTitle>
        {!data || (pending && !("id" in data && data.id === personId)) ? (
          <div className="flex h-72 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : "error" in data ? (
          <p className="p-10 text-center text-sm text-muted-foreground">{data.error}</p>
        ) : (
          <Card p={data}>{children?.(data)}</Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
