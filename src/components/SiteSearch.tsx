"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { searchPages } from "@/content/pages";
import { searchServices, services } from "@/content/services";

/**
 * Live site search.
 *
 * The catalogue is thirty-one items and already shipped to the client as part
 * of the route bundle, so the filter runs locally — no request, no debounce, no
 * loading state. This is the one place the Next rewrite is meaningfully faster
 * than the endpoint it replaced.
 *
 * Pages are searched alongside services and listed first: someone typing
 * "careers" or "quote" wants the page, and burying it under service matches
 * (or, as before, not indexing it at all) makes the box look broken.
 */
export function SiteSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const pageHits = useMemo(() => searchPages(query).slice(0, 4), [query]);
  const serviceHits = useMemo(() => searchServices(query).slice(0, 8), [query]);
  const trimmed = query.trim();
  const total = pageHits.length + serviceHits.length;

  return (
    <div className="searchbar" id="searchbar">
      <div className="wrap searchbar__in">
        <label className="searchbar__field">
          <Icon name="search" />
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${services.length} services and every page — “bank”, “careers”, “quote”…`}
            autoComplete="off"
            aria-label="Search this site"
          />
        </label>
        <button className="icon-btn" type="button" onClick={onClose} aria-label="Close search">
          <Icon name="close" />
        </button>
      </div>

      <div className="wrap">
        <div className="search-results" role="status" aria-live="polite">
          {trimmed && total > 0 && (
            <p className="search-results__meta">
              {total} match{total === 1 ? "" : "es"} for “{trimmed}”
            </p>
          )}

          {trimmed && pageHits.length > 0 && (
            <>
              <p className="search-results__group">Pages</p>
              <ul className="search-results__list">
                {pageHits.map((p) => (
                  <li key={p.href}>
                    <Link href={p.href} onClick={onClose}>
                      <Icon name={p.icon} />
                      <span>
                        <strong>{p.title}</strong>
                        <em>{p.summary}</em>
                      </span>
                      <Icon name="arrow" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {trimmed && serviceHits.length > 0 && (
            <>
              <p className="search-results__group">Services</p>
              <ul className="search-results__list">
                {serviceHits.map((s) => (
                  <li key={s.slug}>
                    <Link href={`/services/${s.slug}`} onClick={onClose}>
                      <Icon name={s.icon} />
                      <span>
                        <strong>{s.name}</strong>
                        <em>{s.summary}</em>
                      </span>
                      <Icon name="arrow" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {trimmed && total === 0 && (
            <p className="search-results__meta search-results__meta--empty">
              Nothing matches “{trimmed}”. Try “bank”, “hospital”, “housekeeping”, “CCTV”,
              “careers” or “quote” — or <Link href="/contact">tell us what you need</Link>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
