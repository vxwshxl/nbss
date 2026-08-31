"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon, Logo } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** Rendered at the end of the row — unstaffed shifts, incidents awaiting triage. */
  count?: number;
  hot?: boolean;
  /**
   * Leads out of the console entirely. Such a row is never the "current page"
   * — you are not on it, you are leaving by it — and it says so with an arrow
   * rather than by looking like every other destination.
   */
  away?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/**
 * The console shell's navigation.
 *
 * A client component only because of the mobile drawer and the current-page
 * test; the groups themselves are decided on the server in the layout, which
 * is what keeps a guard from ever being sent the admin nav.
 */
export function Sidebar({
  groups,
  role,
  home,
}: {
  groups: NavGroup[];
  role: string;
  /** Where the brand goes — each role's own landing page, not the public site. */
  home: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Any navigation closes the drawer.
  useEffect(() => setOpen(false), [pathname]);

  // The drawer covers the page, so the body must not scroll behind it.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // The dashboard roots are exact matches; everything else matches its subtree,
  // so /console/sites/abc still lights up "Sites". A row that leaves the
  // console is never current — and "/" would otherwise prefix-match every
  // page in the app.
  const isCurrent = (item: NavItem) =>
    item.away
      ? false
      : item.href === "/console" || item.href === "/console/duty"
        ? pathname === item.href
        : pathname.startsWith(item.href);

  const current = groups.flatMap((g) => g.items).find(isCurrent);

  return (
    <>
      <div className="ctop">
        <button
          className="icon-btn"
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="console-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="layers" />
        </button>
        <span className="ctop__title">{current?.label ?? "Console"}</span>
      </div>

      {open && (
        <button
          className="csb__scrim"
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}

      <nav
        className={`csb${open ? " is-open" : ""}`}
        id="console-nav"
        aria-label="Console"
      >
        {/* The mark leads back into the console, not out of it. Somebody
            deep in a table reaching for the logo wants their dashboard; the
            way out to the public site is on the profile page. */}
        <Link className="csb__brand" href={home}>
          <Logo size={30} className="csb__logo" />
          <span>
            <span className="csb__mark">NBSS</span>
            <span className="csb__sub">Operations</span>
          </span>
        </Link>

        {groups.map((group) => (
          <div key={group.label}>
            <p className="csb__group">{group.label}</p>
            {group.items.map((item) => (
              <Link
                key={item.href}
                className={`csb__link${item.away ? " csb__link--away" : ""}`}
                href={item.href}
                aria-current={isCurrent(item) ? "page" : undefined}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {item.count ? (
                  <span className={`csb__count${item.hot ? " csb__count--hot" : ""}`}>
                    {item.count}
                  </span>
                ) : null}
                {item.away && <Icon name="arrow" className="csb__away" />}
              </Link>
            ))}
          </div>
        ))}

        {/* Identity and sign-out live in the header now; what stays here is the
            one control that belongs with the navigation rather than the
            account. */}
        <div className="csb__foot">
          <div className="csb__actions">
            <ThemeToggle />
            <span className="csb__role">{role}</span>
          </div>
        </div>
      </nav>
    </>
  );
}
