"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { searchServices, services } from "@/content/services";

/**
 * Live service search.
 *
 * The catalogue is thirty-one items and already shipped to the client as part
 * of the route bundle, so the filter runs locally — no request, no debounce, no
 * loading state. This is the one place the Next rewrite is meaningfully faster
 * than the endpoint it replaced.
 */
export function SiteSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const results = useMemo(() => searchServices(query).slice(0, 8), [query]);
  const trimmed = query.trim();

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
            placeholder={`Search ${services.length} services — “bank”, “housekeeping”, “tea estate”…`}
            autoComplete="off"
            aria-label="Search services"
          />
        </label>
        <button className="icon-btn" type="button" onClick={onClose} aria-label="Close search">
          <Icon name="close" />
        </button>
      </div>

      <div className="wrap">
        <div className="search-results" role="status" aria-live="polite">
          {trimmed && results.length > 0 && (
            <>
              <p className="search-results__meta">
                {results.length} match{results.length === 1 ? "" : "es"} for “{trimmed}”
              </p>
              <ul className="search-results__list">
                {results.map((s) => (
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

          {trimmed && results.length === 0 && (
            <p className="search-results__meta search-results__meta--empty">
              Nothing matches “{trimmed}”. Try “bank”, “hospital”, “housekeeping”, “CCTV” or
              “tea estate” — or <Link href="/contact">tell us what you need</Link>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
