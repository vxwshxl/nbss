import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/auth";
import { finish, landingFor } from "@/lib/sign-in";
import { supabaseServer } from "@/lib/supabase/server";

import { safeFrom } from "../../login/state";

/**
 * Where Google sends people back, by way of Supabase Auth.
 *
 * The button on /login starts a PKCE flow in the browser; Supabase talks to
 * Google, then redirects here with a one-time `code`. Swapping it for a session
 * writes the session cookies, and from there it is the same door as the
 * password: an active profile decides where they land, and no profile (or a
 * deactivated one) is signed straight back out.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const from = safeFrom(params.get("from"));
  const origin = publicOrigin(request);

  const back = (error: string) => {
    const url = new URL("/login", origin);
    url.searchParams.set("error", error);
    if (from) url.searchParams.set("from", from);
    return NextResponse.redirect(url);
  };

  const code = params.get("code");
  if (!code) return back("google");

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return back("google");

  const result = await finish(supabase, data.user.id);
  if (!result.ok) return back("refused");

  await audit({
    actor: null,
    action: "sign_in",
    entity: "profiles",
    entityId: result.userId,
    detail: { method: "google" },
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local",
  });

  return NextResponse.redirect(new URL(await landingFor(result.role, result.userId, from), origin));
}

/** Behind nginx `request.url` is the upstream address; the browser came in on the forwarded one. */
function publicOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host");
  if (!host) return request.nextUrl.origin;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
