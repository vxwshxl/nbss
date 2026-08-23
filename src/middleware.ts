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

const LOGIN_PATH = "/console/login";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Carries any cookies Supabase rotates during the refresh below.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
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

  // getUser() rather than getSession(): it revalidates the token with Supabase
  // instead of trusting a cookie the browser controls.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (pathname === LOGIN_PATH) {
    // Nothing to ask someone who is already through the door. Where they land
    // depends on their role, which the page itself resolves.
    return user ? NextResponse.redirect(new URL("/console", request.url)) : response;
  }

  if (user) return response;

  const url = new URL(LOGIN_PATH, request.url);
  if (pathname !== "/console" || search) url.searchParams.set("from", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/console/:path*"],
};
