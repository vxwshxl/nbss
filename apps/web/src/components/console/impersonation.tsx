"use client";

import { useMemo, useState, useTransition } from "react";
import { Eye, LogOut, Search } from "lucide-react";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/ui/initials";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";

export type Person = {
  id: string;
  employee_code: string;
  full_name: string;
  role: Role;
};

export const ROLE_LABEL: Record<Role, string> = {
  developer: "Developer",
  admin: "Administrator",
  supervisor: "Supervisor",
  guard: "Guard",
  client: "Client",
};

/**
 * While viewing as someone: their icon and name in the header, and Exit beside it.
 * Amber, so it cannot be mistaken for your own account, and always in view.
 */
export function ViewingAs({
  name,
  code,
  role,
  adminName,
  stop,
}: {
  name: string;
  code: string;
  role: Role;
  adminName: string;
  stop: () => Promise<void>;
}) {
  const [pending, start] = useTransition();
  return (
    <div
      role="status"
      title={`Viewing as ${name} (${code}). Signed in as ${adminName}; attendance cannot be recorded from this view.`}
      className="inline-flex h-9 min-w-0 items-center gap-2 rounded-full border-2 border-amber-500/50 bg-amber-100 pr-1 pl-1 text-amber-950 dark:bg-amber-500/20 dark:text-amber-100 print:hidden"
    >
      <Avatar className="size-7 border border-amber-500/40">
        <AvatarFallback className="bg-amber-200 text-[11px] font-semibold text-amber-950">{initials(name)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 max-sm:hidden">
        <span className="block max-w-40 truncate text-sm leading-tight font-semibold">{name}</span>
        <span className="block truncate text-[11px] leading-tight text-amber-900/70 dark:text-amber-200/70">
          {ROLE_LABEL[role]} · {code}
        </span>
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => void (await stop()))}
        className="inline-flex h-7 items-center gap-1 rounded-full bg-amber-600 px-2.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
      >
        <LogOut className="size-3.5" />
        {pending ? "Exiting…" : "Exit"}
      </button>
    </div>
  );
}

/**
 * The picker an admin opens to view the console as somebody else.
 *
 * A dropdown under the button, with a search at the top: the person is one tap
 * away, and Exit in the header takes you back.
 */
export function ImpersonationPicker({
  people,
  start,
}: {
  people: Person[];
  start: (profileId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) =>
      `${p.full_name} ${p.employee_code} ${ROLE_LABEL[p.role]}`.toLowerCase().includes(q),
    );
  }, [people, query]);

  function view(id: string) {
    startTransition(async () => {
      try {
        await start(id);
      } catch (error) {
        // A redirect throws by design, and catching it here would report the
        // successful case as a failure. Only a real Error is a real problem.
        if (error instanceof Error && !error.message.includes("NEXT_REDIRECT")) {
          toast.error(error.message);
        }
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="View console as someone else"
          className="inline-flex h-9 min-w-0 items-center gap-2 rounded-full border-2 border-border bg-elevated px-3.5 text-sm font-semibold shadow-[0_2px_0_var(--ds-border)] transition-[filter,background-color] hover:bg-subtle"
        >
          <Eye className="size-4 shrink-0 text-secondary-fg" />
          <span className="shrink-0 max-sm:hidden">View as</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(92vw,360px)] space-y-2 p-2">
        <p className="px-1 pt-1 text-xs text-muted-foreground">See the console exactly as this person does. What you do is recorded against your own account.</p>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, code or role…"
            aria-label="Search people"
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="-mx-1 max-h-[50vh] min-h-0 overflow-y-auto px-1">
          {matches.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nobody matches that.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => view(p.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg p-2 text-left outline-none transition-colors",
                      "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
                      "disabled:pointer-events-none disabled:opacity-50",
                    )}
                  >
                    <Avatar className="size-8 border border-border">
                      <AvatarFallback className="bg-muted text-[11px] font-semibold">
                        {initials(p.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {p.full_name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {ROLE_LABEL[p.role]} · <span className="font-mono">{p.employee_code}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
