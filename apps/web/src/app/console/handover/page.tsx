import type { Metadata } from "next";

import { HandoverView } from "@/components/console/views/handover-view";

export const metadata: Metadata = { title: "Handover notes" };
export const dynamic = "force-dynamic";

export default async function HandoverPage({ searchParams }: { searchParams: Promise<{ period?: string; at?: string }> }) {
  return <HandoverView searchParams={searchParams} />;
}
