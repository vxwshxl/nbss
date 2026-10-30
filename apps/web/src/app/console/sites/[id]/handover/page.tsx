import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HandoverView } from "@/components/console/views/handover-view";

export const metadata: Metadata = { title: "Handover notes" };
export const dynamic = "force-dynamic";

/** Handover notes, for this site alone: the same page as across all sites, filtered. */
export default async function SiteHandoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; at?: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <HandoverView siteId={id.toLowerCase()} searchParams={searchParams} />;
}
