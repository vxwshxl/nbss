import type { Metadata } from "next";

import { ReportsView } from "@/components/console/views/reports-view";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  return <ReportsView searchParams={searchParams} />;
}
