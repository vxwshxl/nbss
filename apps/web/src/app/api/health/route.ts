import { NextResponse } from "next/server";

import { countSubmissions } from "@/lib/store";

/** Liveness probe for a load balancer or uptime monitor. */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const counts = await countSubmissions();
    return NextResponse.json({
      status: "ok",
      service: "nbss-website",
      submissions: counts.total,
    });
  } catch {
    // The store is the only thing that can fail here — say so plainly.
    return NextResponse.json({ status: "degraded", service: "nbss-website" }, { status: 503 });
  }
}
