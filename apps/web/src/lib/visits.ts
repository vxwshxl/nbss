/**
 * Page impressions (migration 0071), as okhrang counts them: per page per day, real users
 * and bots apart. Browsers are counted from the page itself (components/page-tracker.tsx →
 * /api/track), which never fires on a prefetch; bots, which mostly don't run scripts, are
 * counted by the middleware. Edge-safe: a plain fetch to PostgREST with the secret key,
 * no supabase-js, and nothing here throws when the env is missing.
 */

const BOT = /bot|crawl|spider|slurp|scrap|curl|wget|python|httpx|axios|node-fetch|go-http|okhttp|java\/|libwww|httpclient|headless|phantom|puppeteer|playwright|lighthouse|pagespeed|facebookexternalhit|whatsapp|telegram|slack|discord|embedly|preview|monitor|uptime|pingdom|semrush|ahrefs|mj12|dotbot|petal|bytespider|gptbot|chatgpt|claude|anthropic|perplexity|ccbot|cohere|google-extended|applebot|yandex|baidu|duckduck|bingpreview|^$/i;

export const isBot = (ua: string | null | undefined) => BOT.test((ua ?? "").trim());

const ID = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+|[A-Z]{1,5}-?\d{3,})$/i;

/** "/console/sites/3f2c…" → "/console/sites/:id", so a page is one row however many records it shows. */
export function pageName(pathname: string): string {
  const parts = pathname
    .split("/")
    .filter(Boolean)
    .map((p) => {
      try {
        return ID.test(p) ? ":id" : decodeURIComponent(p).slice(0, 60);
      } catch {
        return p.slice(0, 60);
      }
    });
  return `/${parts.join("/")}`.slice(0, 200);
}

/** Counts one view; returns the page-view count (null when the database isn't reachable). */
export async function trackVisit(page: string, bot: boolean, newVisitor = false): Promise<number | null> {
  const key = process.env.SUPABASE_SECRET_KEY;
  const url = process.env.SUPABASE_INTERNAL_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/track_visit`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_page: page, p_is_bot: bot, p_new_visitor: newVisitor }),
      cache: "no-store",
    });
    return res.ok ? Number(await res.json()) : null;
  } catch {
    return null;
  }
}

/** The website's page-view count (every real view of every page), for the footer. */
export async function pageViews(): Promise<number> {
  const key = process.env.SUPABASE_SECRET_KEY;
  const url = process.env.SUPABASE_INTERNAL_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return 0;
  try {
    const res = await fetch(`${url}/rest/v1/site_counters?key=eq.views&select=value`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    const rows = res.ok ? ((await res.json()) as { value: number }[]) : [];
    return Number(rows[0]?.value ?? 0);
  } catch {
    return 0;
  }
}
