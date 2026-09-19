import { NextResponse } from "next/server";

import { currentProfile, homeFor } from "@/lib/auth";

/**
 * "Is whoever is reading the public site already signed in?"
 *
 * The marketing pages are statically rendered, which is most of why they are
 * fast — reading the session in their layout would make every one of them
 * dynamic to change one word in the header for the handful of people who work
 * here. So the header asks this instead, and only when the browser is holding
 * a Supabase cookie at all: an anonymous visitor never makes the request.
 *
 * It deliberately reports the landing path and nothing else. No name, no role,
 * no employee code — a public endpoint should not describe a person, and the
 * console itself will re-check the role before rendering anything.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await currentProfile();

  return NextResponse.json(
    profile ? { signedIn: true, home: homeFor(profile.role) } : { signedIn: false },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
