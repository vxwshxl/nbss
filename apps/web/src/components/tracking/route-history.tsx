"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPinOff, Pause, Phone, Play, Radar, Search, Smartphone, TriangleAlert } from "lucide-react";

import { PersonPreviewDialog } from "@/components/console/person-preview";
import { ALL_SITES, DutyLine, RouteStats, RouteTimeline, SiteFilter, WakeButton, routeEvents, useShiftSos, type Duty } from "@/components/tracking/route-panel";
import { TrailMap, type TrailSite } from "@/components/tracking/trail-map";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { EVENTS, LIVE_MAP_CHANNEL, type PositionBatch } from "@nbss/shared/realtime";
import {
  duration,
  istClock,
  istClockSeconds,
  toPoints,
  trailStats,
  type TrailPoint,
  type TrailTuple,
} from "@/lib/tracking";
import { cn } from "@/lib/utils";

export type RouteShift = {
  attendanceId: string;
  guardId: string;
  guardName: string;
  guardCode: string;
  phone: string | null;
  siteId: string;
  siteName: string;
  site: TrailSite;
  duty: Duty;
  device: { label: string; appVersion: string | null } | null;
  checkInAt: string;
  checkOutAt: string | null;
  workedMinutes: number | null;
  status: string;
  deviceFlag: string | null;
};

const SPEEDS = [30, 120, 600] as const;
/** Radix Select cannot hold an empty value, so "every guard" is this. */
const ALL = "all";
const FILTER = "h-9 w-full rounded-full border-0 bg-muted/70 px-3 ring-1 ring-border/60";

/**
 * Route history: pick a shift and see the whole path from check-in to
 * check-out, then play it back. Built for the question a client or a dispute
 * actually asks — "where was he at 2:40?" — so the timeline lists the moments
 * that matter (left the fence, came back, stopped, the phone went quiet) and
 * each one moves the map there.
 */
export function RouteHistory({
  shifts,
  guards,
  sites,
  initial,
}: {
  shifts: RouteShift[];
  guards: { id: string; name: string }[];
  /** For the site picker; empty inside one site's own workspace. */
  sites: { id: string; name: string }[];
  initial: { attendance: string | null; guard: string | null; date: string | null; site: string | null };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = useState<string | null>(initial.attendance ?? shifts[0]?.attendanceId ?? null);
  const [loaded, setLoaded] = useState<{ id: string; points: TrailPoint[] } | null>(null);
  const [head, setHead] = useState(0);
  const [playing, setPlaying] = useState(false);
  // The playback time, every frame, for the map to glide the head by (TrailMap).
  const clockRef = useRef<number | null>(null);
  // Read by the live refresh without restarting it.
  const headRef = useRef(0);
  const playingRef = useRef(false);
  const lengthRef = useRef(0);
  useEffect(() => {
    headRef.current = head;
    playingRef.current = playing;
  }, [head, playing]);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(120);
  // The guard's full profile, from their name on the summary.
  const [profileId, setProfileId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pan, setPan] = useState<{ lat: number; lng: number; key: string } | null>(null);

  const shift = shifts.find((s) => s.attendanceId === selected) ?? null;

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    void supabaseBrowser()
      .rpc("guard_trail", { p_attendance_id: selected })
      .then(({ data }) => {
        if (cancelled) return;
        const pts = toPoints((data as { points?: TrailTuple[] } | null)?.points);
        setLoaded({ id: selected, points: pts });
        setHead(Math.max(0, pts.length - 1));
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  // Live while the shift is open: the guard's new positions join the route as they
  // arrive (the live map's channel says when, and a slow poll backs it up), as on Live
  // tracking. The head follows the latest point only if it was already there, so
  // someone replaying an earlier stretch is not pulled away from it.
  const liveId = shift && !shift.checkOutAt ? shift.attendanceId : null;
  const liveGuard = shift?.guardId ?? null;
  useEffect(() => {
    if (!liveId || !liveGuard) return;
    const supabase = supabaseBrowser();
    let cancelled = false;
    let last = 0;
    const refetch = async () => {
      if (Date.now() - last < 4_000) return;
      last = Date.now();
      const { data } = await supabase.rpc("guard_trail", { p_attendance_id: liveId });
      if (cancelled) return;
      const pts = toPoints((data as { points?: TrailTuple[] } | null)?.points);
      const wasAtEnd = headRef.current >= lengthRef.current - 1;
      setLoaded({ id: liveId, points: pts });
      if (wasAtEnd && !playingRef.current) setHead(Math.max(0, pts.length - 1));
    };
    const channel = supabase
      .channel(LIVE_MAP_CHANNEL, { config: { private: true } })
      .on("broadcast", { event: EVENTS.positions }, ({ payload }) => {
        if (((payload as PositionBatch).positions ?? []).some((p) => p.guard_id === liveGuard)) void refetch();
      });
    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe();
    });
    const poll = setInterval(() => void refetch(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [liveId, liveGuard]);

  // The route on screen belongs to the selected shift, or there is none yet.
  const loading = !!selected && loaded?.id !== selected;
  const points = useMemo(() => (loaded && loaded.id === selected ? loaded.points : []), [loaded, selected]);
  useEffect(() => {
    lengthRef.current = points.length;
  }, [points]);

  // Playback: the head walks the trail in shift time, `speed` times real time.
  useEffect(() => {
    if (!playing || points.length < 2) return;
    let last = performance.now();
    let clock = points[head]?.at ?? points[0]!.at;
    let raf = 0;
    const tick = (t: number) => {
      clock += (t - last) * speed;
      last = t;
      clockRef.current = clock;
      let i = head;
      while (i < points.length - 1 && points[i + 1]!.at <= clock) i++;
      // A signal gap (no points for minutes) is skipped, not crawled across in a straight line.
      const next = points[i + 1];
      if (next && next.at - points[i]!.at > 3 * 60_000 && clock < next.at - 1_000) clock = next.at - 1_000;
      if (i !== head) setHead(i);
      if (i >= points.length - 1) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // The loop owns the head while playing; restarting it on every step would reset the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, points]);

  const stats = useMemo(() => (points.length > 1 ? trailStats(points) : null), [points]);

  // The SOS this guard raised during the shift, and the moments that matter (shared with Live tracking).
  const sos = useShiftSos(shift ? { attendanceId: shift.attendanceId, guardId: shift.guardId, from: shift.checkInAt, to: shift.checkOutAt } : null);
  const events = useMemo(() => routeEvents(points, stats, sos), [points, stats, sos]);
  // A clock for the duty line while the shift is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  function setFilter(key: "guard" | "date" | "site", value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("attendance");
    router.replace(`${pathname}?${next}`);
  }

  const q = query.trim().toLowerCase();
  const listed = q ? shifts.filter((s) => `${s.guardName} ${s.guardCode} ${s.siteName}`.toLowerCase().includes(q)) : shifts;
  const at = points[head];

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
      {/* Shifts */}
      {/* Below the map and summary on anything narrower than a wide desk, in its own
          scroll: with two hundred guards the list is long, and the map is what you came for. */}
      <aside className="order-3 flex max-h-[65vh] min-h-0 flex-col overflow-hidden rounded-2xl border border-app-line bg-card xl:order-1 xl:h-[calc(100dvh-210px)] xl:max-h-none">
        <div className="grid grid-cols-2 gap-2 border-b border-app-line-soft p-3">
          <Select value={initial.guard ?? ALL} onValueChange={(v) => setFilter("guard", v === ALL ? "" : v)}>
            <SelectTrigger aria-label="Guard" className={FILTER}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start" searchPlaceholder="Find a guard">
              <SelectItem value={ALL}>All guards</SelectItem>
              {guards.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DatePicker
            value={initial.date ?? ""}
            onChange={(v) => setFilter("date", v)}
            placeholder="Any day"
            max={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}
            className={FILTER}
          />
          {sites.length > 1 && (
            <SiteFilter sites={sites} value={initial.site ?? ALL_SITES} onChange={(v) => setFilter("site", v === ALL_SITES ? "" : v)} className="col-span-2" />
          )}
          <label className="col-span-2 flex h-9 items-center gap-2 rounded-full bg-muted/70 px-3 ring-1 ring-border/60 focus-within:ring-2 focus-within:ring-ring/50">
            <Search className="size-4 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${shifts.length} shifts by guard or site`} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-app-line-soft overflow-y-auto">
          {listed.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No shifts match. Routes appear here once a guard checks in from the app.</li>}
          {listed.map((s) => (
            <li key={s.attendanceId}>
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setSelected(s.attendanceId);
                  // The list sits under the map on narrow screens: bring the map back into view.
                  if (window.matchMedia("(max-width: 1279px)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={cn("w-full px-3 py-2.5 text-left hover:bg-muted/60", selected === s.attendanceId && "bg-sky-50 ring-1 ring-sky-500/30 ring-inset dark:bg-sky-500/10")}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{s.guardName}</span>
                  {!s.checkOutAt ? (
                    <span className="shrink-0 rounded-full bg-emerald-600/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">On duty</span>
                  ) : (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{duration(s.workedMinutes ?? 0)}</span>
                  )}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {s.siteName} · {new Date(s.checkInAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })},{" "}
                  {istClock(new Date(s.checkInAt).getTime())}
                  {s.checkOutAt ? ` – ${istClock(new Date(s.checkOutAt).getTime())}` : ""}
                </span>
                {s.deviceFlag && (
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-700">
                    <TriangleAlert className="size-3 shrink-0" /> {s.deviceFlag === "shared_device" ? "Another guard's phone" : "Unapproved phone"}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Map and playback */}
      <div className="order-1 flex min-h-0 flex-col gap-3 xl:order-2">
        <div className="relative h-[55vh] min-h-[380px] xl:h-auto xl:flex-1">
          {shift ? (
            <TrailMap points={points} stats={stats} site={shift.site} head={head} clock={clockRef} playing={playing} pan={pan} className="h-full" />
          ) : (
            <div className="grid h-full place-items-center rounded-xl border border-app-line-soft bg-muted text-sm text-muted-foreground">Pick a shift to see its route.</div>
          )}
          {loading && <div className="absolute top-3 left-3 rounded-full bg-card px-3 py-1.5 text-xs font-medium shadow">Loading the route…</div>}
          {shift && !loading && points.length <= 1 && (
            <div className="absolute inset-x-3 top-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow ring-1 ring-amber-200">
              <MapPinOff className="mt-0.5 size-4 shrink-0" />
              <p>Only the check-in point was recorded. Either the shift has just started or the phone was not sending its location (background location off, or the app closed in Expo Go).</p>
            </div>
          )}
        </div>
        {points.length > 1 && (
          <div className="flex items-center gap-3 rounded-2xl border border-app-line bg-card px-3 py-2.5">
            <button
              type="button"
              onClick={() => {
                if (head >= points.length - 1) setHead(0);
                setPlaying((p) => !p);
              }}
              className="press grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
              aria-label={playing ? "Pause" : "Play the route"}
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
            </button>
            <div className="min-w-0 flex-1">
              <input
                type="range"
                min={0}
                max={points.length - 1}
                value={head}
                onChange={(e) => {
                  setPlaying(false);
                  setHead(Number(e.target.value));
                }}
                className="w-full"
                aria-label="Position in the route"
              />
              <div className="mt-1 flex justify-between text-xs tabular-nums text-muted-foreground">
                <span>{istClock(points[0]!.at)}</span>
                <span className="font-semibold text-foreground">
                  {at ? istClockSeconds(at.at) : ""}
                  {at?.inside === false ? " · outside" : ""}
                  {at?.battery != null ? ` · ${at.battery}%` : ""}
                </span>
                <span>{istClock(points.at(-1)!.at)}</span>
              </div>
            </div>
            <div className="flex shrink-0 rounded-full bg-muted/70 p-0.5 ring-1 ring-border/60">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  aria-pressed={speed === s}
                  className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", speed === s ? "bg-background shadow-sm ring-1 ring-border" : "text-muted-foreground")}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <PersonPreviewDialog personId={profileId} onClose={() => setProfileId(null)} />

      {/* Summary and timeline */}
      <aside className="order-2 flex max-h-[65vh] min-h-0 flex-col overflow-hidden rounded-2xl border border-app-line bg-card xl:order-3 xl:h-[calc(100dvh-210px)] xl:max-h-none">
        {shift ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="p-4 pb-3">
                <button type="button" onClick={() => setProfileId(shift.guardId)} className="block max-w-full truncate text-left font-semibold hover:underline">
                  {shift.guardName}
                </button>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{shift.guardCode}</span> · {shift.siteName}
                </p>
                {!shift.checkOutAt && (
                  <span className="mt-1 inline-block rounded-full bg-emerald-600/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">On duty</span>
                )}
              </div>
              <div className="border-t border-app-line-soft">
                <DutyLine duty={shift.duty} now={now} past={!!shift.checkOutAt} />
              </div>
              <div className="border-t border-app-line-soft px-4 py-3">
                <RouteStats
                  onDutyMin={((shift.checkOutAt ? new Date(shift.checkOutAt).getTime() : points.at(-1)?.at ?? new Date(shift.checkInAt).getTime()) - new Date(shift.checkInAt).getTime()) / 60_000}
                  stats={stats}
                  points={points}
                />
              </div>
              <p className="flex items-center gap-2 border-t border-app-line-soft px-4 py-2.5 text-xs text-muted-foreground">
                <Smartphone className="size-3.5 shrink-0" />
                <span className="truncate">
                  {shift.device ? `${shift.device.label}${shift.device.appVersion ? ` · app ${shift.device.appVersion}` : ""}` : "Phone not registered"}
                </span>
              </p>
              <div className="space-y-2 border-t border-app-line-soft px-4 py-3">
                {!shift.checkOutAt && <WakeButton guardId={shift.guardId} name={shift.guardName} />}
                <div className="flex gap-2">
                  {shift.phone && (
                    <a href={`tel:${shift.phone}`} className="press inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground">
                      <Phone className="size-4" /> Call
                    </a>
                  )}
                  {!shift.checkOutAt && (
                    <Link href="/console/live" className="press inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1 ring-border hover:bg-muted">
                      <Radar className="size-4" /> Live map
                    </Link>
                  )}
                </div>
              </div>
              <div className="border-t border-app-line-soft p-2">
                <p className="px-2 pt-1 pb-1 text-xs font-semibold">Timeline</p>
                <RouteTimeline
                  events={events}
                  onPick={(e, i) => {
                    setPlaying(false);
                    setHead(e.index);
                    if (e.lat != null && e.lng != null) setPan({ lat: e.lat, lng: e.lng, key: `${e.at}-${i}` });
                  }}
                />
              </div>
            </div>
          </>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">The route&apos;s summary and timeline appear here.</p>
        )}
      </aside>
    </div>
  );
}
