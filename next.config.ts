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

const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "font-src 'self'",
  "connect-src 'self'" + (isDev ? " ws: wss:" : ""),
  "form-action 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

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
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        // Font files are content-hashed by name and never change in place.
        source: "/fonts/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
