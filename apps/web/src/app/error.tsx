"use client";

import { ErrorScreen } from "@/components/errors/error-screen";
import { RetryButton } from "@/components/errors/retry-button";
import { useSelfHeal } from "@/components/errors/use-self-heal";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Retried quietly first: most errors are a deploy or a restart passing (use-self-heal).
  const trying = useSelfHeal(error, reset);
  if (trying) return <div className="min-h-[60svh]" role="status" aria-label="Loading" />;
  return <ErrorScreen code={500} action={<RetryButton onRetry={reset} />} />;
}
