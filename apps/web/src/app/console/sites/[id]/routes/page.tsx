import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RoutesView } from "@/components/console/views/routes-view";

export const metadata: Metadata = { title: "Route history" };
export const dynamic = "force-dynamic";

/** Route history, for this site alone: the same page as across all sites, filtered. */
export default async function SiteRoutesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ attendance?: string; guard?: string; date?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <RoutesView searchParams={searchParams} siteId={id.toLowerCase()} />;
}
