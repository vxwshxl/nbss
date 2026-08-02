import { NextResponse, type NextRequest } from "next/server";

/**
 * HTTP basic auth in front of the operations pages.
 *
 * The comparison is constant-time so the credentials cannot be probed by
 * timing, and the middleware runs on the edge runtime, so it must not import
 * anything from `src/lib/store` (Node `fs`).
 */

const USER = process.env.NBSS_ADMIN_USER ?? "admin";
const PASS = process.env.NBSS_ADMIN_PASS ?? "nbss-kokrajhar";

/** Length-independent equality — never bails out early on a mismatch. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  // Fold the length difference into the result rather than returning early.
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

export function middleware(request: NextRequest) {
  const header = request.headers.get("authorization");

  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    const user = decoded.slice(0, separator);
    const pass = decoded.slice(separator + 1);

    // Both comparisons always run, so a correct username cannot be detected
    // from how long the request takes.
    const userOk = safeEqual(user, USER);
    const passOk = safeEqual(pass, PASS);
    if (userOk && passOk) return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="NBSS operations", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export const config = {
  matcher: ["/admin/:path*"],
};
