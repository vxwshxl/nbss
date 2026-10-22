"use client";

import { RotateCw } from "lucide-react";

export function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium text-ink-fg transition-transform hover:scale-[1.03]"
    >
      <RotateCw className="size-4" /> Try again
    </button>
  );
}
