import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DevicesView } from "@/components/console/views/devices-view";

export const metadata: Metadata = { title: "Devices" };
export const dynamic = "force-dynamic";

/** Devices, for this site alone: the same page as across all sites, filtered. */
export default async function SiteDevicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <DevicesView siteId={id.toLowerCase()} />;
}
