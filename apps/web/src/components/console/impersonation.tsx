"use client";

import { useMemo, useState, useTransition } from "react";
import { Eye, EyeOff, Search, UserRoundCog } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  admin: "Administrator",
  supervisor: "Supervisor",
  guard: "Guard",
  client: "Client",
};

/**
 * The band across the top while an admin is viewing the console as someone
 * else.
 *
 * Deliberately loud, fixed to the top of the shell and impossible to dismiss.
 * The failure mode of an impersonation feature is forgetting it is on: an admin
 * who believes they are looking at their own console, finds a guard's empty
 * roster and reports a bug that does not exist — or, worse, changes something
 * believing it is theirs. Amber rather than red because nothing is wrong; it is
 * a state, not an error.
 */
export function ImpersonationBanner({
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
      className="z-40 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-amber-500/30 bg-amber-100/80 px-4 py-2 text-amber-950 lg:rounded-xl lg:border dark:bg-amber-500/15 dark:text-amber-100 print:hidden"
    >
      <Eye className="size-4 shrink-0" strokeWidth={2} />
      <p className="min-w-0 text-sm">
        Viewing as <strong className="font-semibold">{name}</strong>{" "}
        <span className="text-amber-900/70 dark:text-amber-200/70">
          {code} · {ROLE_LABEL[role]}
        </span>
      </p>
      <p className="w-full text-xs text-amber-900/70 sm:w-auto dark:text-amber-200/70">
        Signed in as {adminName}. Attendance cannot be recorded from this view.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="ml-auto border-amber-600/40 bg-transparent hover:bg-amber-500/20"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await stop();
          })
        }
      >
        <EyeOff data-icon="inline-start" />
        {pending ? "Returning…" : "Stop viewing"}
      </Button>
    </div>
  );
}

/**
 * The picker an admin opens to view the console as somebody else.
 *
 * A dialog rather than a dropdown: the roster is a searchable list of every
 * active account, which is the wrong shape for a menu, and picking the wrong
 * row here silently changes what every subsequent screen means. A dialog makes
 * it a deliberate act.
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="View console as someone else">
          <UserRoundCog />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>View as someone else</DialogTitle>
          <DialogDescription>
            The console will show exactly what this person sees. Everything you do
            while viewing is recorded against your own account in the audit log.
          </DialogDescription>
        </DialogHeader>

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

        <div className="-mx-1 max-h-[45vh] min-h-0 overflow-y-auto px-1">
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
      </DialogContent>
    </Dialog>
  );
}
