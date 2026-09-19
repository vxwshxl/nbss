import {
  Banknote,
  Layers,
  Radio,
  ShieldCheck,
  Target,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";
import { pillars } from "@/content/site";
import { TONES, type Tone } from "@/lib/ui/tones";
import { cn } from "@/lib/utils";

/**
 * The content file names its icons as strings, because it is data and should
 * not import a component library. This is where those names become glyphs.
 * A name with no entry falls back rather than throwing — a typo in the copy
 * should not take the page down.
 */
const ICONS: Record<string, LucideIcon> = {
  drill: Target,
  "shield-check": ShieldCheck,
  radio: Radio,
  layers: Layers,
  rupee: Banknote,
  "user-check": UserCheck,
};

/** One tone each, in a fixed order, so the six read as a set rather than a mess. */
const TONE_ORDER: Tone[] = ["emerald", "indigo", "amber", "sky", "violet", "teal"];

export function PillarGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pillars.map((pillar, i) => {
        const Icon = ICONS[pillar.icon] ?? ShieldCheck;
        const tone = TONES[TONE_ORDER[i % TONE_ORDER.length] ?? "slate"];
        return (
          <Reveal key={pillar.index} delay={Math.min(i, 6) * 60}>
            <article className="flex h-full flex-col rounded-2xl border border-app-line-soft bg-card p-6 shadow-card">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    tone.chip,
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.9} />
                </span>
                <span className="font-mono text-xs font-bold tracking-[0.18em] text-muted-foreground">
                  {pillar.index}
                </span>
              </div>
              <h3 className="mt-5 font-display text-lg leading-snug font-bold tracking-tight">
                {pillar.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                {pillar.body}
              </p>
            </article>
          </Reveal>
        );
      })}
    </div>
  );
}
