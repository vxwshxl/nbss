"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, Eye, Filter, Loader2, Search, UserCog, X } from "lucide-react";
import { toast } from "sonner";

import { ROLE_CHOICE_LABEL, roleChoice, type RoleChoice } from "@nbss/shared/identity";

import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";

export type Person = {
  id: string;
  employee_code: string;
  full_name: string;
  role: Role;
  /** security, or housekeeping for a Housekeeper (0050). */
  trade?: string | null;
};

/** The roles the list can be narrowed to, in this order. */
const ROLES: RoleChoice[] = ["admin", "supervisor", "guard", "housekeeping", "client", "developer"];

/**
 * View as, as schoolerp has it: one control in the header.
 *
 * Not viewing: a "View as" pill. Viewing as someone: a round icon (who it is lives in
 * the tooltip and the top of the panel). Either opens the same panel: while viewing,
 * who you are viewing as and Exit; then the roles on the left, which narrow the people
 * on the right, with a search. Picking a role answers "which guard?", never "be a
 * generic guard": every view is a real account, which is what the audit log records.
 */
export function ImpersonationControl({
  people,
  impersonating,
  label,
  currentRole = null,
  currentUserId = null,
  start,
  stop,
}: {
  people: Person[];
  impersonating: boolean;
  /** Who is being viewed as (shown in the tooltip and the panel). */
  label: string;
  /** Their role, preselected when the panel is reopened. */
  currentRole?: RoleChoice | null;
  /** Their account, pinned to the top of the list and marked "Viewing now". */
  currentUserId?: string | null;
  start: (profileId: string) => Promise<void>;
  stop: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleChoice | null>(null);
  // What the screen says while the switch happens: the next screen is a full render away.
  const [switching, setSwitching] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people
      .filter((p) => !roleFilter || roleChoice(p.role, p.trade) === roleFilter)
      .filter((p) => !q || `${p.full_name} ${p.employee_code}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.id === currentUserId) - Number(a.id === currentUserId));
  }, [people, query, roleFilter, currentUserId]);

  // Close on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // A redirect throws by design; only a real Error is a real problem.
  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await fn();
      } catch (error) {
        if (error instanceof Error && !error.message.includes("NEXT_REDIRECT")) {
          setSwitching(null);
          toast.error(error.message);
        }
      }
    });

  function pick(p: Person) {
    setOpen(false);
    setSwitching(`Opening as ${p.full_name}…`);
    run(() => start(p.id));
  }
  function exit() {
    setOpen(false);
    setSwitching("Back to your own console…");
    run(stop);
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => {
          // Reopening while viewing starts where you are: their role, them first.
          if (!open) {
            setRoleFilter(impersonating && currentRole ? currentRole : null);
            setQuery("");
          }
          setOpen((v) => !v);
        }}
        title={impersonating ? `Viewing as ${label}` : undefined}
        aria-label={impersonating ? `Viewing as ${label}. Change or exit` : "View console as someone else"}
        className={cn(
          "inline-flex min-w-0 items-center gap-2 rounded-full text-sm font-medium transition-colors",
          impersonating
            ? "size-9 justify-center bg-primary text-primary-foreground shadow-[0_3px_0_color-mix(in_srgb,var(--primary)_60%,black)] hover:brightness-105"
            : "border border-border bg-card px-3.5 py-2 text-foreground hover:bg-accent/40",
        )}
      >
        {impersonating ? <UserCog className="size-4 shrink-0" /> : <Eye className="size-4 shrink-0 text-muted-foreground" />}
        {!impersonating && <span className="shrink-0 text-muted-foreground max-sm:hidden">View as</span>}
      </button>

      {switching && pending && (
        <div role="status" aria-live="polite" className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm animate-in fade-in-0 duration-150">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-popover px-5 py-4 text-sm font-medium shadow-xl">
            <Loader2 className="size-4 animate-spin text-primary" />
            {switching}
          </div>
        </div>
      )}

      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-[80vh] w-[34rem] max-w-[calc(100vw-2rem)] origin-top-right overflow-y-auto rounded-2xl border border-border bg-popover shadow-xl duration-200 ease-out-strong animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 max-sm:fixed max-sm:inset-x-3 max-sm:top-16 max-sm:mt-0 max-sm:w-auto max-sm:max-w-none">
          {impersonating && (
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-5 py-3 text-sm">
              <UserCog className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">
                Viewing as <b>{label}</b>
                {currentRole && <span className="text-muted-foreground"> · {ROLE_CHOICE_LABEL[currentRole]}</span>}
              </span>
            </div>
          )}
          {impersonating && (
            <div className="border-b border-border">
              <button
                type="button"
                onClick={exit}
                disabled={pending}
                className="flex w-full items-center gap-2 px-5 py-3.5 text-sm font-semibold text-destructive hover:bg-destructive/5"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                Exit impersonation
              </button>
            </div>
          )}

          <div className="flex flex-col divide-y divide-border sm:grid sm:grid-cols-[40%_60%] sm:divide-x sm:divide-y-0">
            {/* Role filter: narrows the list on the right. */}
            <div className="p-3">
              <p className="flex items-center gap-2 px-2 pb-2 text-xs font-medium tracking-wide text-muted-foreground">
                <Filter className="size-3.5" /> Filter by role
              </p>
              <button
                type="button"
                onClick={() => {
                  setRoleFilter(null);
                  setQuery("");
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent/50",
                  roleFilter === null ? "bg-accent/60 font-semibold" : "text-foreground/80 hover:text-foreground",
                )}
              >
                All roles
                {roleFilter === null && <Check className="size-4" />}
              </button>
              {ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setRoleFilter(role)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent/50",
                    roleFilter === role ? "bg-accent/60 font-semibold" : "text-foreground/80 hover:text-foreground",
                  )}
                >
                  {ROLE_CHOICE_LABEL[role]}
                  {roleFilter === role && <Check className="size-4" />}
                </button>
              ))}
            </div>

            {/* The person to view as. */}
            <div className="flex max-h-[26rem] flex-col p-3">
              <p className="flex items-center gap-2 px-2 pb-2 text-xs font-medium tracking-wide text-muted-foreground">
                <UserCog className="size-3.5" />
                {roleFilter ? `Pick a ${ROLE_CHOICE_LABEL[roleFilter].toLowerCase()} to impersonate` : "Pick someone to impersonate"}
              </p>
              <div className="relative mb-2">
                <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or employee code…"
                  className="w-full rounded-lg border border-border bg-background py-2 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>

              <div className="-mr-1 flex-1 space-y-0.5 overflow-y-auto pr-1">
                {results.length === 0 ? (
                  <p className="px-3 py-6 text-sm text-muted-foreground">
                    {roleFilter ? `No ${ROLE_CHOICE_LABEL[roleFilter].toLowerCase()} accounts match.` : "No users found."}
                  </p>
                ) : (
                  results.map((u) => {
                    const current = impersonating && u.id === currentUserId;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        disabled={pending || current}
                        onClick={() => pick(u)}
                        className={cn("block w-full rounded-lg px-3 py-2 text-left hover:bg-accent/50", current && "bg-accent/60 ring-1 ring-primary/30")}
                      >
                        <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                          <span className="min-w-0 truncate">{u.full_name}</span>
                          {current && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground uppercase">
                              <Check className="size-3" /> Viewing now
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {ROLE_CHOICE_LABEL[roleChoice(u.role, u.trade)]} · <span className="font-mono">{u.employee_code}</span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
