"use client";

import { useOptimistic, useTransition } from "react";
import { FlaskConical, Radio } from "lucide-react";

import { setDataMode } from "@/lib/mode/actions";
import type { DataMode } from "@/lib/mode/shared";
import { cn } from "@/lib/utils";

/**
 * The header's Test / Live switch, as payment dashboards have it (and as schoolerp's
 * console does). Developers only. Test shows the test guards, sites and records; Live
 * the real ones. The whole page reloads on a switch, so every list, map and live feed
 * starts again on the chosen side.
 */
export function ModeToggle({ mode, labels = false }: { mode: DataMode; /** Always show the words (the menu drawer has room). */ labels?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(mode);

  function pick(next: DataMode) {
    if (next === shown) return;
    startTransition(async () => {
      setShown(next);
      await setDataMode(next);
      window.location.reload();
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Data mode"
      className={cn(
        "flex h-9 items-center gap-0.5 rounded-full border bg-card p-0.5 text-xs font-semibold shadow-xs transition-colors",
        shown === "test" ? "border-amber-300" : "border-border",
        pending && "opacity-80",
      )}
    >
      {(["test", "live"] as const).map((m) => {
        const on = shown === m;
        const Icon = m === "test" ? FlaskConical : Radio;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => pick(m)}
            className={cn(
              "press flex h-full items-center gap-1.5 rounded-full px-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
              on && m === "test" && "bg-amber-400 font-extrabold text-[#4a3200] shadow-[0_2px_0_#b7791f]",
              on && m === "live" && "bg-[#009164] font-extrabold text-white shadow-[0_2px_0_#006b4a]",
              !on && "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            <span className={labels ? undefined : "max-sm:hidden"}>{m === "test" ? "Test" : "Live"}</span>
          </button>
        );
      })}
    </div>
  );
}
