import type { MetadataRoute } from "next";

import { vacancies } from "@/content/gallery";
import { pages } from "@/content/pages";
import { services } from "@/content/services";
import { baseUrl as BASE } from "@/lib/seo";

/**
 * Priorities by route. Anything in `pages` without an entry here falls back to
 * the default — so the list of URLs is driven by `src/content/pages.ts`, which
 * is also what site search indexes. When a route is added or removed, both the
 * sitemap and the search box follow from the same edit, instead of the sitemap
 * quietly advertising a page that no longer exists.
 */
const PRIORITY: Record<string, number> = {
  "/": 1,
  "/services": 0.9,
  "/about": 0.8,
  "/contact": 0.8,
  "/careers": 0.8,
  "/training": 0.7,
  "/gallery": 0.6,
};

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    ...pages.map((p) => ({
      url: `${BASE}${p.href}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: PRIORITY[p.href] ?? 0.6,
    })),
    ...services.map((s) => ({
      url: `${BASE}/services/${s.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...vacancies.map((v) => ({
      url: `${BASE}/careers/${v.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
