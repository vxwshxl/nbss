import type { Metadata } from "next";

import { LiveView } from "@/components/console/views/live-view";

export const metadata: Metadata = { title: "Live tracking" };
export const dynamic = "force-dynamic";

export default async function LivePage() {
  return <LiveView />;
}
