import type { Metadata } from "next";

import { PeopleView } from "@/components/console/views/people-view";

export const metadata: Metadata = { title: "Supervisors" };
export const dynamic = "force-dynamic";

export default async function SupervisorsPage() {
  return <PeopleView kind="supervisor" />;
}
