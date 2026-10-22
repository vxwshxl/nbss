"use client";

import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BrandLockup } from "@/components/brand";
import { useFooterYield } from "@/components/site/use-footer-yield";
import { site } from "@/content/site";
import { nav, type NavEntry } from "@/content/site-nav";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

/**
 * Transparent at the very top of a page, a frosted bar as soon as it moves, and pushed off
 * with the page once the footer reaches it (the footer carries the logo and links itself).
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const signedIn = useSignedIn();
  const cta = signedIn ? { href: "/login", label: "Dashboard" } : { href: "/login", label: "Login" };
  // Until we know (first paint), the button is held invisible so it never shows "Login" and
  // then flips to "Dashboard"; it fades in once with the right label.
  const known = signedIn !== null;
  const ref = useRef<HTMLElement>(null);
  useFooterYield(ref, !mobile);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  useEffect(() => {
    if (!mobile) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobile(false);
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [mobile]);


  return (
    <header
      ref={ref}
      className="fixed inset-x-0 top-0 z-50 text-ink"
    >
      {/* The bar's surfaces fade instead of switching: frosted once the page moves, solid (to
          match the menu panel) while the menu is open. Same timing as the panel, so opening and
          closing read as one motion. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[84px] bg-subtle/85 shadow-e0 backdrop-blur-xl"
        initial={false}
        animate={{ opacity: scrolled && !mobile ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[84px] bg-subtle"
        initial={false}
        animate={{ opacity: mobile ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      />
      <div className="relative mx-auto flex h-[84px] max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-8">
        <Link href="/" aria-label={`${site.shortName} home`} className="text-ink">
          <BrandLockup size="xs" priority />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex" onMouseLeave={() => setOpen(null)}>
          {nav.map((entry) => (
            <NavItem key={entry.label} entry={entry} active={pathname === entry.href || pathname.startsWith(`${entry.href}/`)} open={open === entry.label} setOpen={setOpen} />
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={cta.href}
            aria-hidden={!known || undefined}
            tabIndex={known ? undefined : -1}
            className={cn(
              "inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-ink-fg transition-[opacity,scale] duration-200 ease-quick hover:scale-[1.03] active:scale-[0.98]",
              known ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            {cta.label}
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full lg:hidden"
            aria-label={mobile ? "Close menu" : "Open menu"}
            aria-expanded={mobile}
            aria-controls="mobile-nav"
            onClick={() => setMobile((v) => !v)}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={mobile ? "x" : "m"} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}>
                {mobile ? <X className="size-5" /> : <Menu className="size-5" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobile && (
          <motion.div
            id="mobile-nav"
            key="mobile-nav"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            className="relative h-[calc(100dvh-84px)] overflow-y-auto overscroll-contain bg-subtle px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] lg:hidden"
            data-lenis-prevent
          >
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.2 } }} className="py-4 text-[13px] text-ink/60">
              {site.name}
            </motion.p>
            <motion.ul
              className="divide-y divide-border border-t border-border"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } }}
            >
              {nav.map((entry) => (
                <motion.li
                  key={entry.label}
                  className="py-2"
                  variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.05, 0.7, 0.1, 1] } } }}
                >
                  <Link href={entry.href} onClick={() => setMobile(false)} className="group flex items-center justify-between py-2 text-2xl font-semibold tracking-[-0.02em]">
                    {entry.label}
                    <ArrowUpRight className="size-5 opacity-40 transition-[opacity,translate] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                  </Link>
                  {"items" in entry && (
                    <ul className="pb-2">
                      {entry.items.map((item) => (
                        <li key={item.href}>
                          <Link href={item.href} onClick={() => setMobile(false)} className="block py-1.5 text-[15px] text-ink/70 hover:text-ink">
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.li>
              ))}
            </motion.ul>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.45 } }} className="mt-8">
              <Link href={cta.href} onClick={() => setMobile(false)} className="flex h-12 items-center justify-center rounded-full bg-ink text-[15px] font-medium text-ink-fg">
                {cta.label}
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function NavItem({ entry, active, open, setOpen }: { entry: NavEntry; active: boolean; open: boolean; setOpen: (v: string | null) => void }) {
  const link = cn(
    "inline-flex h-10 items-center gap-1 rounded-full px-3.5 text-[14px] font-medium transition-[opacity,background-color] duration-[120ms]",
    active ? "bg-current/[0.08] opacity-100" : "opacity-75 hover:opacity-100",
  );
  if (!("items" in entry)) {
    return (
      <Link href={entry.href} className={link} aria-current={active ? "page" : undefined} onMouseEnter={() => setOpen(null)} onClick={() => setOpen(null)}>
        {entry.label}
      </Link>
    );
  }
  return (
    <div className="relative" onMouseEnter={() => setOpen(entry.label)}>
      <Link href={entry.href} className={link} aria-current={active ? "page" : undefined} aria-expanded={open} onClick={() => setOpen(null)}>
        {entry.label}
        <ChevronDown className={cn("size-3.5 transition-transform duration-[180ms] ease-quick", open && "rotate-180")} aria-hidden />
      </Link>
      <div
        className={cn(
          "absolute top-full left-1/2 w-80 -translate-x-1/2 pt-2 transition-[opacity,translate] duration-[180ms] ease-quick",
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
        )}
      >
        <ul className="rounded-xl bg-elevated p-2 shadow-e3">
          {entry.items.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={() => setOpen(null)} className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-muted">
                <span className="block text-sm font-medium text-foreground">{item.label}</span>
                {item.description && <span className="mt-0.5 block text-[13px] text-secondary-fg">{item.description}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Whether this browser has a session: null while unknown (the server render), then true or false. */
function useSignedIn() {
  const hint = useSyncExternalStore(
    noop,
    () => document.cookie.includes("-auth-token"),
    () => null,
  );
  const [session, setSession] = useState<boolean | null>(null);
  useEffect(() => {
    const supabase = supabaseBrowser();
    void supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(!!s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session ?? hint;
}

const noop = () => () => {};
