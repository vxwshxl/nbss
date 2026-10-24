import { useLocalSearchParams } from "expo-router";

import { SosMap } from "@/screens/sos-map";

export default function AlertsRoute() {
  const { failed } = useLocalSearchParams<{ failed?: string }>();
  return <SosMap failed={failed} />;
}
