"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Battery,
  BatteryCharging,
  BatteryLow,
  BatteryWarning,
  BellRing,
  Crosshair,
  Loader2,
  Maximize,
  Minimize,
  LocateOff,
  Phone,
  Route,
  Search,
  ShieldCheck,
  Smartphone,
  UserRoundX,
  X,
} from "lucide-react";

import { EVENTS, LIVE_MAP_CHANNEL, type LivePosition, type PositionBatch } from "@nbss/shared/realtime";

import { PersonPreviewDialog } from "@/components/console/person-preview";
import { LiveMap, type LiveMarker, type LiveSite } from "@/components/tracking/live-map";
import { initials } from "@/lib/ui/initials";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";

import { reviewFlaggedPunch, setDeviceStatus } from "@/app/console/devices/actions";
import {
  STATE_CHIP,
  STATE_COLOR,
  STATE_LABEL,
  ago,
  duration,
  guardState,
  heardAt,
  istClock,
  km,
  toPoints,
  trailStats,
  type GuardState,
  type TrailPoint,
  type TrailTuple,
} from "@/lib/tracking";
import { cn } from "@/lib/utils";

export type DutyGuard = {
  attendanceId: string;
  guardId: string;
  name: string;
  code: string;
  phone: string | null;
  siteId: string;
  siteName: string;
  checkInAt: string;
  status: string;
  deviceFlag: string | null;
  /** When the watchdog last told the guard (and, after 20 min, the supervisors) the phone went silent. */
  silentAlertedAt: string | null;
  device: {
    /** guard_devices.id, for approving it from the card. */
    id: string;
    label: string;
    platform: string | null;
    appVersion: string | null;
    permission: string | null;
    gps: boolean | null;
    batteryOptimized: boolean | null;
    approved: boolean;
  } | null;
};

export type NotArrived = { shiftId: string; name: string; code: string; phone: string | null; siteName: string; startsAt: string };

const FILTERS: { key: "all" | GuardState; label: string }[] = [
  { key: "all", label: "All" },
  { key: "inside", label: "Inside" },
  { key: "outside", label: "Outside" },
  { key: "offline", label: "No signal" },
  { key: "sos", label: "SOS" },
];

const NO_TRAIL: TrailPoint[] = [];

function useNow(everyMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/**
 * Live Tracking: every guard on duty, where they are now, and the path they
 * have walked since checking in.
 *
 * Positions arrive as one batch every fifteen seconds on the private `live-map`
 * channel (0005/0022 → broadcast_positions). The page also re-reads the table
 * every minute, so a dropped socket costs a minute of staleness, never a frozen
 * map that looks live.
 */
export function LiveTracking({
  guards,
  initialPositions,
  sites,
  sosGuards,
  notArrived,
}: {
  guards: DutyGuard[];
  initialPositions: LivePosition[];
  sites: LiveSite[];
  sosGuards: string[];
  notArrived: NotArrived[];
}) {
  const router = useRouter();
  const now = useNow(10_000);
  // What realtime has told us since the page was drawn. Merged over the server's
  // positions below, the newer of the two winning, so a refresh never moves a dot back.
  const [heard, setHeard] = useState<Record<string, LivePosition>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: string } | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const [loadedTrail, setLoadedTrail] = useState<{ id: string; points: TrailPoint[] } | null>(null);
  const [live, setLive] = useState(false);
  // The guard's full profile, from their name or photo on the card.
  const [profileId, setProfileId] = useState<string | null>(null);
  const openProfile = (id: string) => {
    // The dialog draws outside the map, so full screen would hide it.
    if (document.fullscreenElement) void document.exitFullscreen();
    setProfileId(id);
  };

  const positions = useMemo(() => {
    const next: Record<string, LivePosition> = Object.fromEntries(initialPositions.map((p) => [p.guard_id, p]));
    for (const p of Object.values(heard)) {
      const known = next[p.guard_id];
      if (!known || (heardAt(p) ?? 0) >= (heardAt(known) ?? 0)) next[p.guard_id] = { ...known, ...p };
    }
    return next;
  }, [initialPositions, heard]);

  const onDuty = useMemo(() => new Set(guards.map((g) => g.guardId)), [guards]);
  // Read by the channel below through a ref: as a dependency, every refresh of the guard
  // list tore the channel down and opened it again, and the map sat on "Connecting…".
  const onDutyRef = useRef(onDuty);
  useEffect(() => {
    onDutyRef.current = onDuty;
  }, [onDuty]);

  // The batch, and a slow re-read behind it.
  useEffect(() => {
    const supabase = supabaseBrowser();
    let cancelled = false;
    const merge = (list: LivePosition[]) =>
      setHeard((cur) => {
        const next = { ...cur };
        for (const p of list) next[p.guard_id] = { ...next[p.guard_id], ...p };
        return next;
      });

    const channel = supabase
      .channel(LIVE_MAP_CHANNEL, { config: { private: true } })
      .on("broadcast", { event: EVENTS.positions }, ({ payload }) => {
        const batch = payload as PositionBatch;
        merge(batch.positions ?? []);
        // Somebody checked in since the page was drawn.
        if ((batch.positions ?? []).some((p) => !onDutyRef.current.has(p.guard_id))) router.refresh();
      });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
      // Live once subscribed; back to Connecting only if the socket really drops
      // (supabase-js rejoins by itself and reports SUBSCRIBED again).
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") setLive(true);
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setLive(false);
      });
    });

    const reread = setInterval(async () => {
      const { data } = await supabase.from("guard_positions").select("*");
      if (data) merge(data as unknown as LivePosition[]);
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(reread);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const rows = useMemo(
    () =>
      guards.map((g) => {
        const p = positions[g.guardId] ?? null;
        const state = guardState(p, sosGuards.includes(g.guardId), now);
        return { g, p, state };
      }),
    [guards, positions, sosGuards, now],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) {
      const k = r.state === "stale" || r.state === "waiting" ? "offline" : r.state;
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [rows]);

  const shown = rows
    .filter((r) => filter === "all" || r.state === filter || (filter === "offline" && (r.state === "stale" || r.state === "waiting")))
    .filter((r) => {
      const q = query.trim().toLowerCase();
      return !q || `${r.g.name} ${r.g.code} ${r.g.siteName}`.toLowerCase().includes(q);
    })
    .sort((a, b) => order(a.state) - order(b.state) || a.g.name.localeCompare(b.g.name));

  const markers: LiveMarker[] = rows
    .filter((r) => r.p)
    .map(({ g, p, state }) => ({
      id: g.guardId,
      lat: p!.lat,
      lng: p!.lng,
      accuracy: p!.accuracy_m,
      initials: initials(g.name),
      label: g.name.split(" ")[0] ?? g.name,
      sub: p!.battery != null ? `${p!.battery}%` : undefined,
      color: STATE_COLOR[state],
      live: state === "inside" || state === "outside" || state === "sos",
      // Only while the phone is reporting: an old direction is worse than none.
      heading: (state === "inside" || state === "outside" || state === "sos") && p!.heading != null ? p!.heading : null,
    }));

  const sel = rows.find((r) => r.g.guardId === selected) ?? null;

  // The selected guard's path, re-read each time their position moves.
  const selAttendance = sel?.g.attendanceId ?? null;
  const selHeard = heardAt(sel?.p ?? null);
  useEffect(() => {
    if (!selAttendance) return;
    let cancelled = false;
    void supabaseBrowser()
      .rpc("guard_trail", { p_attendance_id: selAttendance })
      .then(({ data }) => {
        if (cancelled) return;
        const t = data as { points?: TrailTuple[] } | null;
        setLoadedTrail({ id: selAttendance, points: toPoints(t?.points) });
      });
    return () => {
      cancelled = true;
    };
  }, [selAttendance, selHeard]);
  const trail = loadedTrail && loadedTrail.id === selAttendance ? loadedTrail.points : NO_TRAIL;

  const stats = trail.length > 1 ? trailStats(trail) : null;

  // A guard picked: the camera goes to them, or to their site while no fix has come in yet.
  function pick(id: string | null) {
    setSelected(id);
    if (!id) return;
    const p = positions[id];
    const site = sites.find((s) => s.id === guards.find((g) => g.guardId === id)?.siteId);
    const at = p ? { lat: p.lat, lng: p.lng } : site ? { lat: site.lat, lng: site.lng } : null;
    if (at) setFocus({ ...at, key: `${id}:${Date.now()}` });
  }

  // Full screen is the map and the guard's card together. The map's own button made only
  // the map full screen, and the card (drawn over it, outside it) vanished.
  const stage = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.current?.requestFullscreen?.();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div ref={stage} className={cn("relative h-[62vh] min-h-[420px] bg-card lg:h-[calc(100dvh-210px)]", full && "h-screen lg:h-screen")}>
        <LiveMap
          sites={sites}
          guards={markers}
          selected={selected}
          onSelect={pick}
          trail={selected ? trail : undefined}
          focus={focus}
          className="h-full"
        />
        <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-2">
          <span className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-card/95 px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 ring-border">
            <span className={cn("size-2 rounded-full", live ? "animate-pulse bg-emerald-500" : "bg-slate-400")} />
            {live ? `Live · ${rows.length} on duty` : "Connecting…"}
          </span>
        </div>
        <button
          type="button"
          onClick={toggleFull}
          aria-label={full ? "Leave full screen" : "Full screen"}
          className="absolute top-[60px] right-3 z-10 grid size-10 place-items-center rounded-md bg-card text-foreground shadow-md ring-1 ring-border hover:bg-muted"
        >
          {full ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
        </button>

        {/* A guard picked on the map or in the list: everything about them, over the map. */}
        {sel && (
          <GuardCard
            row={sel}
            now={now}
            walkedM={stats?.distanceM ?? null}
            outsideMin={stats?.outsideMinutes ?? null}
            points={trail.length}
            onClose={() => setSelected(null)}
            onProfile={() => openProfile(sel.g.guardId)}
            onCenter={() => sel.p && setFocus({ lat: sel.p.lat, lng: sel.p.lng, key: `${sel.g.guardId}:${now}:${trail.length}` })}
          />
        )}
      </div>

      <PersonPreviewDialog personId={profileId} onClose={() => setProfileId(null)} />

      {/* Below the map on a phone, beside it on a desk: always its own scroll, so a
          list of two hundred guards never pushes the map off the screen. */}
      <aside className="flex max-h-[75vh] min-h-0 flex-col overflow-hidden rounded-2xl border border-app-line bg-card lg:h-[calc(100dvh-210px)] lg:max-h-none">
        <div className="space-y-3 border-b border-app-line-soft p-3">
          <label className="flex h-10 items-center gap-2 rounded-full bg-muted/70 px-3.5 ring-1 ring-border/60 focus-within:ring-2 focus-within:ring-ring/50">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guard, code or site"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={cn(
                  "press rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors",
                  filter === f.key ? "bg-foreground text-background ring-foreground" : "bg-card text-muted-foreground ring-border hover:text-foreground",
                )}
              >
                {f.label} <span className="tabular-nums opacity-70">{counts[f.key] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {guards.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nobody is checked in. Guards appear here the moment they check in from the app, and are followed until they check out.
            </p>
          )}
          {guards.length > 0 && shown.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No guard matches.</p>}
          <ul className="divide-y divide-app-line-soft">
            {shown.map(({ g, p, state }) => {
              const open = selected === g.guardId;
              return (
                <li key={g.guardId} className={cn(open && "bg-sky-50 dark:bg-sky-500/10")}>
                  <button type="button" onClick={() => pick(open ? null : g.guardId)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: STATE_COLOR[state] }}>
                      {initials(g.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{g.name}</span>
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", STATE_CHIP[state])}>{STATE_LABEL[state]}</span>
                      </span>
                      <span className="flex items-center gap-x-2.5 truncate text-xs text-muted-foreground">
                        <span className="truncate">{g.siteName}</span>
                        <BatteryChip level={p?.battery ?? null} charging={p?.charging ?? null} />
                        <span className="shrink-0">{ago(heardAt(p), now)}</span>
                        {g.deviceFlag && <AlertTriangle className="size-3.5 shrink-0 text-amber-600" aria-label="Phone flagged" />}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {notArrived.length > 0 && (
            <div className="border-t border-app-line p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                <UserRoundX className="size-4" /> Not arrived · {notArrived.length}
              </p>
              <ul className="space-y-1.5">
                {notArrived.map((n) => (
                  <li key={n.shiftId} className="flex items-center gap-2 rounded-xl bg-rose-500/5 px-2.5 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{n.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {n.siteName} · due {new Date(n.startsAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true })}
                      </span>
                    </span>
                    {n.phone && (
                      <a href={`tel:${n.phone}`} aria-label={`Call ${n.name}`} className="grid size-8 place-items-center rounded-full ring-1 ring-border hover:bg-muted">
                        <Phone className="size-3.5" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

type Row = { g: DutyGuard; p: LivePosition | null; state: GuardState };

/**
 * The detail card for one guard, floating over the map: who, where, how their
 * phone is doing, and what to do about it. Bottom-left on a desk, full width on a
 * phone, so it never hides the dot it describes for long.
 */
function GuardCard({
  row: { g, p, state },
  now,
  walkedM,
  outsideMin,
  points,
  onClose,
  onProfile,
  onCenter,
}: {
  row: Row;
  now: number;
  walkedM: number | null;
  outsideMin: number | null;
  points: number;
  onClose: () => void;
  onProfile: () => void;
  onCenter: () => void;
}) {
  const since = new Date(g.checkInAt).getTime();
  const warn = g.device && (g.device.permission !== "always" || g.device.gps === false || g.device.batteryOptimized === true);
  return (
    <div className="absolute inset-x-3 bottom-3 z-10 max-h-[calc(100%-4.5rem)] overflow-y-auto rounded-2xl bg-card/98 shadow-xl ring-1 ring-border backdrop-blur sm:right-auto sm:w-[380px]">
      <div className="flex items-start gap-3 p-4 pb-3">
        <button type="button" onClick={onProfile} aria-label={`${g.name}: full profile`} className="press grid size-12 shrink-0 place-items-center rounded-full text-base font-semibold text-white" style={{ background: STATE_COLOR[state] }}>
          {initials(g.name)}
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onProfile} className="block max-w-full truncate text-left text-base font-semibold hover:underline">
            {g.name}
          </button>
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-mono">{g.code}</span> · {g.siteName}
          </p>
          <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", STATE_CHIP[state])}>{STATE_LABEL[state]}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>

      <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5 border-y border-app-line-soft px-4 py-3 text-xs">
        <Fact label="On duty" value={duration((now - since) / 60_000)} />
        <Fact label="Checked in" value={istClock(since)} />
        <Fact label="Last heard" value={ago(heardAt(p), now)} />
        <Fact label="Battery" value={p?.battery != null ? `${p.battery}%${p.charging ? " ⚡" : ""}` : "-"} />
        <Fact label="GPS" value={p ? `±${Math.round(p.accuracy_m)} m` : "-"} />
        <Fact label="Speed" value={p?.speed_mps != null ? `${(p.speed_mps * 3.6).toFixed(1)} km/h` : "-"} />
        <Fact label="From centre" value={p?.distance_m != null ? km(p.distance_m) : "-"} />
        <Fact label="Walked" value={walkedM != null ? km(walkedM) : "-"} />
        <Fact label="Outside fence" value={outsideMin != null ? duration(outsideMin) : "-"} />
      </dl>

      <div className="space-y-2 px-4 py-3 text-xs">
        <p className="flex items-center gap-2 text-muted-foreground">
          <Smartphone className="size-3.5 shrink-0" />
          <span className="truncate">
            {g.device ? `${g.device.label}${g.device.appVersion ? ` · app ${g.device.appVersion}` : ""}` : "Phone not registered"}
          </span>
          {g.device && !g.device.approved && <span className="shrink-0 font-semibold text-amber-700">not approved</span>}
        </p>
        {g.deviceFlag && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {g.deviceFlag === "shared_device" ? "Checked in on a phone registered to another guard." : "Checked in on a phone not yet approved for them."} Held for review in Devices.
          </p>
        )}
        {g.device && (!g.device.approved || g.deviceFlag) && <ApproveDevice g={g} />}
        {warn && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-amber-800 dark:text-amber-200">
            <LocateOff className="mt-0.5 size-3.5 shrink-0" />
            {g.device?.gps === false
              ? "GPS was switched off on this phone at its last report."
              : g.device?.permission !== "always"
                ? "Location is not set to “Allow all the time”, so tracking stops when the app is closed."
                : "Battery saver is on for the app, so the phone may stop tracking when the app is closed."}
          </p>
        )}
        {(state === "offline" || state === "stale") && g.silentAlertedAt && (
          <p className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-2.5 text-rose-800 dark:text-rose-200">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            The phone went quiet. NBSS wakes it every few minutes; the last wake-up was at {istClock(new Date(g.silentAlertedAt).getTime())} and asked the guard to open the app.
          </p>
        )}
        {points <= 1 && (
          <p className="text-muted-foreground">No path yet beyond the check-in point.</p>
        )}
      </div>

      <div className="px-4 pb-2">
        <WakeButton guardId={g.guardId} name={g.name} />
      </div>
      <div className="flex gap-2 px-4 pb-4">
        {g.phone && (
          <a href={`tel:${g.phone}`} className="press inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground">
            <Phone className="size-4" /> Call
          </a>
        )}
        <Link
          href={`/console/routes?attendance=${g.attendanceId}`}
          className="press inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1 ring-border hover:bg-muted"
        >
          <Route className="size-4" /> Full route
        </Link>
        <button type="button" onClick={onCenter} aria-label="Centre on the map" className="press grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-border hover:bg-muted">
          <Crosshair className="size-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Wakes the guard's phone now: a silent push that restarts tracking in the
 * background, and a visible "the office is checking on you" in case it cannot.
 * The watchdog does the same on its own every few minutes while a phone is quiet.
 */
function WakeButton({ guardId, name }: { guardId: string; name: string }) {
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

function order(s: GuardState): number {
  return { sos: 0, outside: 1, offline: 2, stale: 3, waiting: 4, inside: 5 }[s];
}

function BatteryChip({ level, charging }: { level: number | null; charging: boolean | null }) {
  if (level == null) return <span>Battery -</span>;
  const Icon = charging ? BatteryCharging : level <= 10 ? BatteryWarning : level <= 25 ? BatteryLow : Battery;
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", level <= 20 && !charging && "font-semibold text-rose-600")}>
      <Icon className="size-3.5" /> {level}%
    </span>
  );
}

function Fact({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Battery }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1 truncate font-medium">
        {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
        {value}
      </dd>
    </div>
  );
}

/**
 * Approves the guard's phone from the map card, and accepts the check-in it held, so a
 * supervisor who has just seen the guard on the map does not have to go to Devices.
 */
function ApproveDevice({ g }: { g: DutyGuard }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const approve = async () => {
    if (!g.device) return;
    setBusy(true);
    const r = await setDeviceStatus(g.device.id, "approved");
    const held = r.ok && g.deviceFlag ? await reviewFlaggedPunch(g.attendanceId, true) : { ok: true as const };
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    if (!held.ok) toast.error("The phone is approved, but the check-in could not be accepted. Accept it in Devices.");
    else toast.success(`${g.device.label} approved for ${g.name}.`);
    router.refresh();
  };
  return (
    <button
      type="button"
      onClick={() => void approve()}
      disabled={busy}
      className="press inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
    >
      <ShieldCheck className="size-4" />
      {busy ? "Approving…" : g.deviceFlag ? "Approve phone and check-in" : "Approve phone"}
    </button>
  );
}
