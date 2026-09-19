"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, PanelLeftClose, PanelLeftOpen, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "./breadcrumbs";
import { CommandPalette } from "./command-palette";
import { Clock } from "./clock";
import { useMediaQuery } from "./use-media-query";
import type { NavIndexItem } from "./nav-index";

/** Remembers the icon-rail preference across sessions. Read server-side in each
 *  console layout, so the first paint is already the right width. */
export const RAIL_COOKIE = "erp-rail";

const DESKTOP = "(min-width: 64rem)";

export function AppShell({
  brand,
  brandHref,
  assistantHref,
  mark,
  nav,
  navIndex,
  sidebarFooter,
  topbarRight,
  topbarSecondary,
  banner,
  defaultCollapsed = false,
  children,
}: {
  /** Console name — the first breadcrumb and the drawer's accessible name. */
  brand: string;
  /** Where the mark and the first breadcrumb point. */
  brandHref: string;
  /**
   * The assistant, if this console has one. It sits with the mark rather than
   * in the nav on purpose: it is not another section of the console, it is a
   * way to work the whole of it.
   */
  assistantHref?: string;
  /** The logo block at the top of the sidebar. */
  mark: React.ReactNode;
  /** The console's navigation. Rendered once and shared by the column and the
   *  drawer, so there is no second copy to keep in step. */
  nav: React.ReactNode;
  navIndex: NavIndexItem[];
  sidebarFooter?: React.ReactNode;
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
  // `true` on the server: the console is a desktop tool first, and guessing
  // "phone" would render every first paint as a drawer and then reflow.
  const isDesktop = useMediaQuery(DESKTOP, true);
  const drawerOpen = open && !isDesktop;

  function toggleCollapsed() {
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
      data-rail={collapsed ? "collapsed" : "expanded"}
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
          className="flex items-center gap-2 border-b border-app-line-soft px-1 pb-4"
        >
          <Link
            href={brandHref}
            aria-label={brand}
            className="flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/60"
          >
            {mark}
          </Link>
          {assistantHref && (
            <Link
              href={assistantHref}
              title="Assistant"
              aria-label="Assistant"
              className="press ml-auto flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 outline-none transition-colors hover:bg-violet-500/25 focus-visible:ring-2 focus-visible:ring-sidebar-ring/60 dark:text-violet-300"
            >
              <Sparkles className="size-4.5" strokeWidth={1.9} />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="press flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/60 lg:hidden"
          >
            <X className="size-4.5" strokeWidth={2} />
          </button>
        </div>

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">{nav}</div>

        {topbarSecondary && (
          <div className="flex flex-wrap items-center gap-2 border-t border-app-line-soft pt-3 sm:hidden">
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
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="press hidden size-9 shrink-0 items-center justify-center rounded-lg border border-app-line bg-card text-muted-foreground shadow-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 lg:flex"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4.5" strokeWidth={1.9} />
            ) : (
              <PanelLeftClose className="size-4.5" strokeWidth={1.9} />
            )}
          </button>

          {/* The trail is desktop-only. On a phone the reader arrived here by
              tapping one item in a drawer they just closed — "My School ›
              Academics › Classes" tells them nothing the H1 underneath does
              not, and it was the widest thing competing for a 390px topbar. */}
          <Breadcrumbs
            brand={brand}
            rootHref={brandHref}
            index={navIndex}
            className="hidden min-w-0 shrink lg:flex"
          />

          {/* `mr-auto` rather than `flex-1`: the clock takes the slack the
              breadcrumbs leave behind below lg without becoming the thing that
              gives way when the topbar runs out of room. It sheds its seconds
              on a narrow screen instead of being squeezed to zero width. */}
          <Clock className="mr-auto shrink-0 lg:mr-0" />

          {/* Between the trail and the account controls: the palette is a
              navigation control, so it belongs with the other ones rather than
              floating in the page body. */}
          <CommandPalette index={navIndex} />

          {topbarSecondary && (
            <div className="hidden shrink-0 items-center gap-2 sm:flex sm:gap-3">
              {topbarSecondary}
            </div>
          )}

          {/* Not `shrink-0`. This group holds the account avatar, which must
              never be pushed off the edge, and — while a platform admin is
              viewing a school — a pill naming that school, which is allowed to
              truncate. Pinning the whole group meant the pill's full width won
              and the avatar went over the edge instead. */}
          {topbarRight && (
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">{topbarRight}</div>
          )}
        </header>

        {/* The bottom pad keeps the 40px grid step and adds the device's own
            inset on top, so the last row clears the home indicator inside the
            mobile app (the shell draws the WebView to the bottom edge). The
            inset is 0 everywhere else, leaving the desktop spacing unchanged. */}
        <main className="min-w-0 flex-1 px-4 pt-4 pb-[calc(--spacing(10)+env(safe-area-inset-bottom))] lg:px-2 lg:pt-3">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
