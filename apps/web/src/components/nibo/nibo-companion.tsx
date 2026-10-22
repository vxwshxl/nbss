"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { MoreHorizontal, X } from "lucide-react";
import { Nibo, type NiboMood } from "@/components/nibo/nibo";
import { NiboBrain, type NiboLevel } from "@/lib/nibo/brain";
import { pageTip } from "@/lib/nibo/tips";
import { loadNiboNudges } from "@/lib/nibo/actions";
import type { NiboAction, NiboLine } from "@/lib/nibo/types";
import { cn } from "@/lib/utils";

/**
 * Nibo as a companion: always on screen in the console, and now and then, only
 * when it is likely to help, he flies over to something and says one short
 * thing with a button to act on it.
 *
 * What he says, most urgent first:
 *  1. help    a form field just failed (native validation, or a server error
 *             marked [data-nibo-error]): he flies to the field and explains.
 *  2. nudge   live NBSS data for this person (lib/nibo/nudges.ts): an open
 *             SOS, punches to review, a guard who has not arrived.
 *  3. tip     one hint per page, the first times it is opened (lib/nibo/tips.ts).
 *
 * When he stays quiet (the brain in lib/nibo/brain.ts decides the pace):
 * someone is typing or has a dialog open, the tab is hidden, nobody has moved
 * the mouse or touched a key for 45 s, the assistant is open, it is within a
 * few seconds of the page loading, or he spoke too recently for this person's
 * taste, which he learns from what they do with his tips. Tap ⋯ to make him
 * chattier, quieter, quiet for today, or silent.
 */

const SIZE_DESKTOP = 76;
const SIZE_PHONE = 58;
const MARGIN = 16;
const AWAY_MS = 45_000;
const SETTLE_MS = 4_000;

type Showing = NiboLine & { el?: Element | null };

const LEVELS: { value: NiboLevel; label: string }[] = [
  { value: "chatty", label: "Chatty" },
  { value: "normal", label: "Normal" },
  { value: "quiet", label: "Quiet" },
  { value: "off", label: "Tips off" },
];

function editable(el: Element | null): boolean {
  if (!el) return false;
  const t = el as HTMLElement;
  return t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
}

function inDialog(el: Element | null): boolean {
  return !!el?.closest('[role="dialog"], [role="alertdialog"], [data-slot="dialog-content"]');
}

/** Is a modal open (not Nibo's own pieces)? */
function dialogOpen(): boolean {
  return !!document.querySelector(
    '[data-slot="dialog-content"], [role="alertdialog"], [aria-modal="true"]:not([data-nibo])',
  );
}

function visible(el: Element | null): el is Element {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}

/** What went wrong with a field, the way a person would say it. */
function friendly(el: Element, fallback: string): string {
  const input = el as HTMLInputElement;
  const v = input.validity;
  const label = labelFor(el);
  const what = label ? `“${label}”` : "This";
  if (!v) return fallback;
  if (v.valueMissing) return `${what} is needed before we can go on.`;
  if (v.typeMismatch && input.type === "email") return "That email looks a little off. Something like name@example.com?";
  if (v.typeMismatch && input.type === "url") return "That link needs the full address, like https://example.com";
  if (v.tooShort) return `${what} looks too short. ${fallback}`;
  return label ? `Could you check ${what}? ${fallback}` : fallback;
}

function labelFor(el: Element): string {
  const input = el as HTMLInputElement;
  const byFor = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
  const text = (byFor?.textContent ?? input.closest("label")?.textContent ?? input.getAttribute("aria-label") ?? input.placeholder ?? "")
    .replace(/\*/g, "")
    .trim();
  return text.length > 40 ? "" : text;
}

export function NiboCompanion({
  person,
  onOpen,
  onAsk,
  hidden = false,
  nudges = false,
  tips = false,
  defaultLevel,
  openLabel = "Open Nibo, your assistant",
}: {
  /** Whose preferences these are (profile id, or "visitor"). */
  person: string;
  /** Tapping Nibo (the assistant in a console, the FAQ on the site). */
  onOpen?: () => void;
  /** An "Ask Nibo" action: open the assistant with this question. */
  onAsk?: (question: string) => void;
  /** e.g. while the assistant panel is open. */
  hidden?: boolean;
  /** Live NBSS data nudges. */
  nudges?: boolean;
  /** One hint per page. */
  tips?: boolean;
  defaultLevel?: NiboLevel;
  openLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  // His memory of this person (localStorage; on the server it starts blank and
  // nothing renders until the client has placed him).
  const [brain] = useState(() => new NiboBrain(person, { level: defaultLevel }));
  const brainRef = useRef<NiboBrain | null>(brain);
  const [level, setLevel] = useState<NiboLevel>(() => brain.level);
  const [line, setLine] = useState<Showing | null>(null);
  const [mood, setMood] = useState<NiboMood>("happy");
  const [menu, setMenu] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState(SIZE_DESKTOP);
  const [calm, setCalm] = useState(false);
  // On a phone the screen is the page: no tour lines or page tips, and he
  // stays in his corner: only live nudges and form help get a bubble.
  const [phone, setPhone] = useState(false);

  // Everything the scheduler reads without re-subscribing.
  // (Times are stamped on mount: render must stay pure.)
  const live = useRef({
    lastInput: 0,
    lastKey: 0,
    pageAt: 0,
    queue: [] as Showing[],
    nudges: [] as NiboLine[],
    nudgesAt: 0,
    hover: false,
    hidden,
    line: null as Showing | null,
  });
  useEffect(() => {
    live.current.hidden = hidden;
    live.current.line = line;
  });

  useEffect(() => {
    live.current.lastInput = Date.now();
    live.current.pageAt = Date.now();
  }, []);

  useEffect(() => {
    const phone = matchMedia("(max-width: 640px)");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setSize(phone.matches ? SIZE_PHONE : SIZE_DESKTOP);
      setPhone(phone.matches);
      setCalm(reduce.matches);
    };
    update();
    phone.addEventListener("change", update);
    reduce.addEventListener("change", update);
    return () => {
      phone.removeEventListener("change", update);
      reduce.removeEventListener("change", update);
    };
  }, []);

  // ---- Where he stands ------------------------------------------------------
  const home = useCallback(() => {
    const x = innerWidth - size - MARGIN;
    let y = innerHeight - size - MARGIN;
    // Step up out of the way of anything marked [data-nibo-avoid] (the
    // footer's credit line) when it's on screen under his corner.
    const avoid = document.querySelector("[data-nibo-avoid]")?.getBoundingClientRect();
    if (avoid && avoid.top < y + size && avoid.bottom > 0) y = Math.min(y, avoid.top - size - 8);
    return { x, y };
  }, [size]);

  /**
   * Beside an element. A form field: the first spot around it (right, left,
   * above, below) that doesn't sit on another field, button or text. Anything
   * else: its right if there's room, else left, else above.
   */
  const beside = useCallback(
    (el: Element) => {
      if (el.matches("input, select, textarea")) {
        const r = el.getBoundingClientRect();
        const midY = r.top + r.height / 2 - size / 2;
        const spots = [
          { x: r.right + 10, y: midY },
          { x: r.left - size - 10, y: midY },
          { x: r.right - size, y: r.top - size - 6 },
          { x: r.right - size, y: r.bottom + 6 },
        ];
        const free = (p: { x: number; y: number }) => {
          if (p.x < 8 || p.y < 8 || p.x + size > innerWidth - 8 || p.y + size > innerHeight - 8) return false;
          for (const [fx, fy] of [[0.2, 0.2], [0.8, 0.2], [0.5, 0.5], [0.2, 0.8], [0.8, 0.8]] as const) {
            // What's under that point, looking through Nibo himself.
            const hit = document
              .elementsFromPoint(p.x + size * fx, p.y + size * fy)
              .find((h) => !h.closest("[data-nibo]"));
            if (hit?.closest("input, select, textarea, button, a, label, p, h1, h2, h3, img, [role='button']")) return false;
          }
          return true;
        };
        const spot = spots.find(free) ?? spots[0]!;
        return { x: Math.max(8, Math.min(innerWidth - size - 8, spot.x)), y: Math.max(8, Math.min(innerHeight - size - 8, spot.y)) };
      }
      const r = el.getBoundingClientRect();
      const tall = r.height > innerHeight * 0.6;
      // Middle of the part that's on screen.
      const midY = tall ? (Math.max(r.top, 0) + Math.min(r.bottom, innerHeight)) / 2 : r.top + r.height / 2;
      let x = r.right + 12;
      let y = midY - size / 2;
      if (r.width > innerWidth * 0.8) {
        // A full-width section: ride along the right edge, low down; headings
        // sit high and centred, so his bubble stays off them.
        x = innerWidth - size - MARGIN;
        const top = Math.max(r.top, 0);
        y = top + (Math.min(r.bottom, innerHeight) - top) * 0.72 - size / 2;
      } else {
        if (x + size > innerWidth - 8) x = r.left - size - 12;
        if (x < 8) {
          x = Math.min(innerWidth - size - 8, r.right - size);
          y = r.top - size - 10;
        }
      }
      return {
        x: Math.max(8, Math.min(innerWidth - size - 8, x)),
        y: Math.max(72, Math.min(innerHeight - size - 8, y)),
      };
    },
    [size],
  );

  // Follow whatever he's talking about (or the section in view) as the page
  // scrolls; back to the corner when it's gone.
  const anchorRef = useRef<Element | null>(null);
  useEffect(() => {
    let raf = 0;
    const place = () => {
      raf = 0;
      const a = anchorRef.current;
      setPos(a && visible(a) ? beside(a) : home());
    };
    const onMove = () => {
      if (!raf) raf = requestAnimationFrame(place);
    };
    place();
    addEventListener("scroll", onMove, { passive: true, capture: true });
    addEventListener("resize", onMove);
    const t = setInterval(onMove, 1000);
    return () => {
      removeEventListener("scroll", onMove, { capture: true });
      removeEventListener("resize", onMove);
      clearInterval(t);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [beside, home]);

  const anchor = useCallback(
    (el: Element | null) => {
      anchorRef.current = el;
      setPos(el && visible(el) ? beside(el) : home());
    },
    [beside, home],
  );

  // While he flies somewhere new the thruster flares (data-nibo-moving).
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [flying, setFlying] = useState(false);
  useEffect(() => {
    if (!pos) return;
    const prev = lastPos.current;
    lastPos.current = pos;
    if (!prev || (Math.abs(prev.x - pos.x) < 2 && Math.abs(prev.y - pos.y) < 2)) return;
    setFlying(true);
    const t = setTimeout(() => setFlying(false), 750);
    return () => clearTimeout(t);
  }, [pos]);

  // ---- Saying something -----------------------------------------------------
  const finish = useCallback(
    (outcome: "acted" | "closed" | "ignored") => {
      const cur = live.current.line;
      if (!cur) return;
      brainRef.current?.heard(cur.id, outcome);
      setLine(null);
      setMood(outcome === "acted" ? "cheer" : "happy");
      if (outcome === "acted") setTimeout(() => setMood("happy"), 900);
      anchor(null);
    },
    [anchor],
  );

  const say = useCallback(
    (l: Showing) => {
      brainRef.current?.spoke(l.id, l.kind);
      setMenu(false);
      setLine(l);
      setMood(l.mood ?? "happy");
      const el = l.el ?? (l.target ? document.querySelector(l.target) : null);
      if (el && visible(el)) anchor(el);
      else anchor(null);
    },
    [anchor],
  );

  // Form help: once they start fixing the field, he's done, step aside.
  useEffect(() => {
    if (line?.kind !== "help" || !line.el) return;
    const el = line.el;
    const fixing = () => setTimeout(() => finish("acted"), 500);
    el.addEventListener("input", fixing, { once: true });
    return () => el.removeEventListener("input", fixing);
  }, [line, finish]);

  // Let a line go by itself after a while (longer for longer text); a pointer
  // resting on the bubble holds it.
  useEffect(() => {
    if (!line) return;
    const ms = Math.min(14_000, 6_000 + line.text.length * 55);
    let left = ms;
    let last = Date.now();
    const t = setInterval(() => {
      const now = Date.now();
      if (!live.current.hover && !document.hidden) left -= now - last;
      last = now;
      if (left <= 0) finish("ignored");
    }, 250);
    return () => clearInterval(t);
  }, [line, finish]);

  // ---- Is now a good moment? -------------------------------------------------
  const busy = useCallback(() => {
    const L = live.current;
    if (L.hidden || document.hidden) return true;
    if (Date.now() - L.pageAt < SETTLE_MS) return true;
    if (Date.now() - L.lastInput > AWAY_MS) return true; // nobody's watching
    if (Date.now() - L.lastKey < 4_000) return true; // mid-typing
    if (editable(document.activeElement)) return true;
    return dialogOpen();
  }, []);

  // Presence: any input counts; he dozes off when nobody's around.
  useEffect(() => {
    const L = live.current;
    const wake = () => {
      L.lastInput = Date.now();
      setMood((m) => (m === "sleepy" ? "happy" : m));
    };
    const key = () => {
      L.lastKey = Date.now();
      wake();
    };
    const look = (e: PointerEvent) => {
      wake();
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height * 0.35);
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, len / 240) * 3.2;
      el.style.setProperty("--nibo-lx", ((dx / len) * k).toFixed(2));
      el.style.setProperty("--nibo-ly", ((dy / len) * k).toFixed(2));
    };
    addEventListener("pointermove", look, { passive: true });
    addEventListener("pointerdown", wake, { passive: true });
    addEventListener("keydown", key);
    addEventListener("wheel", wake, { passive: true });
    addEventListener("touchstart", wake, { passive: true });
    const doze = setInterval(() => {
      if (Date.now() - L.lastInput > 60_000 && !L.line) setMood((m) => (m === "happy" ? "sleepy" : m));
    }, 5000);
    return () => {
      removeEventListener("pointermove", look);
      removeEventListener("pointerdown", wake);
      removeEventListener("keydown", key);
      removeEventListener("wheel", wake);
      removeEventListener("touchstart", wake);
      clearInterval(doze);
    };
  }, []);

  // A new page: drop what he was saying (during render, not in an effect),
  // then settle and forget the old page's anchor.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setLine(null);
  }
  useEffect(() => {
    live.current.pageAt = Date.now();
    anchorRef.current = null;
  }, [pathname]);

  // ---- Help with a form ---------------------------------------------------------
  useEffect(() => {
    /** Returns whether he took it on (so the browser's own tooltip can stand down). */
    const help = (el: Element, text: string): boolean => {
      if (inDialog(el)) return false; // the dialog shows its own errors; he'd be behind it
      const b = brainRef.current;
      const id = `help:${(el as HTMLInputElement).name || "field"}`;
      if (!b?.may(id, "help")) return false;
      say({ id, kind: "help", mood: "oops", text, el });
      return true;
    };
    // The browser's own checks (required, type=email, …) on submit. The first
    // invalid field gets Nibo instead of the browser's tooltip (not both).
    // One submit fires `invalid` on every bad field, in order: Nibo takes the
    // first, and the rest of that burst stays quiet too (else the browser's
    // tooltip jumps to the next field and pulls focus away from his).
    let burstAt = 0;
    let taking = false;
    const onInvalid = (e: Event) => {
      const el = e.target as HTMLInputElement;
      if (!el) return;
      const first = Date.now() - burstAt > 300;
      burstAt = Date.now();
      if (!first) {
        if (taking) e.preventDefault();
        return;
      }
      taking = help(el, friendly(el, el.validationMessage));
      if (taking) {
        e.preventDefault();
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
      }
    };
    // Server-side errors drawn under a field (<FieldError> marks them).
    const mo = new MutationObserver((records) => {
      for (const r of records)
        for (const n of r.addedNodes) {
          if (!(n instanceof Element)) continue;
          const err = n.matches("[data-nibo-error]") ? n : n.querySelector("[data-nibo-error]");
          if (!err?.textContent) continue;
          const field = err.parentElement?.querySelector("input, textarea, select") ?? err;
          const label = labelFor(field);
          help(field, label ? `Could you check “${label}”? ${err.textContent.trim()}` : err.textContent.trim());
          return;
        }
    });
    // A form that went through: a little cheer, no words.
    const onSubmit = (e: Event) => {
      const f = e.target as HTMLFormElement;
      if (f.checkValidity?.() && !inDialog(f)) {
        setMood("cheer");
        setTimeout(() => setMood("happy"), 1100);
      }
    };
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("submit", onSubmit, true);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("submit", onSubmit, true);
      mo.disconnect();
    };
  }, [say, calm]);

  // ---- Nudges and page tips: a gentle heartbeat --------------------------------
  useEffect(() => {
    if (!nudges && !tips) return;
    let stop = false;
    const L = live.current;
    const refresh = async () => {
      if (!nudges || Date.now() - L.nudgesAt < 120_000) return;
      L.nudgesAt = Date.now();
      try {
        L.nudges = await loadNiboNudges();
      } catch {
        L.nudges = [];
      }
    };
    void refresh();
    const beat = setInterval(() => {
      if (stop || L.line || busy()) return;
      const b = brainRef.current;
      if (!b || b.wait() > 0) return;
      void refresh();
      const nudge = L.nudges.find((n) => b.may(n.id, "nudge"));
      if (nudge) {
        say(nudge);
        return;
      }
      // A page tip once they've been on the page a little while.
      if (tips && !phone && Date.now() - L.pageAt > 8_000) {
        const tip = pageTip(location.pathname);
        if (tip && b.may(tip.id, "tip")) say(tip);
      }
    }, 3_000);
    return () => {
      stop = true;
      clearInterval(beat);
    };
  }, [nudges, tips, phone, say, busy]);

  // ---- Doing what the button says ------------------------------------------------
  const act = (a: NiboAction) => {
    finish("acted");
    if ("href" in a) router.push(a.href);
    else if ("ask" in a) onAsk?.(a.ask);
    else if ("focus" in a) {
      const el = document.querySelector<HTMLElement>(a.focus);
      el?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
      setTimeout(() => el?.focus(), 350);
    }
  };

  const changeLevel = (l: NiboLevel) => {
    brainRef.current?.setLevel(l);
    setLevel(l);
    setMenu(false);
    if (l === "off") finish("closed");
  };
  const notToday = () => {
    brainRef.current?.snoozeToday();
    setMenu(false);
    finish("closed");
  };

  // Long-press (touch) opens his menu; a tap does what tapping Nibo does.
  const press = useRef<{ t: number; timer: ReturnType<typeof setTimeout> | null }>({ t: 0, timer: null });

  if (!pos) return null;
  const onRight = pos.x + size / 2 > innerWidth / 2;
  const below = pos.y < 220;
  const actions = line?.actions?.filter((a) => !("ask" in a) || onAsk).slice(0, 2) ?? [];

  // On <body>: inside a page column he'd be caught in its stacking and
  // positioning (a transformed or sticky ancestor), clipped and misplaced.
  return createPortal(
    <div
      ref={rootRef}
      data-nibo=""
      data-nibo-moving={flying ? "true" : undefined}
      className={cn(
        "pointer-events-none fixed top-0 left-0 z-40 print:hidden",
        !calm && "transition-transform duration-700 ease-[cubic-bezier(0.34,1.3,0.64,1)]",
        hidden && "opacity-0",
      )}
      style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`, width: size, height: size }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          if (menu) setMenu(false);
          else if (line) finish("closed");
        }
      }}
    >
      {/* What he's saying */}
      {(line || menu) && !hidden && (
        <div
          role="status"
          aria-live="polite"
          onPointerEnter={() => (live.current.hover = true)}
          onPointerLeave={() => (live.current.hover = false)}
          className={cn(
            "pointer-events-auto absolute w-[min(17.5rem,calc(100vw-2rem))] animate-in rounded-2xl border-2 border-border bg-card p-3 text-left shadow-[0_4px_0_var(--border)] duration-300 fade-in-0 zoom-in-90",
            onRight ? "right-[calc(100%-0.75rem)]" : "left-[calc(100%-0.75rem)]",
            below ? "top-[calc(100%-0.5rem)] origin-top" : "bottom-[calc(100%-0.5rem)] origin-bottom",
          )}
        >
          {menu ? (
            <div className="space-y-2">
              <p className="pr-6 text-sm font-semibold text-muted-foreground">How chatty should I be?</p>
              <div className="grid grid-cols-2 gap-1.5">
                {LEVELS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => changeLevel(l.value)}
                    className={cn(
                      "rounded-xl border-2 px-2 py-1.5 text-xs font-extrabold transition-colors",
                      level === l.value
                        ? "border-transparent bg-primary text-primary-foreground shadow-[0_2px_0_color-mix(in_oklab,var(--primary-ink)_70%,black)]"
                        : "border-border bg-card text-foreground hover:bg-muted",
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={notToday}
                className="w-full rounded-xl px-2 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Quiet for the rest of today
              </button>
            </div>
          ) : (
            line && (
              <>
                <p className="pr-12 text-sm leading-snug font-bold text-foreground">{line.text}</p>
                {actions.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {actions.map((a, i) => (
                      <button
                        key={a.label}
                        type="button"
                        onClick={() => act(a)}
                        className={cn(
                          "rounded-lg px-3 py-1 text-xs font-bold transition-[filter,translate,box-shadow] active:translate-y-[2px] active:shadow-none",
                          i === 0
                            ? "bg-primary text-primary-foreground shadow-[0_2px_0_color-mix(in_oklab,var(--primary-ink)_70%,black)] hover:brightness-105"
                            : "border-2 border-border bg-card text-foreground hover:bg-muted",
                        )}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )
          )}
          <div className="absolute top-1.5 right-1.5 flex">
            {!menu && (
              <button
                type="button"
                onClick={() => setMenu(true)}
                aria-label="Nibo settings"
                title="How chatty Nibo is"
                className="flex size-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => (menu ? setMenu(false) : finish("closed"))}
              aria-label={menu ? "Close settings" : "Dismiss"}
              className="flex size-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" strokeWidth={2.6} />
            </button>
          </div>
        </div>
      )}

      {/* Nibo */}
      <button
        type="button"
        aria-label={openLabel}
        title="Nibo: tap to open, hold for settings"
        className={cn(
          "group pointer-events-auto relative block size-full rounded-full outline-none focus-visible:ring-4 focus-visible:ring-primary/40",
          hidden && "pointer-events-none",
        )}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          press.current.t = Date.now();
          press.current.timer = setTimeout(() => setMenu(true), 550);
        }}
        onPointerUp={() => press.current.timer && clearTimeout(press.current.timer)}
        onClick={() => {
          if (Date.now() - press.current.t < 2000 && press.current.t && menu) return;
          if (line) finish("acted");
          if (onOpen) onOpen();
          else if (!line) setMenu((m) => !m);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu(true);
        }}
      >
        <Nibo mood={mood} className="size-full drop-shadow-[0_8px_12px_rgba(4,60,44,0.28)]" />
        {/* Settings, for a mouse: appears on hover. */}
        <span
          role="button"
          tabIndex={-1}
          aria-hidden
          onClick={(e) => {
            e.stopPropagation();
            setMenu((m) => !m);
          }}
          className="absolute -top-1 -right-1 hidden size-6 items-center justify-center rounded-full border-2 border-border bg-card text-muted-foreground shadow-[0_2px_0_var(--border)] group-hover:flex hover:text-foreground"
        >
          <MoreHorizontal className="size-3.5" />
        </span>
      </button>
    </div>,
    document.body,
  );
}
