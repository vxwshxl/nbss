"use client";

import { useEffect, useMemo, useRef } from "react";

import { MapListPicker, MapSearch } from "@/components/maps/map-search";
import { MapFrame, useGoogleMap } from "@/components/maps/use-google-map";
import { MAP_COLOR, circlePath, createHtmlMarker, esc, type HtmlMarker } from "@/lib/google-maps";
import { initials } from "@/lib/ui/initials";

/** A site, with whatever fence it was given and who is standing in it. */
export type MapSite = {
  id: string;
  name: string;
  client_name: string | null;
  district: string | null;
  lat: number;
  lng: number;
  geofence_radius_m: number;
  /** A `[lng, lat][]` ring, when the site is an outline rather than a circle. */
  ring: [number, number][] | null;
  /** Guards currently checked in here. Drives the marker's colour. */
  onDuty: number;
  /** Guards assigned to this site at all, on duty or not. */
  assigned: number;
};

/** One recorded punch, drawn against its site's fence. */
export type MapPunch = {
  lat: number;
  lng: number;
  /** GPS accuracy in metres — drawn as the circle the fix could be anywhere in. */
  accuracy: number | null;
  /** Metres from the site centre, as the database computed it at punch time. */
  distance: number | null;
  inside: boolean;
  label: string;
};

/** A location sent from the field by a guard, housekeeper or supervisor (location_pins, 0073). */
export type MapFieldPin = {
  id: string;
  lat: number;
  lng: number;
  accuracy: number;
  note: string | null;
  senderName: string;
  senderRole: string;
  capturedAt: string;
  /** The site registered from it, once there is one. */
  siteName: string | null;
};

/**
 * The deployment map, on Google Maps.
 *
 * Read-only, and deliberately not the same component as the fence editor: an
 * editor's job is to let you move a boundary, and every one of its click
 * handlers is a way to move one by accident. This draws.
 *
 * Fences say where a guard may punch from; dots say where one actually did. A
 * dot outside its own fence is the most useful thing this map can show, so it
 * is drawn in red and nothing else competes with it.
 */
export function SiteMap({
  sites,
  punches = [],
  /** Zoom to this site on first paint instead of fitting them all. */
  focus,
  className,
  height = 420,
  search = false,
  selected = null,
  onSelect,
  pins = [],
  selectedPin = null,
  onRegisterPin,
  onDeletePin,
}: {
  sites: MapSite[];
  punches?: MapPunch[];
  focus?: string;
  className?: string;
  height?: number | string;
  /** A place search over the map (and, with `onSelect`, the site list beside it), and the frame's own full screen. */
  search?: boolean;
  /** The site picked from the map's list: the camera flies to it and it is drawn lifted. */
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  pins?: MapFieldPin[];
  /** Fly to this pin and open its card. */
  selectedPin?: string | null;
  onRegisterPin?: (pin: MapFieldPin) => void;
  onDeletePin?: (pin: MapFieldPin) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const { maps, map, error } = useGoogleMap(host, { zoom: 11, ...(search ? { fullscreenControl: false } : {}) });
  const framed = useRef(false);
  const info = useRef<google.maps.InfoWindow | null>(null);
  const pinActions = useRef({ onRegisterPin, onDeletePin });
  useEffect(() => {
    pinActions.current = { onRegisterPin, onDeletePin };
  }, [onRegisterPin, onDeletePin]);
  const pinMarkers = useRef(new Map<string, { marker: HtmlMarker; open: () => void }>());

  const local = useMemo(
    () => sites.map((s) => ({ id: s.id, label: s.name, sub: [s.client_name, s.district].filter(Boolean).join(" · ") || undefined, lat: s.lat, lng: s.lng })),
    [sites],
  );

  useEffect(() => {
    if (!maps || !map) return;
    const drawn: { setMap: (m: google.maps.Map | null) => void }[] = [];
    const markers: HtmlMarker[] = [];
    const info = new maps.InfoWindow();
    const bounds = new maps.LatLngBounds();

    for (const s of sites) {
      const colour = s.onDuty > 0 ? MAP_COLOR.primary : MAP_COLOR.muted;
      const lifted = s.id === selected;
      const path = s.ring?.length ? s.ring.map(([lng, lat]) => ({ lat, lng })) : circlePath(s, s.geofence_radius_m);
      const shape = new maps.Polygon({
        map,
        paths: path,
        strokeColor: lifted ? MAP_COLOR.route : colour,
        strokeWeight: lifted ? 3.5 : 2,
        fillColor: lifted ? MAP_COLOR.route : colour,
        fillOpacity: lifted ? 0.2 : 0.12,
        zIndex: lifted ? 3 : 1,
        clickable: false,
      });
      drawn.push(shape);
      for (const p of path) bounds.extend(p);

      const marker = createHtmlMarker(maps, {
        position: { lat: s.lat, lng: s.lng },
        anchor: "bottom",
        html: `<div class="gm-pin" style="--c:${lifted ? MAP_COLOR.route : colour}" ${lifted ? "data-selected" : ""}><span>${esc(s.name)}</span><i></i></div>`,
        zIndex: lifted ? 40 : 2,
        onClick: () => {
          openCard(
            maps,
            map,
            info,
            { lat: s.lat, lng: s.lng },
            ABOVE.pin,
            s.name,
            cardBody(
              (s.client_name || s.district ? `<p>${esc([s.client_name, s.district].filter(Boolean).join(" · "))}</p>` : "") +
                `<p class="gm-info-meta">${s.onDuty} on duty · ${s.assigned} assigned</p>`,
            ),
          );
        },
      });
      marker.setMap(map);
      markers.push(marker);
    }

    for (const p of punches) {
      const colour = p.inside ? MAP_COLOR.inside : MAP_COLOR.sos;
      if (p.accuracy) {
        drawn.push(
          new maps.Circle({
            map,
            center: p,
            radius: p.accuracy,
            strokeOpacity: 0,
            fillColor: colour,
            fillOpacity: 0.14,
            clickable: false,
          }),
        );
      }
      const dot = createHtmlMarker(maps, {
        position: { lat: p.lat, lng: p.lng },
        html: `<span class="gm-dot" style="--c:${colour}"></span>`,
        zIndex: 5,
        onClick: () => {
          openCard(
            maps,
            map,
            info,
            p,
            ABOVE.dot,
            p.label,
            cardBody(
              `<p class="gm-info-meta">` +
                [p.distance !== null ? `${Math.round(p.distance)} m from the centre` : "", p.accuracy ? `GPS ±${Math.round(p.accuracy)} m` : ""].filter(Boolean).join(" · ") +
                `</p>`,
            ),
          );
        },
      });
      dot.setMap(map);
      markers.push(dot);
      bounds.extend(p);
    }

    // Framed once: a live refresh must not yank the view away from where the
    // reader has panned to.
    if (!framed.current) {
      const focused = focus ? sites.find((s) => s.id === focus) : undefined;
      if (focused && punches.length === 0) {
        map.setCenter({ lat: focused.lat, lng: focused.lng });
        map.setZoom(17);
      } else if (!bounds.isEmpty()) {
        map.fitBounds(bounds, 40);
        maps.event.addListenerOnce(map, "idle", () => {
          if ((map.getZoom() ?? 0) > 17) map.setZoom(17);
        });
      }
      framed.current = sites.length > 0 || punches.length > 0;
    }

    return () => {
      info.close();
      for (const d of drawn) d.setMap(null);
      for (const m of markers) m.setMap(null);
    };
  }, [maps, map, sites, punches, focus, selected]);

  // A site picked from the list: fly to its whole fence.
  useEffect(() => {
    if (!maps || !map || !selected) return;
    const s = sites.find((x) => x.id === selected);
    if (!s) return;
    const bounds = new maps.LatLngBounds();
    for (const p of s.ring?.length ? s.ring.map(([lng, lat]) => ({ lat, lng })) : circlePath(s, s.geofence_radius_m)) bounds.extend(p);
    map.fitBounds(bounds, 80);
    maps.event.addListenerOnce(map, "idle", () => {
      if ((map.getZoom() ?? 0) > 18) map.setZoom(18);
    });
    framed.current = true;
    // Only when the pick changes, not on every live refresh of the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maps, map, selected]);

  // Back to "All sites": everything in view again.
  const wasSelected = useRef(selected);
  useEffect(() => {
    const before = wasSelected.current;
    wasSelected.current = selected;
    if (!maps || !map || selected || !before) return;
    const bounds = new maps.LatLngBounds();
    for (const s of sites) bounds.extend({ lat: s.lat, lng: s.lng });
    if (bounds.isEmpty()) return;
    map.fitBounds(bounds, 60);
    maps.event.addListenerOnce(map, "idle", () => {
      if ((map.getZoom() ?? 0) > 17) map.setZoom(17);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maps, map, selected]);

  // Locations sent from the field: amber pins, each with a card to register a site there or delete it.
  useEffect(() => {
    if (!maps || !map) return;
    info.current ??= new maps.InfoWindow();
    const card = info.current;
    const drawn: { setMap: (m: google.maps.Map | null) => void }[] = [];
    const markers = pinMarkers.current;
    for (const p of pins) {
      const colour = p.siteName ? MAP_COLOR.muted : MAP_COLOR.outside;
      const ring = new maps.Circle({ map, center: p, radius: p.accuracy, strokeColor: colour, strokeOpacity: 0.5, strokeWeight: 1, fillColor: colour, fillOpacity: 0.1, clickable: false });
      drawn.push(ring);
      const open = () => {
        const when = new Date(p.capturedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
        const el = cardBody(
          `<div class="gm-info-who" style="--c:${colour}"><i>${esc(initials(p.senderName))}</i><span><b>${esc(p.senderName)}</b><small>${esc(p.senderRole)}</small></span></div>` +
            `<p class="gm-info-meta">${esc(when)} · GPS ±${Math.round(p.accuracy)} m</p>` +
            `<p class="gm-info-meta"><a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}" target="_blank" rel="noreferrer">${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}</a></p>` +
            (p.siteName ? `<p class="gm-info-done">Registered as ${esc(p.siteName)}</p>` : ""),
        );
        const actions = document.createElement("div");
        actions.className = "gm-info-actions";
        if (pinActions.current.onRegisterPin && !p.siteName) {
          const b = document.createElement("button");
          b.type = "button";
          b.dataset.primary = "";
          b.textContent = "Register a site here";
          b.onclick = () => {
            card.close();
            pinActions.current.onRegisterPin?.(p);
          };
          actions.append(b);
        }
        if (pinActions.current.onDeletePin) {
          const b = document.createElement("button");
          b.type = "button";
          b.dataset.danger = "";
          b.textContent = "Delete";
          b.onclick = () => {
            card.close();
            pinActions.current.onDeletePin?.(p);
          };
          actions.append(b);
        }
        if (actions.childElementCount) el.append(actions);
        openCard(maps, map, card, p, ABOVE.fieldPin, p.note || "Location sent from the field", el);
      };
      const marker = createHtmlMarker(maps, {
        position: { lat: p.lat, lng: p.lng },
        anchor: "bottom",
        html: `<div class="gm-fieldpin" style="--c:${colour}" ${p.id === selectedPin ? "data-selected" : ""}><b><em>${esc(initials(p.senderName))}</em></b><span>${esc(p.note || p.senderName.split(" ")[0] || "Pin")}</span></div>`,
        zIndex: p.id === selectedPin ? 45 : 30,
        title: `Sent by ${p.senderName}`,
        onClick: open,
      });
      marker.setMap(map);
      drawn.push(marker);
      markers.set(p.id, { marker, open });
    }
    return () => {
      for (const d of drawn) d.setMap(null);
      markers.clear();
    };
  }, [maps, map, pins, selectedPin]);

  // A pin picked from the list below the map: fly there and open its card.
  useEffect(() => {
    if (!map || !selectedPin) return;
    const p = pins.find((x) => x.id === selectedPin);
    if (!p) return;
    map.panTo({ lat: p.lat, lng: p.lng });
    if ((map.getZoom() ?? 0) < 17) map.setZoom(18);
    framed.current = true;
    pinMarkers.current.get(p.id)?.open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedPin]);

  return (
    <MapFrame hostRef={host} ready={!!map} error={error} height={height} className={className} fullscreen={search}>
      {search && (
        // Top left, clear of Map / Satellite and full screen on the right.
        <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 flex w-[calc(100%-5.5rem)] flex-col gap-2 sm:w-auto sm:max-w-[calc(100%-15rem)] sm:flex-row sm:items-start">
          {onSelect && sites.length > 1 && (
            <MapListPicker
              items={local.map((l) => ({ id: l.id, label: l.label, sub: l.sub }))}
              value={selected}
              onChange={onSelect}
              allLabel="All sites"
              className="sm:w-56"
            />
          )}
          <MapSearch
            maps={maps}
            map={map}
            local={local}
            onLocal={onSelect ? (l) => onSelect(l.id) : undefined}
            placeholder="Search a place or site"
            className="sm:w-80"
          />
        </div>
      )}
    </MapFrame>
  );
}

/** Pixels from a marker's point up to its top, so a card opens above the marker, not over it. */
const ABOVE = { pin: 38, fieldPin: 44, dot: 10 };

/**
 * One map card for every marker here: the title in Google's header row beside its
 * close button (no empty strip above the text), lines under it, then the actions.
 */
function openCard(
  maps: typeof google.maps,
  map: google.maps.Map,
  win: google.maps.InfoWindow,
  at: google.maps.LatLngLiteral,
  above: number,
  title: string,
  body: Element,
) {
  const head = document.createElement("div");
  head.className = "gm-info-title";
  head.textContent = title;
  win.setOptions({ headerContent: head, pixelOffset: new maps.Size(0, -above), maxWidth: 300 });
  win.setContent(body);
  win.setPosition(at);
  win.open({ map });
}

/** The card's body from trusted, already-escaped HTML. */
function cardBody(html: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "gm-info";
  el.innerHTML = html;
  return el;
}
