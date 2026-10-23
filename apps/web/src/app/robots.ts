import type { MetadataRoute } from "next";

import { baseUrl } from "@/lib/seo";

/** The operations console, sign-in and the API carry nothing indexable. */
const PRIVATE = ["/admin", "/console", "/login", "/register", "/api/"];

/**
 * Search engines and AI answer engines are welcome on the public pages
 * (GEO/AEO). The AI crawlers are named one by one rather than left to `*`:
 * several of them read a missing named group as "not invited", and the whole
 * point of `/llms.txt` and the JSON-LD is to be quoted by them.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow: PRIVATE })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
