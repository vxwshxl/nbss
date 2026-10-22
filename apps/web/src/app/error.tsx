"use client";

import { useEffect } from "react";

import { ErrorScreen } from "@/components/errors/error-screen";
import { RetryButton } from "@/components/errors/retry-button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return <ErrorScreen code={500} action={<RetryButton onRetry={reset} />} />;
}
