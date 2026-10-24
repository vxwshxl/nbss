import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReplacementsView } from "@/components/console/views/replacements-view";

export const metadata: Metadata = { title: "Replacements" };
export const dynamic = "force-dynamic";

/** Replacements, for this site alone: the same page as across all sites, filtered. */
export default async function SiteReplacementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <ReplacementsView siteId={id.toLowerCase()} />;
}
