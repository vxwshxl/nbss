import type { NextRequest } from "next/server";

/**
 * Hands a Google sign-in back to the app running in Expo Go.
 *
 * Supabase Auth only returns to an address on its allow list, and it refuses any whose
 * host is an IP address, whatever the list says. Expo Go's own link always is one
 * (exp://192.168.1.20:8081/--/auth/callback), so Supabase fell back to the website and
 * the person was left signed in to a browser tab instead of the app. Supabase returns
 * here instead, on the site's own host, and this sends the one-time code straight on to
 * the Expo Go link it was given.
 *
 * Only exp:// links, so this can never be used to bounce someone to another website.
 * The installed app returns to nbss:// directly and never comes through here.
 */
export function GET(request: NextRequest) {
  const params = new URLSearchParams(request.nextUrl.searchParams);
  const to = params.get("to") ?? "";
  params.delete("to");

  if (!/^exp:\/\/[^/?#]+\/--\/auth\/callback$/.test(to)) {
    return new Response("Not a sign-in link for the app.", { status: 400 });
  }

  const query = params.toString();
  return new Response(null, { status: 302, headers: { Location: query ? `${to}?${query}` : to, "Cache-Control": "no-store" } });
}
