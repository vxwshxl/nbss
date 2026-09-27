import type { NextConfig } from "next";

/**
 * Everything the site needs is same-origin — fonts, images and scripts are all
 * served from `public/`. That makes a strict Content-Security-Policy possible
 * without exceptions for a CDN.
 *
 * 'unsafe-inline' on style-src covers the inline `--i` custom properties used
 * for staggered reveal delays. Next injects its own inline bootstrap script, so
 * script-src carries 'unsafe-inline' too; in dev it additionally needs
 * 'unsafe-eval' for React Refresh.
 */
const isDev = process.env.NODE_ENV === "development";

/**
 * The Supabase origin the browser is allowed to reach.
 *
 * `connect-src 'self'` was correct while every query ran on the server. It stops being
 * correct the moment the console subscribes to anything: the realtime channel is a
 * WebSocket to `wss://<ref>.supabase.co/realtime/v1`, and a strict policy blocks it
 * silently — the socket simply never opens and the map never updates, with nothing in the
 * server logs to explain why.
 *
 * Derived from the env var rather than hard-coded, so pointing the app at a different
 * project (or at a self-hosted instance) does not need this file edited too. Both schemes
 * are listed because the REST calls are https and the realtime channel is wss.
 */
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    // No URL configured — the app throws at startup anyway (see lib/supabase/env.ts).
    // Returning nothing here keeps the policy strict rather than accidentally wide.
    return "";
  }
})();

const supabaseConnect = supabaseOrigin
  ? ` ${supabaseOrigin} ${supabaseOrigin.replace(/^https/, "wss")}`
  : "";

const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "font-src 'self'",
  `connect-src 'self'${supabaseConnect}` + (isDev ? " ws: wss:" : ""),
  // The service worker that makes this installable. Same-origin only — it would fall back
  // to script-src anyway, but a worker is the one thing that keeps running after the page
  // is closed, so its policy is worth stating rather than inheriting.
  "worker-src 'self'",
  "manifest-src 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /**
   * `@nbss/shared` ships TypeScript source rather than a compiled `dist`, so
   * both this app and the Expo app bundle it from the same files. A build step
   * between them would only introduce a stale artefact to forget to rebuild.
   */
  transpilePackages: ["@nbss/shared"],

  /**
   * `next build` and `next dev` share .next by default, so running a build
   * while the dev server is up deletes the manifests it is holding open — the
   * dev server then throws a stream of ENOENT for _buildManifest.js.tmp and
   * serves 500s until it is restarted and .next is cleared.
   *
   * Setting NEXT_DIST_DIR sends a build somewhere else, so the two can run at
   * once. `pnpm build:safe` uses it.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            /**
             * `geolocation=(self)` — not `()`.
             *
             * A guard's check-in is refused unless their device reports a
             * position inside the site's fence, so the whole attendance system
             * depends on this permission. It stays scoped to same-origin:
             * nothing embedded in the page can ask for a position, only the
             * console itself.
             *
             * `camera=(self)` for the same reason — the optional check-in
             * selfie is what makes a spoofed GPS reading expensive to fake.
             */
            value: "camera=(self), microphone=(), geolocation=(self), interest-cohort=()",
          },
        ],
      },
      {
        /**
         * The service worker, never cached.
         *
         * A cached `sw.js` is how a PWA gets permanently stuck on an old build: the
         * browser checks for an update by fetching this file, and if a CDN hands back
         * yesterday's copy there is no update to find. `no-store` is the one header that
         * matters on a PWA.
         */
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // Font files are content-hashed by name and never change in place.
        source: "/fonts/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        /**
         * Logo marks and photographs. Deliberately *not* `immutable`: unlike the
         * fonts these live at stable, unhashed names, so pinning them for a year
         * would mean a visitor who has seen the site keeps the old artwork until
         * their cache evicts. A day of hard caching plus a week of
         * stale-while-revalidate gives repeat visits an instant render while
         * still picking up new artwork on the next background fetch.
         */
        source: "/:dir(logo|img|video)/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        // Favicons and touch icons, same reasoning — browsers refetch these
        // rarely enough that a stale pin is very visible.
        source: "/:file(favicon.ico|apple-touch-icon.png|icon-\\d+.png)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
