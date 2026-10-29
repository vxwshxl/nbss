"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, ChevronsUpDown, Globe, Menu, Search, X } from "lucide-react";

import { AssistantPanelContext } from "@/components/ai/assistant-panel";
import { Mark } from "@/components/brand";
import { Nibo } from "@/components/nibo/nibo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SITE_SECTIONS, siteFromPath, siteHref, type WorkspaceSite } from "@/lib/site-workspace";
import { NiboCompanion } from "@/components/nibo/nibo-companion";
import { cn } from "@/lib/utils";

import { CommandPalette } from "./command-palette";
import { findNavItem, type NavIndexItem } from "./nav-index";
import { useMediaQuery } from "./use-media-query";

/** Kept for layouts that still read it; the sidebar no longer collapses. */
export const RAIL_COOKIE = "erp-rail";

/**
 * The signed-in workspace, laid out as birdev's console: a sidebar on desktop and a
 * drawer on phones and tablets, a sticky frosted top bar with the page, search, "View
 * as" and the account menu, and the page on the pale ground.
 *
 * On desktop Nibo, the companion, floats in the corner; below lg he would sit over the
 * page, so he lives in the top bar instead, as a round button beside the account
 * avatar. Either opens the assistant, which floats over the page from the right on
 * wide screens and fills the screen below lg.
 * It is always mounted, only hidden, so the conversation survives closing it and
 * moving between pages.
 */
export function AppShell({
  brand,
  brandHref,
  assistant,
  mark,
  nav,
  navIndex,
  sidebarFooter,
  drawerFooter,
  topbarRight,
  topbarSecondary,
  banner,
  companion,
  sites,
  children,
}: {
  /** Console name: the drawer's accessible name. */
  brand: string;
  /** Where the logo points. */
  brandHref: string;
  /** Kept for callers; the assistant always opens as the panel now. */
  assistantHref?: string;
  /** The assistant, already rendered by the layout, for the panel. */
  assistant?: React.ReactNode;
  /** The logo block at the top of the sidebar. */
  mark: React.ReactNode;
  /** The console's navigation, shared by the sidebar and the drawer. */
  nav: React.ReactNode;
  navIndex: NavIndexItem[];
  sidebarFooter?: React.ReactNode;
  /** Below lg, at the foot of the menu drawer: what the header has no room for (Test / Live). */
  drawerFooter?: React.ReactNode;
  topbarLeft?: React.ReactNode;
  /** The account menu. */
  topbarRight?: React.ReactNode;
  /** "View as". */
  topbarSecondary?: React.ReactNode;
  /** Full-width strip above the top bar: the "viewing as" banner. */
  banner?: React.ReactNode;
  defaultCollapsed?: boolean;
  /** Nibo, the floating companion: whose preferences he keeps. */
  companion?: { person: string } | null;
  /** Staff: the sites the top bar's workspace switcher offers. */
  sites?: WorkspaceSite[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const desktop = useMediaQuery("(min-width: 64rem)");

  const openAssistant = useCallback(() => {
    setOpen(false);
    setAssistantOpen(true);
  }, []);
  const closeAssistant = useCallback(() => setAssistantOpen(false), []);
  const assistantPanel = useMemo(() => ({ open: assistantOpen, close: closeAssistant }), [assistantOpen, closeAssistant]);
  const toggle = useMemo<AssistantToggle | null>(
    () => (assistant ? { open: assistantOpen, toggle: assistantOpen ? closeAssistant : openAssistant } : null),
    [assistant, assistantOpen, openAssistant, closeAssistant],
  );

  // A button on one of Nibo's bubbles: open the panel, then put the question to it.
  const askAssistant = useCallback(
    (question: string) => {
      openAssistant();
      setTimeout(() => dispatchEvent(new CustomEvent("nibo:ask", { detail: question })), 140);
    },
    [openAssistant],
  );

  // Moving to another page closes the drawer.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }

  // Full screen below lg: the page underneath must not scroll behind the panel or drawer.
  useEffect(() => {
    if (!(open || (assistantOpen && !matchMedia("(min-width: 64rem)").matches))) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      removeEventListener("keydown", onKey);
    };
  }, [open, assistantOpen]);

  return (
    <AssistantToggleContext.Provider value={toggle}>
      <div className="crm-ground relative min-h-dvh lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
        <aside className="hidden border-r-2 border-border bg-elevated lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col print:hidden">
          <div className="px-5 pt-5 pb-6">
            <Link href={brandHref} aria-label={brand} className="inline-flex text-foreground">
              {mark}
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-4">{nav}</div>
          {sidebarFooter && <div className="border-t-2 border-border p-3">{sidebarFooter}</div>}
        </aside>

        <AnimatePresence>
          {open && (
            <>
              <motion.button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-[2px] lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={`${brand} menu`}
                className="fixed inset-y-0 left-0 z-[61] flex w-[86vw] max-w-[320px] flex-col bg-elevated shadow-e3 lg:hidden"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "tween", duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              >
                <div className="flex items-start justify-between px-5 pt-5 pb-6">
                  <Link href={brandHref} aria-label={brand} className="inline-flex text-foreground">
                    {mark}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="grid size-9 place-items-center rounded-full hover:bg-muted"
                    aria-label="Close menu"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-3 pb-4">{nav}</div>
                {(sidebarFooter || drawerFooter) && (
                  <div className="grid gap-2 border-t-2 border-border p-3">
                    {drawerFooter}
                    {sidebarFooter}
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-col">
          {banner}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b-2 border-border bg-elevated/80 px-3 backdrop-blur-xl backdrop-saturate-150 sm:px-6 print:hidden">
            <button
              type="button"
              className="grid size-10 place-items-center rounded-xl hover:bg-muted lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            <Crumb brand={brand} home={brandHref} index={navIndex} sites={sites} />
            <CommandPalette index={navIndex} />
            {topbarSecondary}
            {assistant && <AssistantButton className="lg:hidden" />}
            {topbarRight}
          </header>
          <main id="main" className="@container/main mx-auto w-full max-w-[1400px] flex-1 px-3 py-5 sm:px-6 sm:py-8">
            {children}
          </main>
        </div>

        {companion && desktop && (
          <NiboCompanion
            key={companion.person}
            person={companion.person}
            nudges
            tips
            hidden={assistantOpen || open}
            onOpen={assistant ? openAssistant : undefined}
            onAsk={assistant ? askAssistant : undefined}
            openLabel="Open Nibo, your assistant"
          />
        )}

        {assistant && (
          <aside
            id="console-assistant"
            aria-label="Nibo, your assistant"
            inert={!assistantOpen}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeAssistant();
            }}
            className={cn(
              "z-[75] flex min-w-0 flex-col overflow-hidden bg-elevated print:hidden",
              "max-lg:fixed max-lg:inset-0 max-lg:pt-[env(safe-area-inset-top)] max-lg:transition-[translate,visibility] max-lg:duration-[420ms] max-lg:ease-[cubic-bezier(0.32,0.72,0,1)]",
              "lg:fixed lg:top-3 lg:right-3 lg:bottom-3 lg:w-[min(26rem,calc(100vw-1.5rem))] lg:rounded-3xl lg:border-2 lg:border-border lg:shadow-[0_6px_0_var(--ds-border),0_24px_60px_-20px_rgb(0_0_0/0.3)] lg:transition-[translate,visibility,opacity] lg:duration-300 lg:ease-[cubic-bezier(0.32,0.72,0,1)]",
              "motion-reduce:transition-none",
              assistantOpen
                ? "translate-x-0 translate-y-0 opacity-100"
                : "pointer-events-none invisible max-lg:translate-y-full lg:translate-x-[calc(100%+1rem)] lg:opacity-0",
            )}
          >
            <AssistantPanelContext.Provider value={assistantPanel}>{assistant}</AssistantPanelContext.Provider>
          </aside>
        )}
      </div>
    </AssistantToggleContext.Provider>
  );
}

type AssistantToggle = { open: boolean; toggle: () => void };
const AssistantToggleContext = createContext<AssistantToggle | null>(null);

/**
 * Nibo as a round avatar beside the account's, opening the assistant panel. The top
 * bar shows it below lg, where the floating companion is not drawn.
 */
export function AssistantButton({ className }: { className?: string }) {
  const ctx = useContext(AssistantToggleContext);
  if (!ctx) return null;
  return (
    <button
      type="button"
      onClick={ctx.toggle}
      aria-label={ctx.open ? "Close Nibo" : "Ask Nibo, your assistant"}
      title="Ask Nibo"
      aria-controls="console-assistant"
      aria-expanded={ctx.open}
      className={cn(
        "grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-accent-subtle ring-2 ring-border outline-none hover:ring-border-strong focus-visible:ring-[3px] focus-visible:ring-primary/30",
        className,
      )}
    >
      <Nibo still uid="topbar" className="mt-2.5 size-10" />
    </button>
  );
}

const SWITCH_HUES = ["hue-jade", "hue-sky", "hue-gold", "hue-teal", "hue-plum", "hue-brick"];

/**
 * "NBSS / Site ▾ / Page" at the head of the top bar, as birdev shows company / project /
 * page. The site button opens a searchable list: the whole agency, or any one site;
 * switching keeps the section you were on. Without sites (guards, clients) it is
 * just "NBSS / Page".
 */
function Crumb({ brand, home, index, sites }: { brand: string; home: string; index: NavIndexItem[]; sites?: WorkspaceSite[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inSite = siteFromPath(pathname);
  const current = inSite ? sites?.find((x) => x.id === inSite.id) : undefined;
  const page = current
    ? (SITE_SECTIONS.find((x) => x.key === inSite!.section)?.label ?? "Overview")
    : findNavItem(index, pathname, home)?.label;
  const list = (sites ?? []).filter((x) => !q.trim() || `${x.name} ${x.district ?? ""} ${x.client ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-[15px]">
      <Link href={home} className="hidden items-center gap-2 rounded-lg px-1.5 py-1 font-semibold hover:bg-muted sm:flex">
        <Mark size={22} className="rounded-none" />
        {brand}
      </Link>
      {sites && sites.length > 0 && (
        <>
          <span aria-hidden className="hidden text-border-strong sm:inline">
            /
          </span>
          <Popover
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setQ("");
            }}
          >
            <PopoverTrigger
              className={cn(
                "min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/30",
                current ? "flex" : "hidden text-secondary-fg sm:flex",
              )}
            >
              {current && (
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-[11px] font-bold text-white">
                  {current.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="max-w-[10rem] truncate sm:max-w-[16rem]">{current ? current.name : "All sites"}</span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-secondary-fg" />
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={8} className="w-[min(22rem,calc(100vw-1.5rem))] p-2">
              <div className="relative mb-1.5">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-secondary-fg" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Find a site"
                  aria-label="Find a site"
                  className="h-10 w-full rounded-xl bg-subtle pr-3 pl-9 text-[14px] outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <Link
                href="/console"
                onClick={() => setOpen(false)}
                className={cn("flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[14px] hover:bg-muted", !current && "bg-accent-subtle")}
              >
                <Mark size={24} className="rounded-none" />
                <span className="flex-1 font-medium">{brand} · all sites together</span>
                {!current && <Check className="size-4 text-primary" />}
              </Link>
              <p className="mt-2 mb-1 px-2.5 text-[12px] font-semibold text-secondary-fg">Sites</p>
              <ul className="max-h-[50vh] overflow-y-auto">
                {list.length === 0 && <li className="px-2.5 py-3 text-[13px] text-secondary-fg">No site matches.</li>}
                {list.map((x, i) => (
                  <li key={x.id}>
                    <Link
                      href={siteHref(x.id, inSite?.section ?? "")}
                      onClick={() => setOpen(false)}
                      className={cn("flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[14px] hover:bg-muted", current?.id === x.id && "bg-accent-subtle")}
                    >
                      <span className={cn("grid size-6 shrink-0 place-items-center rounded-md bg-[var(--h)] text-[11px] font-bold text-white", SWITCH_HUES[i % SWITCH_HUES.length])}>
                        {x.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{x.name}</span>
                        <span className="block truncate text-[11.5px] text-secondary-fg">
                          {[x.client, x.district, x.active ? null : "Paused"].filter(Boolean).join(" · ") || "Site"}
                        </span>
                      </span>
                      {current?.id === x.id && <Check className="size-4 text-primary" />}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/console/sites"
                onClick={() => setOpen(false)}
                className="mt-1 flex items-center justify-center rounded-xl border-t border-border px-2.5 pt-2.5 pb-1.5 text-[13px] font-medium text-primary hover:underline"
              >
                Manage sites
              </Link>
            </PopoverContent>
          </Popover>
        </>
      )}
      {page && (!current || page !== "Overview") && (
        <>
          <span aria-hidden className={cn("text-border-strong", !current && "hidden sm:inline")}>
            /
          </span>
          <span className="display-section shrink-0 truncate text-[17px] whitespace-nowrap">{page}</span>
        </>
      )}
    </nav>
  );
}

/** Foot of the sidebar: back to the public website, as birdev's console has it. */
export function WebsiteTag({ label }: { label: string }) {
  return (
    <Link
      href="/"
      className="group flex items-center gap-3 rounded-xl bg-[color-mix(in_oklab,var(--ds-accent)_72%,black)] px-3.5 py-3 text-white transition-[filter,translate] hover:brightness-110 active:translate-y-px"
    >
      <span className="grid size-9 place-items-center rounded-lg bg-white/10 text-gold-soft">
        <Globe className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-sm font-semibold">Website</span>
        <span className="block truncate text-[11px] font-medium text-gold-soft">{label}</span>
      </span>
      <ArrowUpRight className="size-4 text-white/60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
}
