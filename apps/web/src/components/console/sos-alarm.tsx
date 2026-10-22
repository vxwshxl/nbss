"use client";

import { BellOff, Siren } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SOS_KIND_LABEL, type SosKind, type SosStatus } from "@nbss/shared/sos";

import { SosPreviewDialog } from "@/components/console/sos-preview";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Alert = { id: string; status: SosStatus; kind: SosKind; site: string; guard: string };

/**
 * The console's alarm. Whatever page an admin, developer or supervisor is on, a new SOS
 * sounds a siren, raises a notification card that stays until it is dealt with, and (with
 * the tab in the background) a system notification. Open shows the alert's own popup,
 * the site map with the guard on it, without leaving the page.
 *
 * The siren repeats while any alert is still waiting for a first response, and stops by
 * itself the moment someone answers. Silence only quietens this tab.
 *
 * Browsers will not play sound before the page has been clicked or typed in, so the
 * audio is unlocked on the first gesture, and an alarm already waiting starts then.
 */
export function SosAlarm() {
  const [open, setOpen] = useState<string | null>(null);
  const waiting = useRef(new Map<string, Alert>());
  const silenced = useRef(new Set<string>());

  useEffect(() => {
    const supabase = supabaseBrowser();
    let cancelled = false;
    const s = new SirenPlayer();

    const sync = () => {
      const loud = [...waiting.current.values()].some((a) => a.status === "active" && !silenced.current.has(a.id));
      if (loud) s.start();
      else s.stop();
      document.title = loud ? `SOS · ${document.title.replace(/^SOS · /, "")}` : document.title.replace(/^SOS · /, "");
    };

    const show = (a: Alert) => {
      toast.custom(
        (t) => (
          <div className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border-2 border-danger/40 bg-elevated shadow-e3">
            <div className="flex items-center gap-3 bg-danger px-4 py-2.5 text-white">
              <Siren className="size-5 animate-pulse" />
              <p className="flex-1 text-sm font-semibold">SOS · {SOS_KIND_LABEL[a.kind] ?? "Emergency"}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[15px] font-semibold">{a.site}</p>
              <p className="text-[13px] text-secondary-fg">Raised by {a.guard}. Guards inside the fence and the client have been alerted.</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    silenced.current.add(a.id);
                    sync();
                    setOpen(a.id);
                    toast.dismiss(t);
                  }}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-full bg-ink px-4 text-sm font-medium text-ink-fg"
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => {
                    silenced.current.add(a.id);
                    sync();
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-border px-3 text-sm font-medium hover:bg-muted"
                >
                  <BellOff className="size-4" /> Silence
                </button>
              </div>
            </div>
          </div>
        ),
        { id: `sos:${a.id}`, duration: Infinity },
      );

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
        .select("id, status, kind, sites(name), guard:profiles!sos_alerts_raised_by_fkey(full_name)")
        .eq("id", id)
        .maybeSingle();
      if (!data) return null;
      const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
      return {
        id: data.id,
        status: data.status as SosStatus,
        kind: data.kind as SosKind,
        site: one(data.sites as unknown as { name: string } | null)?.name ?? "a site",
        guard: one(data.guard as unknown as { full_name: string } | null)?.full_name ?? "a guard",
      };
    };

    const track = async (id: string, status: SosStatus) => {
      if (status !== "active" && status !== "acknowledged") {
        waiting.current.delete(id);
        toast.dismiss(`sos:${id}`);
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
      if (a.status === "active") show(a);
      sync();
    };

    // Anything already waiting when the console opens.
    void supabase
      .from("sos_alerts")
      .select("id, status")
      .eq("status", "active")
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
      removeEventListener("pointerdown", unlock);
      removeEventListener("keydown", unlock);
      void supabase.removeChannel(channel);
    };
  }, []);

  return <SosPreviewDialog id={open} onClose={() => setOpen(null)} />;
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
