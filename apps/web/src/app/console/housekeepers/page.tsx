import type { Metadata } from "next";

import { PeopleView } from "@/components/console/views/people-view";

export const metadata: Metadata = { title: "Housekeepers" };
export const dynamic = "force-dynamic";

export default async function HousekeepersPage() {
  return <PeopleView kind="housekeeping" />;
}
