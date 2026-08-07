"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AronaiBand, Icon, Logo } from "@/components/Icon";
import { SiteSearch } from "@/components/SiteSearch";
import { site, tel } from "@/content/site";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/training", label: "Training" },
  { href: "/gallery", label: "Gallery" },
  { href: "/careers", label: "Careers" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const searchButton = useRef<HTMLButtonElement>(null);

  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Any navigation closes both overlays.
  useEffect(() => {
    setNavOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // The mobile sheet covers the page, so the body must not scroll behind it.
  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setNavOpen(false);
      setSearchOpen(false);
      return;
    }
    // "/" focuses search, the way a documentation site would.
    const tag = (e.target as HTMLElement | null)?.tagName ?? "";
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) {
      e.preventDefault();
      setSearchOpen(true);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  return (
    <>
      <div className="topbar">
        <div className="wrap topbar__in">
          <p className="topbar__note">
            <span className="pulse" aria-hidden="true" />
            Deployment desk — <a href={`tel:${tel(site.phone)}`}>{site.phone}</a>
          </p>
          <p className="topbar__note topbar__note--end">
            24 × 7 supervision · Police-verified guards · Kokrajhar, BTC
          </p>
        </div>
      </div>

      <div className="headerstack">
        <header className={`masthead${stuck ? " is-stuck" : ""}`}>
          <div className="wrap masthead__in">
            <Link className="brand" href="/" aria-label={`${site.name} — home`}>
              <Logo />
              <span className="brand__text">
                <strong className="brand__mark">{site.shortName}</strong>
                <span className="brand__full">{site.name}</span>
              </span>
            </Link>

            <nav
              className={`nav${navOpen ? " is-open" : ""}`}
              id="nav"
              aria-label="Primary"
            >
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isCurrent(item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}

              {/* Only visible inside the mobile sheet — the bar has its own CTA. */}
              <span className="nav__foot">
                <Link className="btn btn--gold btn--lg" href="/contact#quote">
                  Request a quote
                </Link>
                <a className="nav__tel" href={`tel:${tel(site.phone)}`}>
                  <Icon name="phone" /> Call {site.phone}
                </a>
              </span>
            </nav>

            <div className="masthead__actions">
              <button
                ref={searchButton}
                className="icon-btn"
                type="button"
                aria-label="Search this site"
                aria-expanded={searchOpen}
                onClick={() => setSearchOpen((v) => !v)}
              >
                <Icon name="search" />
              </button>

              <Link className="btn btn--gold masthead__cta" href="/contact#quote">
                Request a quote
              </Link>

              <button
                className="icon-btn nav-toggle"
                type="button"
                aria-label="Menu"
                aria-expanded={navOpen}
                aria-controls="nav"
                onClick={() => setNavOpen((v) => !v)}
              >
                <span />
                <span />
                <span />
              </button>
            </div>
          </div>

          <AronaiBand />
        </header>

        {searchOpen && (
          <SiteSearch
            onClose={() => {
              setSearchOpen(false);
              searchButton.current?.focus();
            }}
          />
        )}
      </div>
    </>
  );
}
