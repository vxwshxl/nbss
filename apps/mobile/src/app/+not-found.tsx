import { Stack } from "expo-router";

import { ErrorScreen } from "@/components/error-screen";

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ErrorScreen code={404} />
    </>
  );
}
