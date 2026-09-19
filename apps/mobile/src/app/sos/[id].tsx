import { useLocalSearchParams } from "expo-router";

import { SosAlarm } from "@/screens/sos-alarm";

export default function SosRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SosAlarm alertId={id} />;
}
