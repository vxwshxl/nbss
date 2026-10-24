import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LiveView } from "@/components/console/views/live-view";

export const metadata: Metadata = { title: "Live tracking" };
export const dynamic = "force-dynamic";

/** Live tracking, for this site alone: the same page as across all sites, filtered. */
export default async function SiteLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <LiveView siteId={id.toLowerCase()} />;
}
