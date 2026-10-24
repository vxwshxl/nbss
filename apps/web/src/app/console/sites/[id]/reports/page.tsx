import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReportsView } from "@/components/console/views/reports-view";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

/** Reports, for this site alone: the same page as across all sites, filtered. */
export default async function SiteReportsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <ReportsView searchParams={searchParams} siteId={id.toLowerCase()} />;
}
