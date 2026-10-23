/**
 * Google Maps, loaded once per page and shared by every map on it.
 *
 * Google's own "dynamic library import" bootstrap, written out rather than
 * pulled in as a package: it defines `google.maps.importLibrary` immediately and
 * fetches the script the first time a library is asked for, so a page with no
 * map never downloads anything. The key is public by design (it ships to every
 * browser) and is restricted by HTTP referrer in Google Cloud.
 */

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

let loading: Promise<typeof google.maps> | null = null;

export function hasMapsKey(): boolean {
  return KEY.length > 0;
}

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps only loads in a browser."));
  if (loading) return loading;

  loading = new Promise<typeof google.maps>((resolve, reject) => {
    const w = window as unknown as { google?: typeof google; __nbssMapsReady?: () => void; gm_authFailure?: () => void };
    if (w.google?.maps?.Map) {
      resolve(w.google.maps);
      return;
    }
    w.__nbssMapsReady = () => resolve(w.google!.maps);
    // Google calls this when the key is refused (wrong referrer, API not enabled).
    w.gm_authFailure = () => console.error("[maps] Google refused the API key — check its referrer restrictions.");

    const params = new URLSearchParams({
      key: KEY,
      v: "weekly",
      libraries: "geometry",
      language: "en",
      region: "IN",
      callback: "__nbssMapsReady",
      loading: "async",
    });
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error("Google Maps could not be loaded. Check the connection."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Kokrajhar town centre, for a map with nothing on it yet. */
export const KOKRAJHAR = { lat: 26.4015, lng: 90.2717 };

/**
 * A quiet base map: the roads and places a supervisor navigates by, with the
 * colour turned down so guards, fences and the route are what stands out.
 */
export const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "labels.icon", stylers: [{ saturation: -60 }, { lightness: 15 }] },
  { featureType: "transit", stylers: [{ visibility: "simplified" }] },
  { elementType: "geometry", stylers: [{ saturation: -35 }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9e2ef" }] },
];

export const MAP_COLOR = {
  primary: "#009164",
  inside: "#009164",
  outside: "#d97706",
  sos: "#dc2626",
  stale: "#94a3b8",
  route: "#2563eb",
  muted: "#64748b",
} as const;

/** Map options every console map shares. */
export function baseOptions(extra: google.maps.MapOptions = {}): google.maps.MapOptions {
  return {
    center: KOKRAJHAR,
    zoom: 13,
    styles: MAP_STYLE,
    clickableIcons: false,
    streetViewControl: false,
    fullscreenControl: true,
    mapTypeControl: true,
    // TOP_RIGHT, DROPDOWN_MENU — numeric because the enums only exist once the script has loaded.
    mapTypeControlOptions: { position: 3, style: 1 as google.maps.MapTypeControlStyle },
    zoomControl: true,
    gestureHandling: "cooperative",
    ...extra,
  };
}

/** A radius fence as a ring of points, so circle and polygon fences draw the same way. */
export function circlePath(center: { lat: number; lng: number }, radiusM: number, steps = 64): google.maps.LatLngLiteral[] {
  const lat = (center.lat * Math.PI) / 180;
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos(lat));
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * 2 * Math.PI;
    return { lat: center.lat + dLat * Math.sin(a), lng: center.lng + dLng * Math.cos(a) };
  });
}

/**
 * An HTML marker: any element, pinned to a coordinate. Built on OverlayView so
 * it needs no Map ID and draws exactly as the console's CSS styles it — a guard
 * chip with a name and a battery reads far better than a coloured pin.
 */
export function createHtmlMarker(
  maps: typeof google.maps,
  opts: { position: google.maps.LatLngLiteral; html: string; anchor?: "center" | "bottom"; zIndex?: number; onClick?: () => void; title?: string },
) {
  class HtmlMarker extends maps.OverlayView {
    el: HTMLDivElement;
    pos: google.maps.LatLngLiteral;
    anchor: "center" | "bottom";
    constructor() {
      super();
      this.pos = opts.position;
      this.anchor = opts.anchor ?? "center";
      this.el = document.createElement("div");
      this.el.style.position = "absolute";
      this.el.style.zIndex = String(opts.zIndex ?? 1);
      this.el.innerHTML = opts.html;
      if (opts.title) this.el.title = opts.title;
      if (opts.onClick) {
        this.el.style.cursor = "pointer";
        this.el.addEventListener("click", (e) => {
          e.stopPropagation();
          opts.onClick?.();
        });
      }
    }
    onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(this.el);
    }
    draw() {
      const p = this.getProjection()?.fromLatLngToDivPixel(new maps.LatLng(this.pos));
      if (!p) return;
      this.el.style.left = `${p.x}px`;
      this.el.style.top = `${p.y}px`;
      this.el.style.transform = this.anchor === "bottom" ? "translate(-50%, -100%)" : "translate(-50%, -50%)";
    }
    onRemove() {
      this.el.remove();
    }
    setPosition(pos: google.maps.LatLngLiteral) {
      this.pos = pos;
      this.draw();
    }
    setHtml(html: string) {
      if (this.el.innerHTML !== html) this.el.innerHTML = html;
    }
    setZ(z: number) {
      this.el.style.zIndex = String(z);
    }
  }
  return new HtmlMarker();
}

export type HtmlMarker = ReturnType<typeof createHtmlMarker>;

export function esc(v: string): string {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
