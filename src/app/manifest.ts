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
    // Splash sits on the page's own paper; the tint matches the topbar, which
    // is the strip the Android status bar actually butts up against.
    background_color: "#FFFFFF",
    theme_color: "#E9F4ED",
    lang: "en-IN",
    categories: ["business", "security"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
