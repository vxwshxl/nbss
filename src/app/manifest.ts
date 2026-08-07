import type { MetadataRoute } from "next";

import { site } from "@/content/site";

/**
 * Web app manifest, so an Android "add to home screen" gets the badge and the
 * site's own colours instead of a screenshot thumbnail and white chrome.
 *
 * The icons are marked `maskable` as well as `any`: Android crops home-screen
 * icons to the launcher's shape, and the badge is generated onto a square
 * transparent canvas with margin, so it survives the crop without losing the
 * shield's points.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.shortName,
    description: site.descriptor,
    start_url: "/",
    display: "standalone",
    background_color: "#0A100D",
    theme_color: "#0A100D",
    lang: "en-IN",
    categories: ["business", "security"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
