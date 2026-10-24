import type { Metadata } from "next";

import { ReplacementsView } from "@/components/console/views/replacements-view";

export const metadata: Metadata = { title: "Replacements" };
export const dynamic = "force-dynamic";

export default async function ReplacementsPage() {
  return <ReplacementsView />;
}
