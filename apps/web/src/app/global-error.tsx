"use client";

import { ErrorScreen } from "@/components/errors/error-screen";
import { RetryButton } from "@/components/errors/retry-button";

import "./globals.css";

// Replaces the root layout when it crashes, so it brings its own document and styles.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <title>Something went wrong · NBSS</title>
        <ErrorScreen code={500} action={<RetryButton onRetry={reset} />} />
      </body>
    </html>
  );
}
