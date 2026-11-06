import type { Metadata } from "next";

import { PeopleView } from "@/components/console/views/people-view";

export const metadata: Metadata = { title: "Guards" };
export const dynamic = "force-dynamic";

export default async function GuardsPage() {
  return <PeopleView kind="guard" />;
}
