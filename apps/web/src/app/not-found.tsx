import type { Metadata } from "next";

import { ErrorScreen } from "@/components/errors/error-screen";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return <ErrorScreen code={404} />;
}
