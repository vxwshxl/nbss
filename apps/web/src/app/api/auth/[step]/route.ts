import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/auth";
import {
  REFUSED,
  THROTTLED,
  cleanMobile,
  clearFailures,
  isThrottled,
  recordFailure,
  signInWorker,
  statelessClient,
} from "@/lib/sign-in";

/**
 * The app's side of the one sign-in door (the website uses the server action
 * in app/login). Same rules, from lib/sign-in; the only difference is the
 * ending — instead of setting a cookie, the session's tokens are handed back
 * and the phone keeps them in its own encrypted store.
 *
 *   POST /api/auth/worker  { name, mobile }  → { session }
 *
 * The employee-code, emailed-code and PIN steps an older app still calls
 * ("code", "verify", "password") answer with a message to update the app.
 */
export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().max(120).default(""),
  mobile: z.string().max(20).default(""),
});

const NO_STORE = { "Cache-Control": "no-store, private" };

const OUTDATED =
  "Sign-in has changed: it is now your name and mobile number. Install the latest NBSS app from the office to sign in.";

export async function POST(request: NextRequest, { params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (step === "code" || step === "verify" || step === "password") {
    return NextResponse.json({ error: OUTDATED }, { status: 410, headers: NO_STORE });
  }
  if (step !== "worker") {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: NO_STORE });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  const name = parsed.success ? parsed.data.name : "";
  const mobile = parsed.success ? cleanMobile(parsed.data.mobile) : "";
  if (!name.trim()) return NextResponse.json({ error: "Enter your name." }, { status: 400, headers: NO_STORE });
  if (!mobile) {
    return NextResponse.json({ error: "Enter your 10-digit mobile number." }, { status: 400, headers: NO_STORE });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const idKey = `id:${mobile}`;
  if (isThrottled(ip, idKey)) {
    return NextResponse.json({ error: THROTTLED }, { status: 429, headers: NO_STORE });
  }

  const client = statelessClient();
  const result = await signInWorker(name, mobile, client);

  if (!result.ok) {
    recordFailure(ip, idKey);
    return NextResponse.json({ error: result.error }, { status: 401, headers: NO_STORE });
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
    detail: { method: "name_mobile", client: "mobile" },
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
