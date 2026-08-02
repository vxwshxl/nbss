import type { MetadataRoute } from "next";

import { services } from "@/content/services";
import { vacancies } from "@/content/gallery";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const pages = [
    { path: "/", priority: 1 },
    { path: "/services", priority: 0.9 },
    { path: "/about", priority: 0.8 },
    { path: "/sectors", priority: 0.8 },
    { path: "/contact", priority: 0.8 },
    { path: "/careers", priority: 0.8 },
    { path: "/training", priority: 0.7 },
    { path: "/clients", priority: 0.7 },
    { path: "/gallery", priority: 0.6 },
  ];

  return [
    ...pages.map((p) => ({
      url: `${BASE}${p.path}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: p.priority,
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
