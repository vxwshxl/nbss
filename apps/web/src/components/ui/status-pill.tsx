import { cn } from "@/lib/utils";
import { TONES, type Tone } from "@/lib/ui/tones";

// One place that maps a status word to a colour + label. Green = good/settled,
// amber = partial/pending/in-progress, rose/red = bad/overdue/unpaid, sky = info,
// slate = neutral/void. Table status columns and detail views delegate here so
// the whole app speaks the same colour language.
const SEMANTIC: Record<string, { label: string; tone: Tone }> = {
  // enrolment / generic
  active: { label: "Active", tone: "emerald" },
  inactive: { label: "Inactive", tone: "slate" },
  // fees / invoices
  paid: { label: "Paid", tone: "emerald" },
  partial: { label: "Partial", tone: "amber" },
  unpaid: { label: "Unpaid", tone: "rose" },
  pending: { label: "Pending", tone: "amber" },
  void: { label: "Void", tone: "slate" },
  overpaid: { label: "Overpaid", tone: "sky" },
  // admissions / leave / approvals
  accepted: { label: "Accepted", tone: "emerald" },
  approved: { label: "Approved", tone: "emerald" },
  forwarded: { label: "Forwarded", tone: "sky" },
  rejected: { label: "Rejected", tone: "rose" },
  // attendance
  present: { label: "Present", tone: "emerald" },
  absent: { label: "Absent", tone: "rose" },
  late: { label: "Late", tone: "amber" },
  excused: { label: "Excused", tone: "sky" },
  leave: { label: "Leave", tone: "violet" },
  // duty states — a punch pair, as the database records it
  on_duty: { label: "On duty", tone: "emerald" },
  checked_out: { label: "Checked out", tone: "slate" },
  pending_review: { label: "Needs review", tone: "amber" },
  auto_closed: { label: "Auto-closed", tone: "orange" },
  no_show: { label: "No show", tone: "rose" },
  // shifts
  scheduled: { label: "Scheduled", tone: "sky" },
  completed: { label: "Completed", tone: "emerald" },
  cancelled: { label: "Cancelled", tone: "slate" },
  missed: { label: "Missed", tone: "rose" },
  // enquiries at the desk
  new: { label: "New", tone: "sky" },
  in_progress: { label: "In progress", tone: "amber" },
  closed: { label: "Closed", tone: "slate" },
  won: { label: "Won", tone: "emerald" },
  // sites
  archived: { label: "Archived", tone: "slate" },
  // settlements / misc
  settled: { label: "Settled", tone: "emerald" },
  due: { label: "Due", tone: "amber" },
};

export function statusMeta(status: string): { label: string; tone: Tone } {
  return SEMANTIC[status.toLowerCase()] ?? { label: status, tone: "slate" };
}

/**
 * Pill-shaped status badge. Pass a known `status` word (mapped to a colour), or
 * override `label`/`tone` explicitly.
 */
export function StatusPill({
  status,
  label,
  tone,
  className,
}: {
  status?: string;
  label?: string;
  tone?: Tone;
  className?: string;
}) {
  const meta = status ? statusMeta(status) : undefined;
  const t = TONES[tone ?? meta?.tone ?? "slate"];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        t.chip,
        className,
      )}
    >
      {label ?? meta?.label ?? status}
    </span>
  );
}
