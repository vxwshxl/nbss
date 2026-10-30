import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { isBot, pageName, trackVisit } from "@/lib/visits";

/**
 * The gate in front of the console.
 *
 * Two jobs, and the second is the subtle one:
 *
 *   1. Send an unauthenticated request to the sign-in page.
 *   2. Refresh the Supabase session on every request. Access tokens are
 *      short-lived, and a Server Component cannot write cookies — so if the
 *      refresh did not happen here, a guard halfway through a night shift
 *      would be signed out mid-shift with no way to renew.
 *
 * Roles are deliberately NOT checked here. The middleware only asks "is this
 * person signed in"; which pages each role may see is decided by `requireRole`
 * in the pages themselves, close to the data they protect, where it cannot
 * drift out of step with a route rename.
 */

const LOGIN_PATH = "/login";
const GATED = /^\/(?:console(?:\/|$)|login$|register$)/;

/** A year — the same as SESSION_MAX_AGE in lib/supabase/env.ts. */
const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The address the browser used. Behind nginx the server listens on
 * 127.0.0.1:3040, and `request.url` carries that, so a redirect built from it
 * sent signed-out visitors to https://localhost:3040/login. nginx forwards the
 * real host and scheme, and those are what a redirect has to point at.
 */
function origin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return request.url;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname, search } = request.nextUrl;

  // Bots rarely run scripts, so their page views are counted here (browsers count from the
  // page, components/page-tracker.tsx). In the background: the response never waits on it.
  if (request.method === "GET" && !request.headers.has("rsc") && isBot(request.headers.get("user-agent"))) {
    event.waitUntil(trackVisit(pageName(pathname), true));
  }
  // Every page passes through for that count; only the console and sign-in need the session.
  if (!GATED.test(pathname)) return NextResponse.next();

  // Carries any cookies Supabase rotates during the refresh below.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    // The server's own route to the database when it has one (see lib/supabase/env.ts),
    // reading the cookie the browser wrote under the public URL's name.
    process.env.SUPABASE_INTERNAL_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: { name: `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0]}-auth-token`, maxAge: SESSION_MAX_AGE, sameSite: "lax", path: "/" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(list) {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // getClaims() rather than getSession(): it verifies the token's signature
  // (ES256, against the project's cached public key) instead of trusting a
  // cookie the browser controls — and, unlike getUser(), it does so without a
  // network round trip, which every console navigation used to wait on. It
  // still refreshes an expired session and rotates the cookies below.
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims?.sub ? { id: claims.claims.sub } : null;

  // The sign-in pages decide for themselves whether to send someone onward:
  // they check for an *active profile*, not just an auth user. Redirecting here
  // on the auth user alone looped forever for a deactivated account — the
  // console bounced it to /login for having no profile, and this bounced it
  // straight back for having a session.
  if (pathname === LOGIN_PATH || pathname === "/register") {
    return response;
  }

  // The old sign-in address. Redirected here rather than by its page: pages
  // under /console stream behind a loading skeleton, and a redirect thrown
  // mid-stream reaches the browser as a 200 plus a client-side hop, which old
  // bookmarks and the app should not have to follow.
  if (pathname === "/console/login") {
    return NextResponse.redirect(new URL(`${LOGIN_PATH}${search}`, origin(request)));
  }

  if (user) return response;

  const url = new URL(LOGIN_PATH, origin(request));
  if (pathname !== "/console" || search) url.searchParams.set("from", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Every page (for the bot count above), never API routes, Next's own files or static files.
  matcher: ["/((?!api|_next/static|_next/image|og|android|favicon|.*\\.[a-z0-9]+$).*)"],
};
