"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { motion } from "framer-motion";
import { useSelfHeal } from "@/components/errors/use-self-heal";

// Errors inside the console keep the shell (sidebar, top bar) and show a card where the page was,
// but only after quietly retrying: most are a deploy or a restart passing (use-self-heal).
export default function ConsoleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const trying = useSelfHeal(error, reset);
  if (trying) {
    return (
      <div className="grid min-h-[60svh] place-items-center" role="status" aria-live="polite">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <RotateCw className="size-4 animate-spin" /> Loading…
        </span>
      </div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid min-h-[60svh] place-items-center">
      <div className="max-w-md rounded-3xl border-2 border-border bg-elevated p-8 text-center shadow-e1">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-danger/10 text-danger">
          <TriangleAlert className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em]">This page did not load.</h1>
        <p className="mt-2 text-secondary-fg">Something went wrong while loading it. Your records are safe. Try again in a moment.</p>
        {error.digest && <p className="mt-3 font-mono text-xs text-muted-foreground">Ref {error.digest}</p>}
        <button type="button" onClick={reset} className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-ink-fg">
          <RotateCw className="size-4" /> Try again
        </button>
      </div>
    </motion.div>
  );
}
