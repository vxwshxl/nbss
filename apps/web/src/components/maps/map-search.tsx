"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, MapPin, Search, X } from "lucide-react";

import { KOKRAJHAR, createHtmlMarker, type HtmlMarker } from "@/lib/google-maps";
import { cn } from "@/lib/utils";

/** Something of our own the search box offers before Google's places: a site, say. */
export type LocalResult = { id: string; label: string; sub?: string; lat: number; lng: number };

export type FoundPlace = { lat: number; lng: number; name: string; address: string };

type Suggestion = { kind: "local"; item: LocalResult } | { kind: "google"; id: string; main: string; sub: string; prediction: google.maps.places.PlacePrediction };

/**
 * A search box over a map, as Google Maps has one: type a place, a road or a
 * building and pick it, and the map flies there and drops a red pin.
 *
 * Places come from Google's Places API (New) autocomplete, biased to what the map
 * shows and kept to India. One session token covers the typing and the pick, so
 * Google bills one search, not one per keystroke. `local` results (the agency's own
 * sites) are listed first, because a site is what someone here usually means.
 *
 * Its list draws inside the map rather than in a portal, so it still works when
 * the map is full screen. Enter never submits a form the map sits in.
 */
export function MapSearch({
  maps,
  map,
  local = [],
  onLocal,
  onPlace,
  placeholder = "Search Google Maps",
  className,
}: {
  maps: typeof google.maps | null;
  map: google.maps.Map | null;
  local?: LocalResult[];
  /** A local result was picked. Without this the map just goes there. */
  onLocal?: (item: LocalResult) => void;
  /** A Google place was picked (after the map has moved to it). */
  onPlace?: (place: FoundPlace) => void;
  placeholder?: string;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  // Google's answer, tagged with the text it answers, so a stale one is never shown.
  const [found, setFound] = useState<{ term: string; items: Suggestion[]; failed: string | null } | null>(null);
  const [picking, setPicking] = useState(false);
  const [pickFailed, setPickFailed] = useState<string | null>(null);
  const [activeAt, setActiveAt] = useState({ term: "", i: 0 });
  const places = useRef<google.maps.PlacesLibrary | null>(null);
  const token = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const pin = useRef<HtmlMarker | null>(null);
  const asked = useRef(0);

  const term = q.trim().toLowerCase();
  const asking = !!maps && !!map && term.length >= 2;
  const google_ = useMemo(() => (asking && found?.term === term ? found.items : []), [asking, found, term]);
  const failed = pickFailed ?? (asking && found?.term === term ? found.failed : null);
  const busy = picking || (asking && found?.term !== term);
  const active = activeAt.term === term ? activeAt.i : 0;
  const setActive = (f: (i: number) => number) => setActiveAt({ term, i: f(active) });
  const localHits = useMemo<Suggestion[]>(
    () =>
      term
        ? local
            .filter((l) => `${l.label} ${l.sub ?? ""}`.toLowerCase().includes(term))
            .slice(0, 5)
            .map((item) => ({ kind: "local", item }))
        : [],
    [local, term],
  );
  const list = useMemo(() => [...localHits, ...google_], [localHits, google_]);

  // Google's suggestions, a quarter of a second after the typing stops.
  useEffect(() => {
    if (!maps || !map || term.length < 2) return;
    const ask = ++asked.current;
    const t = setTimeout(async () => {
      try {
        places.current ??= (await maps.importLibrary("places")) as google.maps.PlacesLibrary;
        const lib = places.current;
        token.current ??= new lib.AutocompleteSessionToken();
        const bounds = map.getBounds();
        const { suggestions } = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q.trim(),
          sessionToken: token.current,
          locationBias: bounds ?? { center: KOKRAJHAR, radius: 50_000 },
          includedRegionCodes: ["in"],
          language: "en",
          region: "in",
        });
        if (ask !== asked.current) return;
        setFound({
          term,
          failed: null,
          items: suggestions
            .map((s) => s.placePrediction)
            .filter((p): p is google.maps.places.PlacePrediction => !!p)
            .slice(0, 6)
            .map((p) => ({
              kind: "google" as const,
              id: p.placeId,
              main: p.mainText?.text ?? p.text.text,
              sub: p.secondaryText?.text ?? "",
              prediction: p,
            })),
        });
      } catch (e) {
        if (ask !== asked.current) return;
        console.error("[maps] place search failed", e);
        setFound({ term, items: [], failed: "Place search is unavailable right now." });
      }
    }, 250);
    return () => clearTimeout(t);
    // `q` is read through `term`; the map's bounds are read when the timer fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maps, map, term]);

  // The red pin goes with the box.
  useEffect(() => () => pin.current?.setMap(null), []);

  function drop(at: google.maps.LatLngLiteral, title: string) {
    if (!maps || !map) return;
    pin.current?.setMap(null);
    pin.current = createHtmlMarker(maps, { position: at, anchor: "bottom", html: `<span class="gm-place"></span>`, zIndex: 60, title });
    pin.current.setMap(map);
  }

  async function pick(s: Suggestion | undefined) {
    if (!s || !maps || !map) return;
    setOpen(false);
    if (s.kind === "local") {
      setQ(s.item.label);
      pin.current?.setMap(null);
      pin.current = null;
      if (onLocal) onLocal(s.item);
      else {
        map.panTo({ lat: s.item.lat, lng: s.item.lng });
        map.setZoom(17);
      }
      return;
    }
    setQ(s.main);
    setPicking(true);
    setPickFailed(null);
    try {
      const place = s.prediction.toPlace();
      await place.fetchFields({ fields: ["displayName", "formattedAddress", "location", "viewport"] });
      // The pick ends Google's billing session; the next search starts another.
      token.current = null;
      const loc = place.location;
      if (!loc) return;
      const at = { lat: loc.lat(), lng: loc.lng() };
      if (place.viewport) {
        map.fitBounds(place.viewport);
        maps.event.addListenerOnce(map, "idle", () => {
          if ((map.getZoom() ?? 0) > 18) map.setZoom(18);
        });
      } else {
        map.panTo(at);
        map.setZoom(17);
      }
      drop(at, place.displayName ?? s.main);
      onPlace?.({ ...at, name: place.displayName ?? s.main, address: place.formattedAddress ?? s.sub });
    } catch (e) {
      console.error("[maps] place details failed", e);
      setPickFailed("Could not open that place.");
      setOpen(true);
    } finally {
      setPicking(false);
    }
  }

  function clear() {
    setQ("");
    setPickFailed(null);
    pin.current?.setMap(null);
    pin.current = null;
  }

  const showList = open && term.length > 0;
  const listId = useId();

  return (
    <div className={cn("pointer-events-auto relative", className)}>
      <label className="flex h-10 items-center gap-2 rounded-full bg-card pr-1.5 pl-3.5 shadow-md ring-1 ring-border focus-within:ring-2 focus-within:ring-ring/60">
        {busy ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : <Search className="size-4 shrink-0 text-muted-foreground" />}
        <input
          type="text"
          value={q}
          disabled={!map}
          onChange={(e) => {
            setQ(e.target.value);
            setPickFailed(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Never the form around the map.
              e.preventDefault();
              void pick(list[active] ?? list[0]);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, list.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {q && (
          <button type="button" onClick={clear} aria-label="Clear the search" className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        )}
      </label>

      {showList && (list.length > 0 || failed || (!busy && term.length >= 2)) && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-2xl bg-card py-1.5 shadow-lg ring-1 ring-border">
          {list.map((s, i) => (
            <li key={s.kind === "local" ? `l:${s.item.id}` : `g:${s.id}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                // Keeps the input focused, so its blur does not close the list before the click lands.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(() => i)}
                onClick={() => void pick(s)}
                className={cn("flex w-full items-start gap-3 px-3.5 py-2 text-left", i === active && "bg-muted")}
              >
                <MapPin className={cn("mt-0.5 size-4 shrink-0", s.kind === "local" ? "text-primary" : "text-muted-foreground")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.kind === "local" ? s.item.label : s.main}</span>
                  {(s.kind === "local" ? s.item.sub : s.sub) && (
                    <span className="block truncate text-xs text-muted-foreground">{s.kind === "local" ? s.item.sub : s.sub}</span>
                  )}
                </span>
                {s.kind === "local" && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Site</span>}
              </button>
            </li>
          ))}
          {list.length === 0 && !failed && <li className="px-3.5 py-2 text-sm text-muted-foreground">No place found.</li>}
          {failed && <li className="px-3.5 py-2 text-sm text-destructive">{failed}</li>}
        </ul>
      )}
    </div>
  );
}

/**
 * A short list to pick from, drawn over a map: "All sites" and each site, with a
 * filter once the list is long. Not a portal, so it works with the map full screen.
 */
export function MapListPicker({
  items,
  value,
  onChange,
  allLabel,
  icon: Icon = MapPin,
  className,
}: {
  items: { id: string; label: string; sub?: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
  allLabel: string;
  icon?: typeof MapPin;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const current = items.find((i) => i.id === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const f = filter.trim().toLowerCase();
  const shown = f ? items.filter((i) => `${i.label} ${i.sub ?? ""}`.toLowerCase().includes(f)) : items;
  const choose = (id: string | null) => {
    onChange(id);
    setOpen(false);
    setFilter("");
  };

  return (
    <div ref={box} className={cn("pointer-events-auto relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-10 w-full items-center gap-2 rounded-full bg-card px-3.5 text-sm font-medium shadow-md ring-1 ring-border hover:bg-muted"
      >
        <Icon className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-left">{current?.label ?? allLabel}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1.5 w-[max(100%,16rem)] overflow-hidden rounded-2xl bg-card shadow-lg ring-1 ring-border">
          {items.length > 6 && (
            <div className="border-b border-app-line-soft p-2">
              <input
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (shown[0]) choose(shown[0].id);
                  } else if (e.key === "Escape") setOpen(false);
                }}
                placeholder="Find…"
                className="h-8 w-full rounded-full bg-muted/70 px-3 text-sm outline-none"
              />
            </div>
          )}
          <ul className="max-h-72 overflow-y-auto py-1">
            {!f && (
              <li>
                <button type="button" onClick={() => choose(null)} className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm font-medium hover:bg-muted">
                  <span className="min-w-0 flex-1 truncate">{allLabel}</span>
                  {value === null && <Check className="size-4 text-primary" />}
                </button>
              </li>
            )}
            {shown.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => choose(i.id)} className="flex w-full items-center gap-2 px-3.5 py-2 text-left hover:bg-muted">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{i.label}</span>
                    {i.sub && <span className="block truncate text-xs text-muted-foreground">{i.sub}</span>}
                  </span>
                  {value === i.id && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="px-3.5 py-2 text-sm text-muted-foreground">Nothing matches.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
