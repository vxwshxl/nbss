import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/auth";
import {
  REFUSED,
  THROTTLED,
  clearFailures,
  isThrottled,
  passwordSignIn,
  recordFailure,
  sendSignInCode,
  statelessClient,
  verifySignInCode,
} from "@/lib/sign-in";

/**
 * The app's side of the one sign-in door (the website uses the server action
 * in app/login). Same rules, from lib/sign-in; the only difference is the
 * ending — instead of setting a cookie, the session's tokens are handed back
 * and the phone keeps them in its own encrypted store.
 *
 *   POST /api/auth/code      { identifier }                 → { ok: true }
 *   POST /api/auth/verify    { identifier, code }           → { session }
 *   POST /api/auth/password  { identifier, secret }         → { session }
 */
export const dynamic = "force-dynamic";

const Body = z.object({
  identifier: z.string().trim().min(1).max(254),
  code: z.string().max(12).optional(),
  secret: z.string().max(200).optional(),
});

const NO_STORE = { "Cache-Control": "no-store, private" };

export async function POST(request: NextRequest, { params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (!["code", "verify", "password"].includes(step)) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: NO_STORE });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your email or employee code." }, { status: 400, headers: NO_STORE });
  }

  const { identifier, code = "", secret = "" } = parsed.data;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const idKey = `id:${identifier.toLowerCase()}`;

  if (isThrottled(ip, idKey)) {
    return NextResponse.json({ error: THROTTLED }, { status: 429, headers: NO_STORE });
  }

  const client = statelessClient();

  if (step === "code") {
    await sendSignInCode(identifier, client);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  const result =
    step === "verify"
      ? await verifySignInCode(identifier, code, client)
      : await passwordSignIn(identifier, secret, client);

  if (!result.ok) {
    recordFailure(ip, idKey);
    return NextResponse.json(
      { error: step === "verify" ? result.error : REFUSED },
      { status: 401, headers: NO_STORE },
    );
  }

  const { data } = await client.auth.getSession();
  if (!data.session) {
    return NextResponse.json({ error: REFUSED }, { status: 401, headers: NO_STORE });
  }

  clearFailures(ip, idKey);
  await audit({
    actor: null,
    action: "sign_in",
    entity: "profiles",
    entityId: result.userId,
    detail: { method: step === "verify" ? "email_code" : "password", client: "mobile" },
    ip,
  });

  return NextResponse.json(
    {
      role: result.role,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    },
    { headers: NO_STORE },
  );
}
