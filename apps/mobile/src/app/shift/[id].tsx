import { useLocalSearchParams } from "expo-router";

import { DutyDetail } from "@/screens/duty-detail";

export default function ShiftRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DutyDetail id={id} />;
}
