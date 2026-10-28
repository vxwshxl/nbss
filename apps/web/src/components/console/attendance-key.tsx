import type { Outcome } from "@/lib/attendance-register";
import { cn } from "@/lib/utils";

/** One letter and one colour per outcome: the key to the month grid and a guard's calendar. */
export const OUTCOME: Record<Outcome, { letter: string; label: string; cell: string }> = {
  present: { letter: "P", label: "Present", cell: "bg-emerald-500 text-white" },
  late: { letter: "L", label: "Late", cell: "bg-amber-400 text-amber-950" },
  absent: { letter: "A", label: "Absent", cell: "bg-rose-500 text-white" },
  replaced: { letter: "R", label: "Replaced", cell: "bg-slate-300 text-slate-700" },
  on_duty: { letter: "●", label: "On duty", cell: "bg-sky-500 text-white" },
  upcoming: { letter: "·", label: "Upcoming", cell: "bg-sky-50 text-sky-500 ring-1 ring-sky-200" },
  not_arrived: { letter: "!", label: "Not arrived", cell: "bg-rose-100 text-rose-700 ring-1 ring-rose-300" },
  review: { letter: "?", label: "Needs review", cell: "bg-violet-400 text-white" },
  off_roster: { letter: "O", label: "Off roster", cell: "bg-teal-400 text-white" },
};
/** Worst first: the mark a day shows when it holds more than one duty. */
export const RANK: Outcome[] = ["absent", "not_arrived", "review", "late", "on_duty", "present", "off_roster", "replaced", "upcoming"];

export function Legend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {(["present", "late", "absent", "replaced", "on_duty", "not_arrived", "review", "off_roster", "upcoming"] as Outcome[]).map((o) => (
        <span key={o} className="inline-flex items-center gap-1.5">
          <span className={cn("grid size-4 place-items-center rounded text-[9px] font-bold", OUTCOME[o].cell)}>{OUTCOME[o].letter}</span>
          {OUTCOME[o].label}
        </span>
      ))}
    </div>
  );
}
