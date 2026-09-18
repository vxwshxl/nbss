"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Check,
  Copy,
  Eye,
  KeyRound,
  Plus,
  Power,
  PowerOff,
  ShieldUser,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { addGuard, changeRole, resetPin, setAccountActive } from "@/app/console/guards/actions";
import { emptyGuardForm } from "@/app/console/guards/guard-state";
import { startImpersonation } from "@/app/console/impersonate";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";
import { initials } from "@/lib/ui/initials";
import type { Role } from "@/lib/auth";

export type PersonRow = {
  id: string;
  employee_code: string;
  full_name: string;
  role: Role;
  phone: string | null;
  active: boolean;
  joined_at: string | null;
  created_at: string;
  must_change_pin: boolean;
  pin_reset_at: string | null;
  last_seen_at: string | null;
};

const ROLES: { value: Role; label: string; note: string }[] = [
  { value: "guard", label: "Guard", note: "Own shifts and attendance only" },
  { value: "supervisor", label: "Supervisor", note: "Sites they are responsible for" },
  { value: "admin", label: "Administrator", note: "Everything, including settings" },
  { value: "client", label: "Client", note: "Read-only view of their own site" },
];

const ROLE_LABEL: Record<Role, string> = {
  guard: "Guard",
  supervisor: "Supervisor",
  admin: "Administrator",
  client: "Client",
};

const ROLE_TONE: Record<Role, "indigo" | "violet" | "rose" | "slate"> = {
  guard: "indigo",
  supervisor: "violet",
  admin: "rose",
  client: "slate",
};

/**
 * Next signals a redirect by throwing. The error carries a `digest` beginning
 * with NEXT_REDIRECT, and it must be allowed to propagate — catching it would
 * both cancel the navigation and report a success as a failure.
 */
function isRedirect(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function dateOnly(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * A secret the operator has one chance to write down.
 *
 * Large, monospaced and letter-spaced, because it is going to be read aloud
 * down a phone line or copied onto a slip of paper — the two cases where a 0
 * and an O being indistinguishable costs somebody a trip back to the office.
 */
function Secret({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-app-line bg-muted/60 p-3">
      <code className="flex-1 text-center font-mono text-2xl font-bold tracking-[0.2em] tabular-nums">
        {value}
      </code>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Copy"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            toast.error("Could not copy. Select the text and copy it by hand.");
          }
        }}
      >
        {copied ? <Check className="text-primary" /> : <Copy />}
      </Button>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-app-line-soft py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}

export function GuardsWorkspace({
  rows,
  canManage,
  selfId,
}: {
  rows: PersonRow[];
  canManage: boolean;
  selfId: string;
}) {
  const [pending, start] = useTransition();

  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<PersonRow | null>(null);
  const [confirm, setConfirm] = useState<
    null | { kind: "deactivate" | "reset"; row: PersonRow }
  >(null);
  const [issued, setIssued] = useState<null | { pin: string; who: string }>(null);

  const [addState, addAction] = useActionState(addGuard, emptyGuardForm);
  const [role, setRole] = useState<Role>("guard");

  function runReset(row: PersonRow) {
    start(async () => {
      const result = await resetPin(row.id);
      setConfirm(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setIssued({ pin: result.pin, who: `${result.fullName} (${result.employeeCode})` });
      setDetail(null);
    });
  }

  function runActive(row: PersonRow, active: boolean) {
    start(async () => {
      try {
        await setAccountActive(row.id, active);
        setConfirm(null);
        setDetail(null);
        toast.success(active ? "Account reactivated" : "Account deactivated", {
          description: `${row.full_name} · ${row.employee_code}`,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not change the account.");
      }
    });
  }

  function runRole(row: PersonRow, next: Role) {
    start(async () => {
      try {
        await changeRole(row.id, next);
        setDetail({ ...row, role: next });
        toast.success(`${row.full_name} is now ${ROLE_LABEL[next].toLowerCase()}.`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not change the role.");
      }
    });
  }

  function runViewAs(row: PersonRow) {
    start(async () => {
      try {
        await startImpersonation(row.id);
      } catch (e) {
        if (isRedirect(e)) throw e;
        toast.error(e instanceof Error ? e.message : "Could not open that view.");
      }
    });
  }

  const columns: Column<PersonRow>[] = [
    {
      header: "Person",
      cell: (r) => (
        <span className="flex items-center gap-2.5">
          <Avatar className="size-8 border border-border">
            <AvatarFallback className="bg-muted text-[11px] font-semibold">
              {initials(r.full_name)}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 font-medium">
              {r.full_name}
              {r.must_change_pin && (
                <TriangleAlert
                  className="size-3.5 text-amber-600 dark:text-amber-400"
                  strokeWidth={2}
                  aria-label="Temporary PIN"
                />
              )}
            </span>
            <span className="block font-mono text-xs text-muted-foreground">
              {r.employee_code}
            </span>
          </span>
        </span>
      ),
      sortValue: (r) => r.employee_code,
      searchValue: (r) => `${r.full_name} ${r.employee_code} ${r.phone ?? ""}`,
      printCell: (r) => `${r.full_name} (${r.employee_code})`,
    },
    {
      header: "Role",
      cell: (r) => <StatusPill label={ROLE_LABEL[r.role]} tone={ROLE_TONE[r.role]} />,
      sortValue: (r) => ROLE_LABEL[r.role],
      searchValue: (r) => ROLE_LABEL[r.role],
      printCell: (r) => ROLE_LABEL[r.role],
    },
    {
      header: "Phone",
      cell: (r) => <span className="font-mono text-sm">{r.phone ?? "—"}</span>,
      printCell: (r) => r.phone ?? "—",
    },
    {
      header: "Joined",
      cell: (r) => (
        <span className="tabular-nums">{dateOnly(r.joined_at ?? r.created_at)}</span>
      ),
      sortValue: (r) => r.joined_at ?? r.created_at,
      printCell: (r) => dateOnly(r.joined_at ?? r.created_at),
    },
    {
      header: "State",
      className: "text-right",
      headClassName: "text-right",
      cell: (r) => <StatusPill status={r.active ? "active" : "inactive"} />,
      sortValue: (r) => (r.active ? 1 : 0),
      printCell: (r) => (r.active ? "Active" : "Inactive"),
    },
  ];

  // Shown once, after a create or a reset, and never again.
  const secret = issued?.pin ?? addState.created?.pin ?? null;

  return (
    <>
      <Panel
        tone="indigo"
        title={`${rows.length} ${rows.length === 1 ? "account" : "accounts"}`}
        icon={ShieldUser}
        bodyClassName="p-3 sm:p-4"
        action={
          canManage ? (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus data-icon="inline-start" />
              Add person
            </Button>
          ) : undefined
        }
      >
        <DataTable
          columns={columns}
          data={rows}
          getRowKey={(r) => r.id}
          interactiveRows
          rowPreview={false}
          onRowClick={setDetail}
          printTitle="People"
          searchPlaceholder="Search by name, code or phone…"
          emptyMessage={
            canManage ? "No accounts yet. Add the first person to get started." : "Nothing to show."
          }
          rowClassName={(r) => (r.active ? undefined : "opacity-60")}
        />
      </Panel>

      {/* ---------------------------------------------------------- add ---- */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a person</DialogTitle>
            <DialogDescription>
              They sign in with the employee code and the PIN issued here.
            </DialogDescription>
          </DialogHeader>

          <form action={addAction} id="add-person" className="flex flex-col gap-4">
            {addState.error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              >
                {addState.error}
              </p>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="full_name">
                Full name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={addState.values?.full_name}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="employee_code">
                Employee code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="employee_code"
                name="employee_code"
                defaultValue={addState.values?.employee_code}
                placeholder="NBSS-042"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                required
                className="font-mono tracking-wider uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Printed on their identity card. Letters, digits and hyphens.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={addState.values?.phone}
                inputMode="tel"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="role">
                Role <span className="text-destructive">*</span>
              </Label>
              {/* Radix's Select is not a form control, so the chosen value is
                  mirrored into a hidden input for the server action. */}
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger id="role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                      <span className="ml-2 text-xs text-muted-foreground">{r.note}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="role" value={role} />
              <p className="text-xs text-muted-foreground">
                A guard only ever sees their own shifts.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="pin">PIN or passphrase</Label>
              <Input id="pin" name="pin" placeholder="Leave blank to generate one" />
              <p className="text-xs text-muted-foreground">
                {role === "guard"
                  ? "Six digits. Left blank, one is generated and shown once."
                  : "At least 8 characters. Required for this role."}
              </p>
            </div>
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" form="add-person">
              Create account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------- the one showing -- */}
      <Dialog
        open={!!secret}
        onOpenChange={(o) => {
          if (o) return;
          setIssued(null);
          setAdding(false);
          // `useActionState` has no reset, so the created-secret state is
          // cleared by reloading against the data the action already
          // revalidated. Crude, and the only thing that cannot show it twice.
          window.location.reload();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{issued ? "New PIN issued" : "Account created"}</DialogTitle>
            <DialogDescription>
              {issued
                ? `Give this to ${issued.who}. It cannot be shown again.`
                : addState.created
                  ? `${addState.created.fullName} can sign in with ${addState.created.employeeCode}.`
                  : ""}
            </DialogDescription>
          </DialogHeader>

          <Secret value={secret ?? ""} />

          <p className="text-xs text-muted-foreground">
            Written down now or not at all — it is stored hashed and cannot be read
            back. If it is lost, issue another.
          </p>

          <DialogFooter>
            <Button
              onClick={() => {
                setIssued(null);
                setAdding(false);
                window.location.reload();
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------- detail ---- */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2.5">
                  <Avatar className="size-9 border border-border">
                    <AvatarFallback className="bg-muted text-xs font-semibold">
                      {initials(detail.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  {detail.full_name}
                </SheetTitle>
                <SheetDescription>
                  <span className="font-mono">{detail.employee_code}</span> ·{" "}
                  {ROLE_LABEL[detail.role]}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
                <section>
                  <Fact
                    label="Employee code"
                    value={<span className="font-mono">{detail.employee_code}</span>}
                  />
                  <Fact
                    label="Phone"
                    value={<span className="font-mono">{detail.phone ?? "—"}</span>}
                  />
                  <Fact label="Joined" value={dateOnly(detail.joined_at ?? detail.created_at)} />
                  <Fact
                    label="State"
                    value={<StatusPill status={detail.active ? "active" : "inactive"} />}
                  />
                  <Fact
                    label="PIN"
                    value={
                      <span className="block max-w-[15rem]">
                        {detail.must_change_pin
                          ? "Temporary — they choose their own on next sign-in"
                          : "Set by the account holder"}
                        {detail.pin_reset_at && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Last reset {dateOnly(detail.pin_reset_at)}
                          </span>
                        )}
                      </span>
                    }
                  />
                </section>

                {canManage && detail.id !== selfId && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="change-role">Change role</Label>
                    <Select
                      value={detail.role}
                      onValueChange={(v) => runRole(detail, v as Role)}
                      disabled={pending}
                    >
                      <SelectTrigger id="change-role" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                            <span className="ml-2 text-xs text-muted-foreground">
                              {r.note}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Takes effect the next time they load a page.
                    </p>
                  </div>
                )}
              </div>

              {canManage && (
                <SheetFooter className="gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending || detail.id === selfId || !detail.active}
                      onClick={() => runViewAs(detail)}
                    >
                      <Eye data-icon="inline-start" />
                      View as
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => setConfirm({ kind: "reset", row: detail })}
                    >
                      <KeyRound data-icon="inline-start" />
                      Reset PIN
                    </Button>
                    <Button
                      size="sm"
                      variant={detail.active ? "destructive" : "default"}
                      disabled={pending || detail.id === selfId}
                      onClick={() =>
                        detail.active
                          ? setConfirm({ kind: "deactivate", row: detail })
                          : runActive(detail, true)
                      }
                    >
                      {detail.active ? (
                        <>
                          <PowerOff data-icon="inline-start" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Power data-icon="inline-start" />
                          Reactivate
                        </>
                      )}
                    </Button>
                  </div>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirm?.kind === "deactivate"}
        onOpenChange={(o) => !o && setConfirm(null)}
        onConfirm={() => {
          if (confirm) runActive(confirm.row, false);
        }}
        destructive
        hold
        title="Deactivate this account?"
        confirmLabel="Deactivate"
        description={
          confirm
            ? `${confirm.row.full_name} will not be able to sign in. Every shift and punch already recorded for them is kept — nothing is deleted, and they can be reactivated at any time.`
            : ""
        }
      />

      <ConfirmDialog
        open={confirm?.kind === "reset"}
        onOpenChange={(o) => !o && setConfirm(null)}
        onConfirm={() => {
          if (confirm) runReset(confirm.row);
        }}
        title="Issue a new PIN?"
        confirmLabel="Issue new PIN"
        description={
          confirm
            ? `${confirm.row.full_name}'s current PIN stops working immediately. The new one is shown once on the next screen — write it down before closing it.`
            : ""
        }
      />
    </>
  );
}
