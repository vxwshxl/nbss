"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, animate } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SliderNavItem {
    href: string;
    label: React.ReactNode;
    /** Extra classes for this item's <Link> (e.g. responsive visibility). */
    className?: string;
}

// Bouncy settle for the slide; a wobblier spring for the droplet squish.
const SNAP = { type: "spring" as const, stiffness: 520, damping: 22, mass: 1 };
const DROPLET = { type: "spring" as const, stiffness: 340, damping: 14, mass: 0.9 };

/**
 * Where each nav's highlighter last was, keyed by its list of hrefs.
 *
 * A nav that each page renders for itself (the marketing header) remounts on
 * every navigation. Starting the new instance at x=0 made the pill always
 * slide in from the left edge, so going FAQ → Home ran left-to-right instead
 * of back. Starting from the previous position lets it travel from where it
 * was to where it is going, in whichever direction that is. Module scope
 * survives client-side navigation; a full reload starts fresh, as it should.
 */
const lastPill = new Map<string, { x: number; w: number; v: number }>();

/**
 * A draggable "liquid droplet" pill nav with a golden highlighter that slides
 * BEHIND static labels. Drag the pill between tabs (or click a tab) to navigate.
 * Shared by the in-app bottom nav and the marketing header.
 */
export function SliderNav({
    items,
    activeIndex,
    fluid = false,
    tone = "dark",
    className,
    measureKey,
}: {
    items: SliderNavItem[];
    /** Index of the active route; clamped to 0 when negative (no match). */
    activeIndex: number;
    /** When true, tabs stretch to fill the bar (mobile); otherwise content-width. */
    fluid?: boolean;
    /** Label colours: "dark" for a dark bar, "light" for a white/light bar. */
    tone?: "dark" | "light";
    /** Extra classes for the <nav> container (border / background / shadow). */
    className?: string;
    /** Any value that, when changed, should re-measure tab geometry (e.g. sidebar open, language). */
    measureKey?: unknown;
}) {
    const router = useRouter();
    const safeActive = Math.max(0, activeIndex);

    const navRef = useRef<HTMLElement>(null);
    const pillRef = useRef<HTMLDivElement>(null);
    const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
    // Measured geometry of each tab, relative to the nav's content box.
    const [rects, setRects] = useState<{ left: number; top: number; width: number; height: number }[]>([]);
    const [dragging, setDragging] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(safeActive);
    // Where the highlighter should rest. Set on drop so it snaps to the landing
    // tab immediately (no bounce-back while the route navigates).
    const [selectedIndex, setSelectedIndex] = useState(safeActive);

    // Keep in sync with external navigation (links, back button, etc.). The
    // pill is driven locally so a tap moves it before the route resolves; this
    // is what puts it back where the URL says when the move came from
    // somewhere else.
    useEffect(() => { setSelectedIndex(safeActive); }, [safeActive]);

    const storeKey = items.map((item) => item.href).join("|");
    const x = useMotionValue(lastPill.get(storeKey)?.x ?? 0);
    const w = useMotionValue(lastPill.get(storeKey)?.w ?? 0);
    const sx = useMotionValue(1); // horizontal squish for the liquid-droplet feel

    // The initial values above are read when this instance starts rendering,
    // but it commits a few frames later, and the outgoing instance keeps
    // animating in between. Re-read at commit, before first paint, so the
    // hand-off lands on the outgoing pill's final position instead of a
    // position from a few frames earlier (a visible 40px jump backwards).
    //
    // `jump`, not `set`: a motion value derives its velocity from successive
    // sets, and render-time value → commit-time value a few ms apart reads as a
    // huge speed, which the snap spring then honours by flinging the pill ~45px
    // past its target. `jump` places it with no velocity; the outgoing pill's
    // real velocity is carried into the next snap instead, so the hand-off
    // continues one motion rather than restarting from rest.
    const handoffVelocity = useRef<number | null>(null);
    useLayoutEffect(() => {
        const last = lastPill.get(storeKey);
        if (last) {
            x.jump(last.x);
            w.jump(last.w);
            handoffVelocity.current = last.v;
        }
        // Mount only: afterwards this instance is the one writing lastPill.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Record every frame of the pill's position, mid-flight included, so a
    // remount picks up exactly where this instance left off.
    useEffect(() => {
        const save = () =>
            lastPill.set(storeKey, { x: x.get(), w: w.get(), v: x.getVelocity() });
        const offX = x.on("change", save);
        const offW = w.on("change", save);
        return () => { offX(); offW(); };
    }, [storeKey, x, w]);

    const measure = () => {
        const nav = navRef.current;
        if (!nav || tabRefs.current.some((el) => !el)) return;
        const nb = nav.getBoundingClientRect();
        setRects(
            tabRefs.current.map((el) => {
                const r = el!.getBoundingClientRect();
                return { left: r.left - nb.left, top: r.top - nb.top, width: r.width, height: r.height };
            })
        );
    };

    // Re-measure when geometry can change (active styling, item count, sidebar, language).
    useLayoutEffect(() => { measure(); }, [activeIndex, items.length, measureKey]);
    useEffect(() => {
        const onResize = () => measure();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const displayIndex = dragging ? previewIndex : selectedIndex;

    // Snap the golden pill onto the selected tab (and resize to it) whenever it
    // changes — but never while the user is actively dragging it. A zero-width
    // rect means the tab is hidden at this breakpoint (e.g. responsive hide) — skip it.
    useEffect(() => {
        const r = rects[selectedIndex];
        if (!r || r.width === 0 || dragging) return;
        // Stretch in the direction it's travelling, then let the bouncy spring
        // pull it back to 1 — reads like a liquid droplet snapping into place.
        const travel = r.left - x.get();
        // A pill handed over mid-flight keeps its speed (see the mount effect).
        const carried = handoffVelocity.current;
        handoffVelocity.current = null;
        const a1 = animate(x, r.left, carried === null ? SNAP : { ...SNAP, velocity: carried });
        const a2 = animate(w, r.width, SNAP);
        let a3: ReturnType<typeof animate> | undefined;
        if (Math.abs(travel) > 1) {
            if (pillRef.current) pillRef.current.style.transformOrigin = travel > 0 ? "left center" : "right center";
            sx.set(1 + Math.min(0.22, Math.abs(travel) / 600));
            a3 = animate(sx, 1, DROPLET);
        }
        return () => { a1.stop(); a2.stop(); a3?.stop(); };
    }, [rects, selectedIndex, dragging, x, w, sx]);

    const nearestIndex = () => {
        const center = x.get() + w.get() / 2;
        let nearest = safeActive;
        let best = Infinity;
        rects.forEach((r, i) => {
            if (r.width === 0) return; // hidden tab at this breakpoint — not a drop target
            const d = Math.abs(center - (r.left + r.width / 2));
            if (d < best) { best = d; nearest = i; }
        });
        return nearest;
    };

    const onDrag = () => {
        const n = nearestIndex();
        setPreviewIndex((prev) => (prev === n ? prev : n));
        // Morph width toward the tab the pill is hovering over.
        const r = rects[n];
        if (r) animate(w, r.width, { duration: 0.18 });
    };

    const onDragEnd = () => {
        // Snap to whichever tab the pill is now more than halfway onto (nearest
        // center). The snap effect animates there via selectedIndex.
        const target = nearestIndex();
        setSelectedIndex(target);
        setDragging(false);
        // Only navigate if it actually landed on another tab; otherwise it just
        // settles back on the current page (no refresh).
        const dest = items[target];
        if (target !== safeActive && dest) router.push(dest.href);
    };

    const box = rects[displayIndex];
    // Drag bounds span the first→last *visible* tab (ignore responsive-hidden ones).
    const visible = rects.filter((r) => r.width > 0);
    const firstVisible = visible[0];
    const lastVisible = visible[visible.length - 1];
    const dragBounds =
        firstVisible && lastVisible
            ? { left: firstVisible.left, right: lastVisible.left }
            : { left: 0, right: 0 };

    // "surface" follows the theme via the --nav-pill-* tokens, so a pill sitting
    // on bg-card stays legible in both modes. "dark" keeps a fixed soft glow for
    // a bar that is dark regardless of theme.
    const pillStyle =
        tone === "light"
            ? {
                  background: "var(--nav-pill-bg)",
                  border: "1px solid var(--nav-pill-border)",
                  boxShadow: "var(--nav-pill-shadow)",
              }
            : {
                  background:
                      "linear-gradient(135deg, rgba(180,130,20,0.18) 0%, rgba(244,215,140,0.28) 35%, rgba(255,240,180,0.18) 55%, rgba(180,130,20,0.14) 100%)",
                  border: "1px solid rgba(244,215,140,0.30)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 12px rgba(244,215,140,0.12)",
              };
    const shimmerVia = tone === "light" ? "var(--nav-pill-shimmer)" : "rgba(255,240,180,0.5)";

    return (
        <nav
            ref={navRef}
            className={cn(
                "relative flex items-center gap-1 p-1 rounded-full overflow-hidden no-scrollbar",
                fluid ? "w-full md:w-auto justify-between md:justify-center" : "justify-center",
                className
            )}
        >
            {/* Golden highlighter — slides BEHIND the static labels. Drag it between tabs. */}
            {box && box.width > 0 && (
                <motion.div
                    ref={pillRef}
                    drag="x"
                    dragConstraints={dragBounds}
                    dragElastic={0.06}
                    dragMomentum={false}
                    onDragStart={() => { setDragging(true); setPreviewIndex(safeActive); }}
                    onDrag={onDrag}
                    onDragEnd={onDragEnd}
                    style={{
                        x, width: w, scaleX: sx, top: box.top, height: box.height, left: 0,
                        ...pillStyle,
                    }}
                    className="absolute z-0 rounded-full overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none"
                >
                    <span
                        aria-hidden="true"
                        className="absolute inset-y-0 w-1/3"
                        style={{
                            animation: "app-nav-shimmer 2.2s ease-in-out infinite",
                            left: "-33%",
                            transform: "skewX(-45deg)",
                            backgroundImage: `linear-gradient(to right, transparent, ${shimmerVia}, transparent)`,
                        }}
                    />
                </motion.div>
            )}

            {/* Static labels on top. The active one is click-through (pointer-events-none)
                so the highlighter underneath stays grabbable; inactive ones stay tappable. */}
            {items.map((item, i) => (
                <Link
                    key={item.href}
                    ref={(el) => { tabRefs.current[i] = el; }}
                    href={item.href}
                    draggable={false}
                    // Start the slide on tap rather than when the next page
                    // arrives. The new page's nav continues from wherever this
                    // one got to (see lastPill), so it reads as one motion.
                    // Tapping the current page's tab counts too: tapping Home
                    // while Fee Structure is still loading cancels that
                    // navigation and keeps you on Home, so the pill has to come
                    // back as well, not stay on the tab you never reached.
                    onClick={() => setSelectedIndex(i)}
                    className={cn(
                        // px-2 below sm, not px-3: in fluid mode each tab gets an exact quarter of
                        // the bar, and at 430px "Advantages" needed 67px of a 64px slot — so the
                        // longest label in the marketing nav truncated to "Advantag…". Four pixels
                        // of padding is the cheapest thing to give back.
                        "relative z-10 text-center py-2 md:py-1.5 px-2 sm:px-3 md:px-4 text-xs sm:text-sm font-medium rounded-full transition-colors duration-200",
                        fluid ? "flex-1 min-w-0 md:flex-none" : "",
                        i === displayIndex
                            ? cn("pointer-events-none", tone === "light" ? "text-(color:--nav-pill-label)" : "text-[#f4d78c]")
                            : tone === "light"
                              ? "text-muted-foreground hover:text-foreground"
                              : "text-zinc-400 hover:text-white",
                        item.className
                    )}
                >
                    <span className="block truncate">{item.label}</span>
                </Link>
            ))}

            <style>{`
                @keyframes app-nav-shimmer {
                    0%   { left: -33%; opacity: 0; }
                    10%  { opacity: 1; }
                    90%  { opacity: 1; }
                    100% { left: 120%; opacity: 0; }
                }
            `}</style>
        </nav>
    );
}
