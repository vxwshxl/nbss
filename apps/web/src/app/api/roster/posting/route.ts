import { NextResponse } from "next/server";
import { z } from "zod";

import { roleAllowed } from "@nbss/shared/identity";

import { endPosting, savePosting } from "@/app/console/roster/actions";
import { currentSession } from "@/lib/auth";

/**
 * Posting from the phone app: put a guard, housekeeper or supervisor on a site, change
 * their hours, days and breaks, or take them off it.
 *
 * The app has no cookies, so it sends its Supabase session as a bearer token, which
 * the session reads as it does a cookie. The work is the console's own `savePosting`
 * and `endPosting`, so the app and the website follow the same rules: who may post,
 * one person in one place at a time, breaks that fit, the audit row, and today's
 * duty following new hours. Nobody is created here; that stays on the website.
 */
export const dynamic = "force-dynamic";

const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const Save = z.object({
  guardId: z.string().uuid(),
  siteId: z.string().uuid(),
  starts: Time,
  ends: Time,
  days: z.array(z.number().int().min(1).max(7)).max(7),
  breaks: z.array(z.object({ starts: Time, ends: Time })).max(6).default([]),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(366).nullable().optional(),
  postingId: z.string().uuid().nullable().optional(),
});
const End = z.object({ postingId: z.string().uuid() });

async function staff(): Promise<NextResponse | null> {
  const session = await currentSession();
  if (!session) return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  if (!roleAllowed(session.profile.role, ["admin", "supervisor"])) {
    return NextResponse.json({ ok: false, error: "Only an administrator or a supervisor can post people." }, { status: 403 });
  }
  return null;
}

export async function POST(req: Request) {
  const refused = await staff();
  if (refused) return refused;
  const body = Save.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, error: "Those details are not complete." }, { status: 400 });
  return NextResponse.json(await savePosting(body.data));
}

export async function DELETE(req: Request) {
  const refused = await staff();
  if (refused) return refused;
  const body = End.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, error: "Which post?" }, { status: 400 });
  return NextResponse.json(await endPosting(body.data.postingId));
}
