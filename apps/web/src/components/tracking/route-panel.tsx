"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BatteryMedium,
  BellRing,
  CircleDot,
  Clock,
  Footprints,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  MapPinOff,
  Route as RouteIcon,
  ShieldCheck,
  Siren,
  WifiOff,
} from "lucide-react";


import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { duration, istClock, km, type TrailPoint, type TrailStats } from "@/lib/tracking";
import type { RouteEvent, SosRow } from "@nbss/shared/trail";
import { cn } from "@/lib/utils";

/**
 * What Live tracking and Route history show about one guard's shift, in one place, so
 * the two pages read alike: the same numbers, the same timeline of moments, the same
 * duty line, wake-up button and site picker. Each page keeps its own core job (the live
 * map, the playback); everything around it comes from here.
 */

// ------------------------------------------------------------------ sites

/** Radix Select cannot hold an empty value, so "every site" is this. */
export const ALL_SITES = "all";

/** The site picker both pages carry: "All sites" first, then each site by name. */
export function SiteFilter({
  sites,
  value,
  onChange,
  className,
}: {
  sites: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Site" className={cn("h-9 w-full rounded-full border-0 bg-muted/70 px-3 ring-1 ring-border/60", className)}>
        <MapPin className="size-4 shrink-0 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start" searchPlaceholder="Find a site">
        <SelectItem value={ALL_SITES}>All sites</SelectItem>
        {[...sites]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

// ------------------------------------------------------------------ SOS

export { type SosRow } from "@nbss/shared/trail";

/**
 * The SOS this guard raised during the shift, for the timeline. Live while the shift is
 * open: read again whenever one of their alerts changes.
 */
export function useShiftSos(shift: { attendanceId: string; guardId: string; from: string; to: string | null } | null): SosRow[] {
  const [rows, setRows] = useState<{ key: string; list: SosRow[] } | null>(null);
  const key = shift ? `${shift.attendanceId}|${shift.guardId}|${shift.from}|${shift.to ?? ""}` : null;
  useEffect(() => {
    if (!key) return;
    const [attendanceId, guardId, from, to] = key.split("|");
    const supabase = supabaseBrowser();
    let cancelled = false;
    const load = async () => {
      let q = supabase.from("sos_alerts").select("id, kind, status, raised_at, closed_at, lat, lng").eq("raised_by", guardId!).gte("raised_at", from!).order("raised_at");
      if (to) q = q.lte("raised_at", to);
      const { data } = await q;
      if (!cancelled) setRows({ key, list: (data ?? []) as SosRow[] });
    };
    void load();
    const channel = to
      ? null
      : supabase
          .channel(`shift-sos:${attendanceId}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "sos_alerts", filter: `raised_by=eq.${guardId}` }, () => void load())
          .subscribe();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [key]);
  return rows && rows.key === key ? rows.list : NO_SOS;
}
const NO_SOS: SosRow[] = [];

// ------------------------------------------------------------------ timeline

export { routeEvents, type RouteEvent } from "@nbss/shared/trail";

/** The timeline: each moment a button that takes the map (and the playback) there. */
export function RouteTimeline({
  events,
  onPick,
  active,
  className,
}: {
  events: RouteEvent[];
  onPick: (e: RouteEvent, i: number) => void;
  /** The moment being shown on the map, marked in the list. */
  active?: number | null;
  className?: string;
}) {
  if (events.length === 0) return null;
  return (
    <ol className={cn("space-y-0.5", className)}>
      {events.map((e, i) => (
        <li key={`${e.kind}-${e.at}-${i}`}>
          <button
            type="button"
            onClick={() => onPick(e, i)}
            aria-current={active === i || undefined}
            className={cn("flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted/70", active === i && "bg-sky-50 ring-1 ring-sky-500/40 ring-inset dark:bg-sky-500/10")}
          >
            <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", EVENT_TONE[e.kind])}>
              <EventIcon kind={e.kind} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{e.text}</span>
              <span className="block text-xs tabular-nums text-muted-foreground">{istClock(e.at)}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

const EVENT_TONE: Record<RouteEvent["kind"], string> = {
  in: "bg-emerald-600 text-white",
  out: "bg-slate-800 text-white",
  now: "bg-blue-600 text-white",
  left: "bg-amber-500 text-white",
  back: "bg-emerald-500/20 text-emerald-700",
  stop: "bg-slate-200 text-slate-700",
  gap: "bg-rose-500/15 text-rose-700",
  sos: "bg-red-600 text-white",
  sos_end: "bg-red-500/15 text-red-700",
};

function EventIcon({ kind }: { kind: RouteEvent["kind"] }) {
  const cls = "size-3.5";
  switch (kind) {
    case "in":
      return <LogIn className={cls} />;
    case "out":
      return <LogOut className={cls} />;
    case "left":
      return <MapPinOff className={cls} />;
    case "gap":
      return <WifiOff className={cls} />;
    case "stop":
      return <Clock className={cls} />;
    case "sos":
      return <Siren className={cls} />;
    case "sos_end":
      return <ShieldCheck className={cls} />;
    default:
      return <CircleDot className={cls} />;
  }
}

// ------------------------------------------------------------------ numbers

/** The shift in six numbers: on duty, walked, outside, quiet spells, points, battery. */
export function RouteStats({ onDutyMin, stats, points }: { onDutyMin: number; stats: TrailStats | null; points: TrailPoint[] }) {
  const battery = useMemo(() => points.filter((p) => p.battery != null), [points]);
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
      <Stat icon={Clock} label="On duty" value={duration(onDutyMin)} />
      <Stat icon={Footprints} label="Walked" value={stats ? km(stats.distanceM) : "-"} />
      <Stat icon={MapPinOff} label="Outside fence" value={stats ? duration(stats.outsideMinutes) : "-"} warn={(stats?.outsideMinutes ?? 0) > 15} />
      <Stat icon={WifiOff} label="Signal gaps" value={String(stats?.gaps.length ?? 0)} warn={(stats?.gaps.length ?? 0) > 0} />
      <Stat icon={RouteIcon} label="Points" value={String(points.length)} />
      <Stat icon={BatteryMedium} label="Battery" value={battery.length ? `${battery[0]!.battery}% → ${battery.at(-1)!.battery}%` : "-"} />
    </dl>
  );
}

function Stat({ icon: Icon, label, value, warn }: { icon: typeof Clock; label: string; value: string; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" strokeWidth={2} />
        <span className="truncate">{label}</span>
      </dt>
      <dd className={cn("truncate font-semibold tabular-nums", warn && "text-amber-700")}>{value}</dd>
    </div>
  );
}

// ------------------------------------------------------------------ duty

/** When a guard is meant to be on duty: the rostered shift (timestamps), else the site's daily window ("HH:MM:SS", IST). */
export type Duty = { kind: "shift" | "site"; start: string; end: string } | null;

const IST_MS = 330 * 60_000;

/** "17:00:00" → "5:00 pm". */
function wallClock(value: string): string {
  const [h, m] = value.split(":");
  const hour = Number(h);
  if (!Number.isFinite(hour)) return value;
  return `${hour % 12 === 0 ? 12 : hour % 12}:${m ?? "00"} ${hour < 12 ? "am" : "pm"}`;
}

/** The site's daily window as instants around `now`, an overnight window ending the next morning. */
function siteWindow(start: string, end: string, now: number): { from: number; to: number } {
  const mins = (v: string) => {
    const [h, m] = v.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const midnight = Math.floor((now + IST_MS) / 86_400_000) * 86_400_000 - IST_MS;
  let from = midnight + mins(start) * 60_000;
  let to = midnight + mins(end) * 60_000;
  if (to <= from) {
    // Overnight: before the end this morning, it is still last night's shift.
    if (now < to) from -= 86_400_000;
    else to += 86_400_000;
  }
  return { from, to };
}

/** When this guard is meant to be on duty, and how far into it they are (or, for a past shift, just the window). */
export function DutyLine({ duty, now, past = false }: { duty: Duty; now: number; past?: boolean }) {
  if (!duty) {
    return (
      <p className="flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground">
        <Clock className="size-3.5 shrink-0" /> No duty time set: not rostered, and the site has no shift window.
      </p>
    );
  }
  const { from, to } =
    duty.kind === "shift" ? { from: new Date(duty.start).getTime(), to: new Date(duty.end).getTime() } : siteWindow(duty.start, duty.end, now);
  const label = duty.kind === "shift" ? `${istClock(from)} – ${istClock(to)}` : `${wallClock(duty.start)} – ${wallClock(duty.end)}`;
  const over = now > to;
  const note = past ? null : now < from ? `starts in ${duration((from - now) / 60_000)}` : over ? `ended ${duration((now - to) / 60_000)} ago` : `ends in ${duration((to - now) / 60_000)}`;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-4 py-2.5 text-xs">
      <Clock className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">{duty.kind === "shift" ? "Duty" : "Site hours"}</span>
      <span className="font-semibold tabular-nums">{label}</span>
      {note && <span className={cn("tabular-nums", over ? "font-semibold text-rose-600" : "text-muted-foreground")}>· {note}</span>}
    </p>
  );
}

// ------------------------------------------------------------------ wake

/**
 * Wakes the guard's phone now: a silent push that restarts tracking in the
 * background, and a visible "the office is checking on you" in case it cannot.
 * The watchdog does the same on its own every few minutes while a phone is quiet.
 */
export function WakeButton({ guardId, name }: { guardId: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const wake = async () => {
    setBusy(true);
    const { data, error } = await supabaseBrowser().rpc("wake_guard", { p_guard: guardId });
    setBusy(false);
    const r = data as { ok?: boolean; devices?: number; reason?: string } | null;
    if (error) toast.error(error.message);
    else if (!r?.ok) toast.error(r?.reason === "not_on_duty" ? `${name} is not checked in.` : "Could not send the wake-up.");
    else if (!r.devices) toast.error(`${name}'s phone has no notifications registered, so it cannot be woken. Call instead.`);
    else toast.success(`Wake-up sent to ${name}'s phone.`);
  };
  return (
    <button
      type="button"
      onClick={() => void wake()}
      disabled={busy}
      className="press inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-amber-500/12 px-3 text-sm font-medium text-amber-800 ring-1 ring-amber-500/30 hover:bg-amber-500/20 disabled:opacity-60 dark:text-amber-200"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />} Wake up phone
    </button>
  );
}
