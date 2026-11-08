import { useLocalSearchParams } from "expo-router";

import { PostingPage } from "@/screens/posting";

export default function PostingRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PostingPage id={id} />;
}
