import type { Metadata } from "next";

import { RoutesView } from "@/components/console/views/routes-view";

export const metadata: Metadata = { title: "Route history" };
export const dynamic = "force-dynamic";

export default async function RoutesPage({ searchParams }: { searchParams: Promise<{ attendance?: string; guard?: string; date?: string }> }) {
  return <RoutesView searchParams={searchParams} />;
}
