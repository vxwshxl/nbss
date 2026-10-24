import type { Metadata } from "next";

import { DevicesView } from "@/components/console/views/devices-view";

export const metadata: Metadata = { title: "Devices" };
export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  return <DevicesView />;
}
