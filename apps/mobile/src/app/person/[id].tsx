import { useLocalSearchParams } from "expo-router";

import { PersonPage } from "@/screens/person";

export default function PersonRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PersonPage id={id} />;
}
