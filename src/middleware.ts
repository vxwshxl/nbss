import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * The gate in front of the operations pages.
 *
 * It no longer answers with `401 WWW-Authenticate`, because that hands the
 * visitor to the browser's built-in credential dialog. Instead an unsigned
 * request is sent to `/admin/login`, which renders the site's own sign-in
 * popup; the credential check itself lives in the server action behind that
 * form. See `src/lib/session.ts` for why the crypto is Web Crypto.
 */

const LOGIN_PATH = "/admin/login";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === LOGIN_PATH) {
    // Nothing to ask someone who is already through the door.
    return signedIn ? NextResponse.redirect(new URL("/admin", request.url)) : NextResponse.next();
  }

  if (signedIn) return NextResponse.next();

  const url = new URL(LOGIN_PATH, request.url);
  // `/admin` is where sign-in lands anyway, so only a deeper target is worth
  // carrying. The action re-validates this before it redirects to it.
  if (pathname !== "/admin" || search) url.searchParams.set("from", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
