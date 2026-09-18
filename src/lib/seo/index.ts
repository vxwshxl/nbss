/**
 * The public origin of the site, resolved once and shared by everything that
 * has to emit an absolute URL — metadata, canonicals, Open Graph, JSON-LD,
 * the sitemap and robots.txt.
 *
 * This used to be an inline `process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"`
 * repeated in three files. When the variable is not set on the host — which is
 * the default on Vercel — every one of those falls back to localhost, and a
 * crawler asked to fetch the preview image goes looking for it on its own
 * machine. That is why link previews rendered a title and description but no
 * banner.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_BASE_URL — set this explicitly once a custom domain exists.
 *   2. VERCEL_PROJECT_PRODUCTION_URL — the stable production hostname, so
 *      previews built from a branch still canonicalise to production.
 *   3. VERCEL_URL — the per-deployment hostname, for preview deployments.
 *   4. localhost, which is only ever correct in development.
 */
function resolveBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (explicit) return stripTrailingSlash(explicit);

  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (host) return stripTrailingSlash(`https://${host.replace(/^https?:\/\//, "")}`);

  return "http://localhost:3000";
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export const baseUrl = resolveBaseUrl();

/** Absolute URL for a site-relative path, for JSON-LD and other raw strings. */
export function absoluteUrl(path = "/"): string {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Canonical link for a route. Next resolves the relative path against
 * `metadataBase`, so pages only ever name their own path.
 */
export function canonical(path = "/") {
  return { canonical: path };
}
