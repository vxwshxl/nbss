import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

/** A year — the same as SESSION_MAX_AGE in lib/supabase/env.ts. */
const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Carries any cookies Supabase rotates during the refresh below.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: { maxAge: SESSION_MAX_AGE, sameSite: "lax", path: "/" },
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
    return NextResponse.redirect(new URL(`${LOGIN_PATH}${search}`, request.url));
  }

  if (user) return response;

  const url = new URL(LOGIN_PATH, request.url);
  if (pathname !== "/console" || search) url.searchParams.set("from", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/console/:path*", "/login", "/register"],
};
