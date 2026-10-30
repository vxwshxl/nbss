import { NextResponse, type NextRequest } from "next/server";

import { isBot, pageName, pageViews, trackVisit } from "@/lib/visits";

/**
 * POST { path, first }: a page view from a browser (components/page-tracker.tsx), answered
 * with the page-view count so the footer shows this visit too. Bot user agents are skipped
 * here, since the middleware already counted them. GET: the page-view count.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { path?: unknown; first?: unknown };
  const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path : null;
  if (!path) return new NextResponse(null, { status: 400 });
  if (isBot(req.headers.get("user-agent"))) return new NextResponse(null, { status: 204 });
  const views = await trackVisit(pageName(path), false, body.first === true);
  return NextResponse.json({ views }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return NextResponse.json({ views: await pageViews() }, { headers: { "Cache-Control": "no-store" } });
}
