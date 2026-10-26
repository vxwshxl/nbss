"use client";

import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, ArrowRight, CalendarClock, Check, Search, UserCheck, UserRoundX, X } from "lucide-react";
import { toast } from "sonner";

import { SHIFT_LABEL, isShiftType } from "@nbss/shared/shifts";

import { assignReplacement, declineRequest } from "@/app/console/replacements/actions";
import { PreviewActions, PreviewBody, PreviewDialog, PreviewHero, HeroPill } from "@/components/console/preview-kit";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type Duty = {
  id: string;
  guardId: string;
  guardName: string;
  siteId: string;
  siteName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  shiftType: string | null;
};

export type ReplacementRequest = {
  id: string;
  guardName: string;
  guardPhone: string | null;
  reason: string | null;
  createdAt: string;
  duty: Duty;
};

export type ReplacementRow = {
  id: string;
  siteName: string;
  startsAt: string;
  endsAt: string;
  shiftType: string | null;
  fromGuard: string;
  toGuard: string;
  reason: string | null;
  status: string;
};

export type GuardOption = { id: string; name: string; code: string; phone: string | null };

const IST = "Asia/Kolkata";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true });
const typeLabel = (t: string | null) => (isShiftType(t) ? SHIFT_LABEL[t] : "Custom");

function overlaps(a: { startsAt: string; endsAt: string }, b: { startsAt: string; endsAt: string }) {
  return new Date(a.startsAt) < new Date(b.endsAt) && new Date(b.startsAt) < new Date(a.endsAt);
}

/**
 * Replacements. A guard who cannot make a duty asks from the app; the request
 * lands here, and a supervisor picks who covers. A supervisor can also hand a
 * guard's duties over without being asked — off sick for three days, sent to an
 * event. Either way the original duty is linked to the new one, so the nightly
 * roster never writes it back and both guards' apps say who replaced whom.
 */
export function ReplacementsWorkspace({
  requests,
  duties,
  guards,
  history,
}: {
  requests: ReplacementRequest[];
  duties: Duty[];
  guards: GuardOption[];
  history: ReplacementRow[];
}) {
  const [pending, start] = useTransition();
  const [assign, setAssign] = useState<{ shifts: Duty[]; requestId: string | null; reason: string } | null>(null);
  // The roster's "Replace" button arrives with the guard and the shift already chosen.
  const params = useSearchParams();
  const [who, setWho] = useState<string>(params.get("guard") ?? "");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(params.get("shift") ? [params.get("shift")!] : []));

  const dutiesOf = (guardId: string) => duties.filter((d) => d.guardId === guardId);
  const mine = who ? dutiesOf(who) : [];

  const columns: Column<ReplacementRow>[] = [
    {
      header: "Duty",
      cell: (r) => (
        <span className="block">
          <span className="block font-medium">{r.siteName}</span>
          <span className="block text-xs text-muted-foreground">
            {day(r.startsAt)} · {typeLabel(r.shiftType)} · {time(r.startsAt)} – {time(r.endsAt)}
          </span>
        </span>
      ),
      sortValue: (r) => r.startsAt,
      searchValue: (r) => `${r.siteName} ${r.fromGuard} ${r.toGuard}`,
      printCell: (r) => `${r.siteName}, ${day(r.startsAt)} ${time(r.startsAt)}–${time(r.endsAt)}`,
    },
    {
      header: "Handed over",
      cell: (r) => (
        <span className="inline-flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-muted-foreground line-through decoration-muted-foreground/50">{r.fromGuard}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className="font-medium">{r.toGuard}</span>
        </span>
      ),
      sortValue: (r) => r.toGuard,
      printCell: (r) => `${r.fromGuard} → ${r.toGuard}`,
    },
    { header: "Reason", cell: (r) => r.reason ?? "-", printCell: (r) => r.reason ?? "-" },
    { header: "State", cell: (r) => <StatusPill status={r.status} />, sortValue: (r) => r.status, printCell: (r) => r.status },
  ];

  return (
    <div className="space-y-6">
      {/* Requests from guards */}
      <section className="overflow-hidden rounded-2xl border border-app-line bg-card">
        <header className="flex items-center gap-2 border-b border-app-line-soft px-4 py-3">
          <UserRoundX className="size-4 text-amber-600" />
          <h2 className="font-semibold">Asked for cover · {requests.length}</h2>
        </header>
        {requests.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No requests. Guards ask from the app by pressing “I can&apos;t come” on a duty.</p>
        ) : (
          <ul className="divide-y divide-app-line-soft">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {r.guardName} <span className="font-normal text-muted-foreground">can&apos;t make</span> {r.duty.siteName}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {day(r.duty.startsAt)} · {typeLabel(r.duty.shiftType)} · {time(r.duty.startsAt)} – {time(r.duty.endsAt)}
                    {r.reason ? ` · “${r.reason}”` : ""}
                  </span>
                </span>
                <Button size="sm" onClick={() => setAssign({ shifts: [r.duty], requestId: r.id, reason: r.reason ?? "" })}>
                  <UserCheck data-icon="inline-start" /> Assign cover
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await declineRequest(r.id);
                      if (res.ok) toast.success(`${r.guardName} keeps the duty`);
                      else toast.error(res.error);
                    })
                  }
                >
                  <X data-icon="inline-start" /> Decline
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Hand over without a request */}
      <section className="overflow-hidden rounded-2xl border border-app-line bg-card">
        <header className="flex flex-wrap items-center gap-3 border-b border-app-line-soft px-4 py-3">
          <ArrowLeftRight className="size-4 text-sky-600" />
          <h2 className="flex-1 font-semibold">Replace a guard</h2>
          <Select
            value={who}
            onValueChange={(v) => {
              setWho(v);
              setPicked(new Set());
            }}
          >
            <SelectTrigger
              aria-label="Guard to replace"
              className="h-9 w-full min-w-56 rounded-full border-0 bg-muted/70 px-3 ring-1 ring-border/60 sm:w-auto"
            >
              <SelectValue placeholder="Choose the guard who is busy…" />
            </SelectTrigger>
            <SelectContent position="popper" align="end" searchPlaceholder="Find a guard">
              {guards.map((g) => (
                <SelectItem key={g.id} value={g.id} textValue={g.name} description={`${dutiesOf(g.id).length} upcoming`}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>
        {who && (
          <div className="p-4">
            {mine.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming duties for this guard in the next two weeks.</p>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">Tick the duties to hand over — one day, or several.</span>
                  <button type="button" className="font-medium text-primary" onClick={() => setPicked(new Set(picked.size === mine.length ? [] : mine.map((d) => d.id)))}>
                    {picked.size === mine.length ? "Clear" : "Select all"}
                  </button>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {mine.map((d) => {
                    const on = picked.has(d.id);
                    return (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => {
                            const next = new Set(picked);
                            if (on) next.delete(d.id);
                            else next.add(d.id);
                            setPicked(next);
                          }}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition-colors",
                            on ? "bg-sky-50 ring-sky-500/50 dark:bg-sky-500/10" : "ring-border hover:bg-muted/60",
                          )}
                        >
                          <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md ring-1", on ? "bg-sky-600 text-white ring-sky-600" : "ring-border")}>
                            {on && <Check className="size-3.5" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium">{day(d.startsAt)}</span>
                            <span className="block text-xs text-muted-foreground">
                              {d.siteName} · {typeLabel(d.shiftType)} · {time(d.startsAt)} – {time(d.endsAt)}
                              {d.status === "in_progress" ? " · on duty now" : d.status === "missed" ? " · not arrived" : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-4 flex justify-end">
                  <Button disabled={picked.size === 0} onClick={() => setAssign({ shifts: mine.filter((d) => picked.has(d.id)), requestId: null, reason: "" })}>
                    <UserCheck data-icon="inline-start" /> Choose replacement for {picked.size || "…"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <DataTable
        title={`${history.length} replacement${history.length === 1 ? "" : "s"}`}
        columns={columns}
        data={history}
        getRowKey={(r) => r.id}
        printTitle="Replacements"
        searchPlaceholder="Search by site or guard…"
        emptyMessage="No duty has been handed over yet."
      />

      {assign && (
        <AssignDialog
          key={assign.shifts.map((s) => s.id).join()}
          shifts={assign.shifts}
          requestId={assign.requestId}
          initialReason={assign.reason}
          guards={guards}
          duties={duties}
          onClose={() => setAssign(null)}
          onDone={() => {
            setAssign(null);
            setPicked(new Set());
          }}
        />
      )}
    </div>
  );
}

function AssignDialog({
  shifts,
  requestId,
  initialReason,
  guards,
  duties,
  onClose,
  onDone,
}: {
  shifts: Duty[];
  requestId: string | null;
  initialReason: string;
  guards: GuardOption[];
  duties: Duty[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState("");
  const [reason, setReason] = useState(initialReason);
  const [query, setQuery] = useState("");
  const from = shifts[0]!;

  // Free guards first: anyone whose own duties do not overlap any of these.
  const candidates = useMemo(
    () =>
      guards
        .filter((g) => g.id !== from.guardId)
        .map((g) => {
          const clash = duties.find((d) => d.guardId === g.id && shifts.some((s) => overlaps(s, d)));
          return { ...g, clash };
        })
        .filter((g) => !query.trim() || `${g.name} ${g.code}`.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => Number(!!a.clash) - Number(!!b.clash) || a.name.localeCompare(b.name)),
    [guards, duties, shifts, from.guardId, query],
  );

  return (
    <PreviewDialog open onClose={onClose} label="Assign a replacement">
      <PreviewHero
        icon={ArrowLeftRight}
        title={`Cover for ${from.guardName}`}
        meta={
          <span>
            {shifts.length === 1 ? `${from.siteName} · ${day(from.startsAt)}, ${time(from.startsAt)} – ${time(from.endsAt)}` : `${shifts.length} duties`}
          </span>
        }
        badge={<HeroPill>{typeLabel(from.shiftType)}</HeroPill>}
      />
      <PreviewBody>
        {shifts.length > 1 && (
          <ul className="space-y-1 text-sm">
            {shifts.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-muted-foreground">
                <CalendarClock className="size-3.5" /> {day(s.startsAt)} · {s.siteName} · {time(s.startsAt)} – {time(s.endsAt)}
              </li>
            ))}
          </ul>
        )}
        <div>
          <label className="mb-2 flex h-10 items-center gap-2 rounded-full bg-muted/70 px-3.5 ring-1 ring-border/60">
            <Search className="size-4 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a guard" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {candidates.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setChosen(g.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ring-1 transition-colors",
                    chosen === g.id ? "bg-emerald-50 ring-emerald-500/60 dark:bg-emerald-500/10" : "ring-transparent hover:bg-muted/60",
                  )}
                >
                  <span className={cn("size-2.5 shrink-0 rounded-full", g.clash ? "bg-amber-500" : "bg-emerald-500")} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{g.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {g.clash ? `Busy: ${g.clash.siteName}, ${day(g.clash.startsAt)} ${time(g.clash.startsAt)} – ${time(g.clash.endsAt)}` : "Free for these hours"}
                    </span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{g.code}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">Reason (optional)</p>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Sick, on leave, sent to another site…" rows={2} />
        </div>
      </PreviewBody>
      <PreviewActions>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!chosen || pending}
          onClick={() =>
            start(async () => {
              const res = await assignReplacement({ shiftIds: shifts.map((s) => s.id), guardId: chosen, reason, requestId });
              if (res.ok) {
                toast.success(`${guards.find((g) => g.id === chosen)?.name ?? "The guard"} will cover ${res.count === 1 ? "the duty" : `${res.count} duties`}. They have been told.`);
                onDone();
              } else toast.error(res.error);
            })
          }
        >
          <UserCheck data-icon="inline-start" /> Assign
        </Button>
      </PreviewActions>
    </PreviewDialog>
  );
}
