"use client";

import { BellOff, ChevronRight, MapPin, Siren } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { SOS_KIND_LABEL, type SosKind, type SosStatus } from "@nbss/shared/sos";

import { SOS_OPENED_EVENT, SosPreviewDialog } from "@/components/console/sos-preview";
import { Nibo } from "@/components/nibo/nibo";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Alert = { id: string; status: SosStatus; kind: SosKind; site: string; guard: string; raisedAt: string };

/**
 * The console's alarm. Whatever page an admin, developer or supervisor is on, a new SOS
 * sounds a siren, puts the alarm Nibo in the corner (who, where, Open map, Silence)
 * until the alert is resolved or stood down, and with the tab in the background a
 * system notification. Open shows the alert's own popup, the site map with the guard
 * on it, without leaving the page.
 *
 * The siren repeats while any alert is still waiting for a first response, and stops by
 * itself the moment someone answers. Silence, or opening its details, quietens this browser until it is resolved.
 *
 * Browsers will not play sound before the page has been clicked or typed in, so the
 * audio is unlocked on the first gesture, and an alarm already waiting starts then.
 */
const HUSHED_KEY = "nbss-sos-hushed";

export function SosAlarm() {
  const [open, setOpen] = useState<string | null>(null);
  // What the mascot shows: every SOS still open, newest first.
  const [live, setLive] = useState<Alert[]>([]);
  const [hushed, setHushed] = useState<string[]>([]);
  const hush = useRef<(id: string) => void>(() => undefined);
  const waiting = useRef(new Map<string, Alert>());
  const silenced = useRef(new Set<string>());

  // Silenced alerts stay silent across a reload, until they are resolved.
  useEffect(() => {
    try {
      for (const id of JSON.parse(localStorage.getItem(HUSHED_KEY) ?? "[]") as string[]) silenced.current.add(id);
    } catch {
      // No storage: silencing lasts for this page only.
    }
  }, []);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let cancelled = false;
    const s = new SirenPlayer();

    const sync = () => {
      const loud = [...waiting.current.values()].some((a) => a.status === "active" && !silenced.current.has(a.id));
      if (loud) s.start();
      else s.stop();
      document.title = loud ? `SOS · ${document.title.replace(/^SOS · /, "")}` : document.title.replace(/^SOS · /, "");
      const all = [...waiting.current.values()].sort((a, b) => b.raisedAt.localeCompare(a.raisedAt));
      setLive(all);
      setHushed([...silenced.current]);
      if (all.length) document.body.dataset.sosLive = "";
      else delete document.body.dataset.sosLive;
    };

    const remember = () => {
      try {
        localStorage.setItem(HUSHED_KEY, JSON.stringify([...silenced.current].filter((id) => waiting.current.has(id))));
      } catch {
        // No storage: nothing to remember it in.
      }
    };

    hush.current = (id: string) => {
      silenced.current.add(id);
      remember();
      sync();
    };

    // The details opened from anywhere (the SOS page, the dashboard, a site) silence it.
    const opened = (e: Event) => hush.current((e as CustomEvent<string>).detail);
    addEventListener(SOS_OPENED_EVENT, opened);

    const show = (a: Alert) => {
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
        const n = new Notification(`SOS at ${a.site}`, { body: `${SOS_KIND_LABEL[a.kind] ?? "Emergency"} · raised by ${a.guard}`, tag: a.id, requireInteraction: true });
        n.onclick = () => {
          window.focus();
          setOpen(a.id);
          n.close();
        };
      }
    };

    const load = async (id: string): Promise<Alert | null> => {
      const { data } = await supabase
        .from("sos_alerts")
        .select("id, status, kind, raised_at, sites(name), guard:profiles!sos_alerts_raised_by_fkey(full_name)")
        .eq("id", id)
        .maybeSingle();
      if (!data) return null;
      const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
      return {
        id: data.id,
        status: data.status as SosStatus,
        kind: data.kind as SosKind,
        raisedAt: data.raised_at,
        site: one(data.sites as unknown as { name: string } | null)?.name ?? "a site",
        guard: one(data.guard as unknown as { full_name: string } | null)?.full_name ?? "a guard",
      };
    };

    const track = async (id: string, status: SosStatus) => {
      if (status !== "active" && status !== "acknowledged") {
        waiting.current.delete(id);
        silenced.current.delete(id);
        sync();
        return;
      }
      const known = waiting.current.get(id);
      if (known) {
        known.status = status;
        sync();
        return;
      }
      const a = await load(id);
      if (!a || cancelled) return;
      waiting.current.set(id, a);
      show(a);
      sync();
    };

    // Anything already waiting when the console opens.
    void supabase
      .from("sos_alerts")
      .select("id, status")
      .in("status", ["active", "acknowledged"])
      .then(({ data }) => {
        for (const r of data ?? []) void track(r.id, r.status as SosStatus);
      });

    const channel = supabase
      .channel("console-sos")
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_alerts" }, (e) => {
        const row = (e.new ?? {}) as { id?: string; status?: SosStatus };
        if (row.id && row.status) void track(row.id, row.status);
      });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe();
    });

    // The first click or key press unlocks sound, and asks once for notifications.
    const unlock = () => {
      s.unlock();
      sync();
      if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
      removeEventListener("pointerdown", unlock);
      removeEventListener("keydown", unlock);
    };
    addEventListener("pointerdown", unlock);
    addEventListener("keydown", unlock);

    return () => {
      cancelled = true;
      s.stop();
      removeEventListener(SOS_OPENED_EVENT, opened);
      delete document.body.dataset.sosLive;
      removeEventListener("pointerdown", unlock);
      removeEventListener("keydown", unlock);
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <>
      {live.length > 0 && (
        <SosNibo
          alerts={live}
          quiet={live.every((a) => a.status !== "active" || hushed.includes(a.id))}
          onSilence={() => live.forEach((a) => hush.current(a.id))}
          onOpen={(id) => {
            hush.current(id);
            setOpen(id);
          }}
        />
      )}
      <SosPreviewDialog id={open} onClose={() => setOpen(null)} />
    </>
  );
}

const IST = "Asia/Kolkata";

/**
 * Nibo, raising the alarm. While any SOS is open the usual companion steps aside
 * (body[data-sos-live] hides it) and this one stands in its corner on every page:
 * pulsing red, with a bubble saying who, where and how long ago, until the alert is
 * resolved or stood down. Every open SOS, from every site: this is the office's view.
 */
function SosNibo({ alerts, quiet, onOpen, onSilence }: { alerts: Alert[]; quiet: boolean; onOpen: (id: string) => void; onSilence: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const a = alerts[0]!;
  const mins = Math.max(0, Math.round((now - new Date(a.raisedAt).getTime()) / 60_000));
  const answered = a.status === "acknowledged";

  return (
    <div data-sos-nibo="" className="fixed right-4 bottom-4 z-50 flex items-end gap-3 print:hidden" role="alert">
      <div className="w-[min(20rem,calc(100vw-7rem))] overflow-hidden rounded-2xl bg-white text-[#111827] shadow-e3 ring-2 ring-danger">
        <div className="flex items-center gap-2 bg-danger px-3.5 py-2 text-white">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-white" />
          </span>
          <p className="flex-1 text-xs font-bold tracking-wide uppercase">
            {alerts.length > 1 ? `${alerts.length} SOS open` : `SOS · ${SOS_KIND_LABEL[a.kind] ?? "Emergency"}`}
          </p>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">{answered ? "Answered" : "No answer"}</span>
        </div>
        <div className="space-y-1 px-3.5 pt-2.5">
          <p className="text-sm font-semibold">
            {a.guard} needs help at {a.site}
          </p>
          <p className="text-xs text-[#6b7280]">
            Raised {new Date(a.raisedAt).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true })} ·{" "}
            {mins < 1 ? "just now" : `${mins} min ago`}
            {alerts.length > 1 ? ` · and ${alerts.length - 1} more` : ""}
          </p>
        </div>
        <div className="flex gap-2 p-3.5 pt-3">
          <button
            type="button"
            onClick={() => onOpen(a.id)}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-danger px-3 text-sm font-semibold text-white hover:brightness-95"
          >
            <MapPin className="size-4" /> Open map
          </button>
          {!quiet && (
            <button
              type="button"
              onClick={onSilence}
              title="Stops the siren in this browser until the SOS is resolved"
              className="inline-flex h-9 items-center gap-1 rounded-full border border-[#d1d5db] px-3 text-sm font-semibold text-[#111827] hover:bg-[#f3f4f6]"
            >
              <BellOff className="size-4" /> Silence
            </button>
          )}
          <Link
            href="/console/sos"
            className="inline-flex h-9 items-center gap-0.5 rounded-full border border-[#d1d5db] px-3 text-sm font-semibold text-[#111827] hover:bg-[#f3f4f6]"
          >
            All <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
      <button type="button" onClick={() => onOpen(a.id)} aria-label="Open the SOS" className="relative grid size-[76px] shrink-0 place-items-end justify-center">
        <span className="absolute inset-1 animate-ping rounded-full bg-danger/40 motion-reduce:animate-none" />
        <span className="absolute inset-1 rounded-full bg-danger/15 ring-2 ring-danger" />
        <Nibo uid="sos-nibo" mood="oops" className="relative size-[76px]" />
        <span className="absolute -top-1 -right-1 grid size-7 place-items-center rounded-full bg-danger text-white shadow-md ring-2 ring-white">
          <Siren className="size-4 animate-pulse" />
        </span>
      </button>
    </div>
  );
}

/** A two-tone siren from the Web Audio API: no file to load, and it cannot be cached stale. */
class SirenPlayer {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private wanted = false;

  unlock() {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
    } catch {
      this.ctx = null;
    }
    if (this.wanted) this.loop();
  }

  start() {
    this.wanted = true;
    if (this.ctx && !this.timer) this.loop();
  }

  stop() {
    this.wanted = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private loop() {
    if (this.timer || !this.ctx) return;
    const beep = () => {
      const ctx = this.ctx;
      if (!ctx) return;
      void ctx.resume();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(960, t);
      osc.frequency.setValueAtTime(770, t + 0.4);
      osc.frequency.setValueAtTime(960, t + 0.8);
      osc.frequency.setValueAtTime(770, t + 1.2);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
      gain.gain.setValueAtTime(0.18, t + 1.5);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.65);
    };
    beep();
    this.timer = setInterval(beep, 2600);
  }
}
