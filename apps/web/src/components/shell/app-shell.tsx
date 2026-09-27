"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Menu, PanelLeftClose, PanelLeftOpen, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssistantPanelContext } from "@/components/ai/assistant-panel";
import { CommandPalette } from "./command-palette";
import { Clock } from "./clock";
import { useMediaQuery } from "./use-media-query";
import type { NavIndexItem } from "./nav-index";

/** Remembers the icon-rail preference across sessions. Read server-side in each
 *  console layout, so the first paint is already the right width. */
export const RAIL_COOKIE = "erp-rail";

const DESKTOP = "(min-width: 64rem)";
/** The assistant docks as a column from here up (matches globals.css). */
const DOCK = "(min-width: 90rem)";
/** Below this the assistant is full screen. */
const PHONE = "(max-width: 39.99rem)";
/** Small laptops: the sidebar starts as icons so pages keep their width. */
const COMPACT = "(min-width: 64rem) and (max-width: 79.99rem)";

export function AppShell({
  brand,
  brandHref,
  assistantHref,
  assistant,
  mark,
  nav,
  navIndex,
  sidebarFooter,
  topbarLeft,
  topbarRight,
  topbarSecondary,
  banner,
  defaultCollapsed = false,
  children,
}: {
  /** Console name — the drawer's accessible name. */
  brand: string;
  /** Where the mark points. */
  brandHref: string;
  /**
   * The assistant, if this console has one. Its button is `<AssistantButton />`,
   * which the layout places in `topbarRight` — it is not another section of the
   * console, it is a way to work the whole of it, so it lives in the topbar
   * rather than in the nav.
   */
  assistantHref?: string;
  /**
   * The assistant itself, already rendered by the layout, for the side panel.
   * A node rather than an import because it needs server-side state (persona,
   * whether a key is configured) and this file is a Client Component. Without
   * it the sparkle falls back to `assistantHref`.
   */
  assistant?: React.ReactNode;
  /** The logo block at the top of the sidebar. */
  mark: React.ReactNode;
  /** The console's navigation. Rendered once and shared by the column and the
   *  drawer, so there is no second copy to keep in step. */
  nav: React.ReactNode;
  navIndex: NavIndexItem[];
  sidebarFooter?: React.ReactNode;
  /** Beside the clock and search — the language picker. Moves into the drawer
   *  on a phone, like `topbarSecondary`. */
  topbarLeft?: React.ReactNode;
  topbarRight?: React.ReactNode;
  /**
   * Controls that matter but are not the first thing you reach for — the
   * session switcher, the theme control. On a phone the topbar cannot hold
   * them: the tenant console's right-hand group measured 425px against a 390px
   * screen, which pushed every single page 110px sideways. So they move into
   * the drawer down there instead of being dropped, and nothing becomes
   * unreachable on a phone.
   */
  topbarSecondary?: React.ReactNode;
  /** Full-width strip above the topbar — the subscription banner. */
  banner?: React.ReactNode;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  // On a small laptop the rail is icons unless opened for a look ("peek");
  // that is not a preference, so it writes no cookie.
  const isCompact = useMediaQuery(COMPACT, false);
  const [peek, setPeek] = useState(false);
  const railCollapsed = isCompact ? !peek : collapsed;
  // `true` on the server: the console is a desktop tool first, and guessing
  // "phone" would render every first paint as a drawer and then reflow.
  const isDesktop = useMediaQuery(DESKTOP, true);
  // Wide enough to dock the assistant as a third column without squeezing
  // the page below ~900px. Narrower, it floats over the page as a panel.
  const isDocked = useMediaQuery(DOCK, true);
  const isPhone = useMediaQuery(PHONE, false);
  const drawerOpen = open && !isDesktop;

  const [assistantOpen, setAssistantOpen] = useState(false);
  // What the rail was before the assistant borrowed its width, so closing the
  // panel puts the sidebar back rather than leaving it narrowed for good.
  const railBeforeAssistant = useRef<boolean | null>(null);

  const openAssistant = useCallback(() => {
    // Making room for the panel writes no cookie on purpose: it is not a
    // statement about how this person likes their sidebar, and it must not
    // outlive the panel.
    if (isDocked && !collapsed) {
      railBeforeAssistant.current = collapsed;
      setCollapsed(true);
    }
    // If the phone drawer is open, its job is done.
    setOpen(false);
    setAssistantOpen(true);
  }, [isDocked, collapsed]);

  const closeAssistant = useCallback(() => {
    setAssistantOpen(false);
    if (railBeforeAssistant.current !== null) {
      setCollapsed(railBeforeAssistant.current);
      railBeforeAssistant.current = null;
    }
  }, []);

  // Memoised so the assistant is not re-rendered by everything else that moves
  // in the shell — the identity is what context consumers compare on.
  const assistantPanel = useMemo(
    () => ({ open: assistantOpen, close: closeAssistant }),
    [assistantOpen, closeAssistant],
  );

  // What <AssistantButton /> needs, wherever the layout put it in the topbar.
  const assistantToggle = useMemo<AssistantToggle | null>(
    () =>
      assistant
        ? { open: assistantOpen, toggle: assistantOpen ? closeAssistant : openAssistant }
        : assistantHref
          ? { href: assistantHref }
          : null,
    [assistant, assistantHref, assistantOpen, openAssistant, closeAssistant],
  );

  // Full screen on a phone: the page underneath must not scroll behind it.
  const assistantCovers = assistantOpen && isPhone && !!assistant;
  useEffect(() => {
    if (!assistantCovers) return;
    const { body } = document;
    const prev = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prev;
    };
  }, [assistantCovers]);

  function toggleCollapsed() {
    if (isCompact) {
      setPeek((p) => !p);
      return;
    }
    const next = !collapsed;
    setCollapsed(next);
    // A year, because the preference is about how this person likes to work,
    // not about this session. Lax rather than Strict so following a link from
    // an emailed invoice does not arrive with the rail reset.
    document.cookie = `${RAIL_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  // Two things only the open drawer needs: the page behind it must not scroll
  // under the reader's thumb, and Escape must shut it.
  useEffect(() => {
    if (!drawerOpen) return;
    const { body } = document;
    const prev = body.style.overflow;
    body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  return (
    <div
      className="app-shell relative grid min-h-dvh flex-1 gap-0 lg:p-3"
      data-rail={railCollapsed ? "collapsed" : "expanded"}
      data-assistant={assistant && assistantOpen ? "open" : "closed"}
    >
      {/* The ambient ground. Fixed rather than absolute so it covers the
          viewport and not the document — the blooms should not stretch to the
          length of a 900-row fee table — and inert so it never takes a click.
          -z-10 puts it behind the shell's own background-less surface. */}
      <div aria-hidden className="bg-app-ground fixed inset-0 -z-10 print:hidden" />

      <aside
        id="console-nav"
        aria-label={`${brand} navigation`}
        // Off-screen is not the same as gone: without this the whole nav stays
        // in the tab order behind the closed drawer, and the first Tab on a
        // phone lands somewhere invisible.
        inert={!isDesktop && !open}
        className={cn(
          "z-50 flex flex-col gap-4 border border-app-line-soft bg-sidebar p-4 text-sidebar-foreground shadow-card print:hidden",
          // Desktop: a panel that floats on the ground, held in view while the
          // content scrolls past it.
          "lg:sticky lg:top-3 lg:h-[calc(100dvh-1.5rem)] lg:rounded-2xl lg:translate-x-0",
          // Below that: a drawer laid over the page. Always full labels here —
          // a rail preference set on a laptop must not shrink a phone's drawer.
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:w-[17rem] max-lg:rounded-r-2xl max-lg:transition-transform max-lg:duration-200 max-lg:ease-drawer motion-reduce:max-lg:transition-none",
          open ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
        )}
        // One handler for every link in the nav, whatever the console passed
        // in: a click that lands on a link has navigated, so the drawer's work
        // is done. Cheaper and less brittle than threading an onNavigate
        // callback through three different nav components.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a[href]")) setOpen(false);
        }}
      >
        <div
          data-rail-compact
          data-rail-stack
          className="flex items-center gap-2 border-b border-app-line-soft px-1 pb-4"
        >
          <Link
            href={brandHref}
            aria-label={brand}
            className="flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/60"
          >
            {mark}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="press ml-auto flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/60 lg:hidden"
          >
            <X className="size-4.5" strokeWidth={2} />
          </button>
        </div>

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">{nav}</div>

        {(topbarLeft || topbarSecondary) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-app-line-soft pt-3 sm:hidden">
            {topbarLeft}
            {topbarSecondary}
          </div>
        )}

        {sidebarFooter && (
          <div className="border-t border-app-line-soft pt-3">{sidebarFooter}</div>
        )}
      </aside>

      {/* Backdrop. A real button so Escape is not the only way out for someone
          who opened the drawer by accident. */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-(--scrim) backdrop-blur-[2px] lg:hidden"
        />
      )}

      <div className="flex min-w-0 flex-col">
        {banner}

        <header className="z-30 flex min-h-14 items-center gap-3 px-4 py-2 max-lg:sticky max-lg:top-0 max-lg:border-b max-lg:border-app-line-soft max-lg:bg-background/85 max-lg:backdrop-blur lg:px-2 print:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-controls="console-nav"
            aria-expanded={open}
            className="press flex size-9 shrink-0 items-center justify-center rounded-lg border border-app-line bg-card text-foreground shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/60 lg:hidden"
          >
            <Menu className="size-4.5" strokeWidth={1.9} />
          </button>

          {/* The desktop counterpart to the hamburger. It lives in the topbar
              rather than on the sidebar so it stays in one place whether the
              sidebar is a full column or a narrow rail — a control that moves
              when you use it is a control you have to hunt for twice. */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!railCollapsed}
            className="press hidden size-9 shrink-0 items-center justify-center rounded-lg border border-app-line bg-card text-muted-foreground shadow-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 lg:flex"
          >
            {railCollapsed ? (
              <PanelLeftOpen className="size-4.5" strokeWidth={1.9} />
            ) : (
              <PanelLeftClose className="size-4.5" strokeWidth={1.9} />
            )}
          </button>

          {/* Left: when, find, and in which language. No breadcrumb trail — the
              page's own title says where you are, and the room is better spent
              on the controls people actually reach for. */}
          <Clock className="shrink-0" />
          <CommandPalette index={navIndex} />
          {topbarLeft && (
            <div className="hidden shrink-0 items-center gap-2 sm:flex">{topbarLeft}</div>
          )}

          {/* Right: the session being viewed, then who you are acting as, then
              the assistant, notifications and the account. Not `shrink-0`: it
              holds the account avatar, which must never be pushed off the
              edge, and — while a platform admin is viewing a school — a pill
              naming that school, which is allowed to truncate. */}
          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            {topbarSecondary && (
              <div className="hidden shrink-0 items-center gap-2 sm:flex sm:gap-3">
                {topbarSecondary}
              </div>
            )}
            <AssistantToggleContext.Provider value={assistantToggle}>
              {topbarRight}
            </AssistantToggleContext.Provider>
          </div>
        </header>

        {/* The bottom pad keeps the 40px grid step and adds the device's own
            inset on top, so the last row clears the home indicator inside the
            mobile app (the shell draws the WebView to the bottom edge). The
            inset is 0 everywhere else, leaving the desktop spacing unchanged. */}
        <main className="@container/main min-w-0 flex-1 px-4 pt-4 pb-[calc(--spacing(10)+env(safe-area-inset-bottom))] lg:px-2 lg:pt-3">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      {/*
        The assistant panel.

        A column of its own from lg, where there is room to read a register and
        ask about it at once — it covers nothing, so there is nothing to dim.
        Full screen below that: a 26rem column on a phone is the whole screen
        anyway, and a sliver of page behind it is a backdrop nobody can tap.

        Always mounted, only hidden, so the conversation survives closing the
        panel and moving between pages — the layout persists across
        navigation, and the transcript lives inside it.
      */}
      {assistant && (
        <aside
          id="console-assistant"
          aria-label="Assistant"
          inert={!assistantOpen}
          onKeyDown={(e) => {
            // Scoped to the panel so Escape inside a page's own dialog is not
            // taken from it.
            if (e.key === "Escape") closeAssistant();
          }}
          className={cn(
            "z-50 flex min-w-0 flex-col overflow-hidden bg-card print:hidden",
            // Phone: full screen. Tablet and laptop: a panel floating over
            // the page from the right, so the page keeps its full width.
            "max-[90rem]:fixed max-[90rem]:transition-[transform,visibility,opacity] max-[90rem]:duration-200 max-[90rem]:ease-drawer motion-reduce:max-[90rem]:transition-none",
            "max-sm:inset-0 max-sm:pt-[env(safe-area-inset-top)]",
            "sm:max-[90rem]:top-3 sm:max-[90rem]:right-3 sm:max-[90rem]:bottom-3 sm:max-[90rem]:w-[min(26rem,calc(100vw-1.5rem))] sm:max-[90rem]:rounded-2xl sm:max-[90rem]:border sm:max-[90rem]:border-app-line-soft sm:max-[90rem]:shadow-[0_24px_60px_-20px_rgb(0_0_0/0.35)]",
            // Wide: docked as the grid's third column.
            "min-[90rem]:sticky min-[90rem]:top-3 min-[90rem]:h-[calc(100dvh-1.5rem)] min-[90rem]:rounded-2xl min-[90rem]:border min-[90rem]:border-app-line-soft min-[90rem]:shadow-card",
            assistantOpen
              ? "max-[90rem]:translate-x-0"
              : "max-[90rem]:invisible max-[90rem]:translate-x-[calc(100%+1rem)] min-[90rem]:hidden",
          )}
        >
          {/* No header of its own: the assistant draws one, and the close
              button is handed to it through context so it sits beside
              "New chat" rather than in a second bar above it. */}
          <AssistantPanelContext.Provider value={assistantPanel}>
            {assistant}
          </AssistantPanelContext.Provider>
        </aside>
      )}
    </div>
  );
}

type AssistantToggle =
  | { open: boolean; toggle: () => void; href?: undefined }
  | { href: string; open?: undefined; toggle?: undefined };

const AssistantToggleContext = createContext<AssistantToggle | null>(null);

const ASSISTANT_BUTTON =
  "press flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-xs outline-none transition-[filter,box-shadow] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-violet-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * The assistant's topbar button. The layout places it in `topbarRight` so it
 * sits where that console wants it (between "view as" and notifications); the
 * shell supplies what it does — open the side panel, or, for a console with no
 * panel, go to the assistant page. Renders nothing when there is no assistant.
 */
export function AssistantButton() {
  const ctx = useContext(AssistantToggleContext);
  if (!ctx) return null;
  const icon = <Sparkles className="size-4.5" strokeWidth={1.6} fill="currentColor" />;

  if (ctx.href) {
    return (
      <Link href={ctx.href} title="Assistant" aria-label="Assistant" className={ASSISTANT_BUTTON}>
        {icon}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={ctx.toggle}
      title="Assistant"
      aria-label={ctx.open ? "Close the assistant" : "Open the assistant"}
      aria-controls="console-assistant"
      aria-expanded={ctx.open}
      className={cn(ASSISTANT_BUTTON, ctx.open && "ring-2 ring-violet-400/50 ring-offset-2 ring-offset-background")}
    >
      {icon}
    </button>
  );
}
