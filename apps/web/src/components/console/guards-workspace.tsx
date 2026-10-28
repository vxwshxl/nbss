"use client";

import { PhoneInput } from "@/components/ui/phone-input";

import { useActionState, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  accountFootprint,
  addGuard,
  changeRole,
  deleteAccount,
  setAccountActive,
  setPersonSos,
  updateContact,
} from "@/app/console/guards/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PersonPreviewDialog } from "@/components/console/person-preview";
import { StatusPill } from "@/components/ui/status-pill";
import { Switch } from "@/components/ui/switch";
import { initials } from "@/lib/ui/initials";
import { cn } from "@/lib/utils";
import { roleChoice, type RoleChoice } from "@nbss/shared/identity";

import type { Role } from "@/lib/auth";

export type PersonRow = {
  id: string;
  employee_code: string;
  full_name: string;
  role: Role;
  /** security, or housekeeping for a Housekeeper (0050). */
  trade: string;
  /** Whether they have the SOS button (0052). */
  sos_enabled: boolean;
  phone: string | null;
  email: string | null;
  active: boolean;
  joined_at: string | null;
  created_at: string;
  last_seen_at: string | null;
};

/** A person's role as it is shown and picked: a Housekeeper is the guard role with a trade. */
const choiceOf = (r: { role: Role; trade?: string | null }): RoleChoice => roleChoice(r.role, r.trade);

const ROLES: { value: RoleChoice; label: string; note: string }[] = [
  { value: "guard", label: "Guard", note: "Own shifts and attendance only" },
  { value: "housekeeping", label: "Housekeeper", note: "Works a site as a guard does: shifts, attendance, SOS" },
  { value: "supervisor", label: "Supervisor", note: "Sites they are responsible for" },
  { value: "admin", label: "Administrator", note: "Everything, including settings" },
  { value: "developer", label: "Developer", note: "Everything, and can appoint developers" },
  { value: "client", label: "Client", note: "Read-only view of their own site" },
];

const ROLE_LABEL: Record<RoleChoice, string> = {
  developer: "Developer",
  guard: "Guard",
  housekeeping: "Housekeeper",
  supervisor: "Supervisor",
  admin: "Administrator",
  client: "Client",
};

const ROLE_TONE: Record<RoleChoice, "emerald" | "violet" | "rose" | "sky" | "amber"> = {
  developer: "amber",
  guard: "emerald",
  housekeeping: "sky",
  supervisor: "violet",
  admin: "rose",
  client: "sky",
};

const TABS: { value: RoleChoice | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "developer", label: "Developers" },
  { value: "admin", label: "Admins" },
  { value: "supervisor", label: "Supervisors" },
  { value: "guard", label: "Guards" },
  { value: "housekeeping", label: "Housekeepers" },
  { value: "client", label: "Clients" },
];

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
  if (!iso) return "-";
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
export function GuardsWorkspace({
  rows,
  canManage,
  selfId,
  isDeveloper = false,
  showRoleTabs = false,
  defaultRole = "guard",
}: {
  rows: PersonRow[];
  canManage: boolean;
  selfId: string;
  /** Only a developer is offered the developer role, may change a developer, or "View as". */
  isDeveloper?: boolean;
  /** The Users page: every account, split by role. */
  showRoleTabs?: boolean;
  /** What "Add person" starts on. */
  defaultRole?: RoleChoice;
}) {
  const [pending, start] = useTransition();

  const [adding, setAdding] = useState(false);
  // `?person=<id>` opens someone directly — how a punch, a site or an SOS
  // links to the person in it.
  const params = useSearchParams();
  const [detailId, setDetailId] = useState<string | null>(params.get("person"));
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<RoleChoice | "all">("all");
  const [editing, setEditing] = useState(false);
  const detail = rows.find((r) => r.id === detailId) ?? null;
  const setDetail = (row: PersonRow | null) => {
    setEditing(false);
    setDetailId(row?.id ?? null);
  };
  const visible = tab === "all" ? rows : rows.filter((r) => choiceOf(r) === tab);
  const [confirm, setConfirm] = useState<
    null | { kind: "deactivate" | "delete"; row: PersonRow }
  >(null);
  /**
   * What deleting the person in `confirm` would destroy, read from the server when the
   * button is pressed. Null while it is still loading, so the dialog can say so rather
   * than flash "0 shifts" and then correct itself — which is the one number here that
   * must never be wrong.
   */
  const [footprint, setFootprint] = useState<Awaited<ReturnType<typeof accountFootprint>> | null>(
    null,
  );

  const [addState, addAction] = useActionState(addGuard, emptyGuardForm);
  const [role, setRole] = useState<RoleChoice>(defaultRole);
  const [sosOn, setSosOn] = useState(true);

  function runContact(row: PersonRow, form: FormData) {
    start(async () => {
      const result = await updateContact(row.id, {
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEditing(false);
      setVersion((v) => v + 1);
      toast.success("Contact details saved", { description: row.full_name });
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

  /** Opens the delete confirmation, fetching the footprint before it can be confirmed. */
  function askDelete(row: PersonRow) {
    setFootprint(null);
    setConfirm({ kind: "delete", row });
    start(async () => {
      try {
        setFootprint(await accountFootprint(row.id));
      } catch {
        // Left null. The dialog then refuses to enable its confirm button, which is the
        // right way to fail: never offer an irreversible action whose consequences could
        // not be read.
      }
    });
  }

  /**
   * Async and allowed to throw, unlike the other runners here.
   *
   * The others fire a transition and return immediately, which lets ConfirmDialog close
   * itself straight away — fine for a reversible deactivation. A delete can be refused
   * by the server for two reasons the operator has to act on (their own account, the
   * last active administrator), so the rejection is left to propagate: ConfirmDialog
   * awaits it, reports the real message, and leaves the dialog open beside the button
   * that produced it.
   */
  async function runDelete(row: PersonRow) {
    await deleteAccount(row.id);
    setConfirm(null);
    setFootprint(null);
    setDetail(null);
    toast.success("Account deleted", {
      description: `${row.full_name} · ${row.employee_code}`,
    });
  }

  function runSos(row: PersonRow, enabled: boolean) {
    start(async () => {
      try {
        await setPersonSos(row.id, enabled);
        setVersion((v) => v + 1);
        toast.success(`SOS switched ${enabled ? "on" : "off"} for ${row.full_name}.`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not change SOS.");
      }
    });
  }

  function runRole(row: PersonRow, next: RoleChoice) {
    start(async () => {
      try {
        await changeRole(row.id, next);
        setVersion((v) => v + 1);
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
            </span>
            <span className="block font-mono text-xs text-muted-foreground">
              {r.employee_code}
            </span>
          </span>
        </span>
      ),
      sortValue: (r) => r.employee_code,
      searchValue: (r) => `${r.full_name} ${r.employee_code} ${r.phone ?? ""} ${r.email ?? ""}`,
      printCell: (r) => `${r.full_name} (${r.employee_code})`,
    },
    {
      header: "Role",
      cell: (r) => <StatusPill label={ROLE_LABEL[choiceOf(r)]} tone={ROLE_TONE[choiceOf(r)]} />,
      sortValue: (r) => ROLE_LABEL[choiceOf(r)],
      searchValue: (r) => ROLE_LABEL[choiceOf(r)],
      printCell: (r) => ROLE_LABEL[choiceOf(r)],
    },
    {
      header: "Contact",
      cell: (r) => (
        <span className="block min-w-0">
          <span className={cn("block max-w-[16rem] truncate text-sm", !r.email && "text-muted-foreground")}>
            {r.email ?? (r.role === "guard" || r.role === "client" ? "No email yet" : "-")}
          </span>
          {r.phone && <span className="block font-mono text-xs text-muted-foreground">{r.phone}</span>}
        </span>
      ),
      sortValue: (r) => r.email ?? "",
      printCell: (r) => [r.email, r.phone].filter(Boolean).join(" · ") || "-",
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

  const created = addState.created ?? null;

  return (
    <>
      {showRoleTabs && (
        <div className="scrollbar-none -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1">
          {TABS.map((t) => {
            const count = t.value === "all" ? rows.length : rows.filter((r) => choiceOf(r) === t.value).length;
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                aria-pressed={active}
                className={cn(
                  "press flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-transparent bg-brand-gradient-strong text-white shadow-sm"
                    : "border-app-line bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    active ? "bg-white/20" : "bg-muted",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

        <DataTable
          title={`${visible.length} ${visible.length === 1 ? "account" : "accounts"}`}
          toolbar={
            canManage ? (
              <Button size="sm" className="rounded-full" onClick={() => setAdding(true)}>
                <Plus data-icon="inline-start" />
                Add person
              </Button>
            ) : undefined
          }
          columns={columns}
          data={visible}
          getRowKey={(r) => r.id}
          interactiveRows
          rowPreview={false}
          onRowClick={setDetail}
          printTitle="People"
          searchPlaceholder="Search by name, code, email or phone…"
          emptyMessage={
            canManage ? "No accounts yet. Add the first person to get started." : "Nothing to show."
          }
          rowClassName={(r) => (r.active ? undefined : "opacity-60")}
        />

      {/* ---------------------------------------------------------- add ---- */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a person</DialogTitle>
            <DialogDescription>
              They sign in with their full name and mobile number, so type both exactly as they will. The employee code is given automatically.
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">
                  Mobile <span className="text-destructive">*</span>
                </Label>
                <PhoneInput id="phone" name="phone" defaultValue={addState.values?.phone} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">
                  Email{" "}
                  <span className="font-normal text-muted-foreground">
                    {role === "client" ? "(their Google account)" : "(optional)"}
                  </span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={addState.values?.email}
                  placeholder="name@example.com"
                  required={role === "client"}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
            </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="role">
                  Role <span className="text-destructive">*</span>
                </Label>
                {/* Radix's Select is not a form control, so the chosen value is
                    mirrored into a hidden input for the server action. */}
                <Select value={role} onValueChange={(v) => setRole(v as RoleChoice)}>
                  <SelectTrigger id="role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.filter((r) => isDeveloper || r.value !== "developer").map((r) => (
                      <SelectItem key={r.value} value={r.value} description={r.note}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="role" value={role} />
              </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
              <div>
                <Label htmlFor="sos_enabled">SOS button</Label>
                <p className="text-xs text-muted-foreground">Off: they cannot raise an SOS from the app.</p>
              </div>
              <Switch id="sos_enabled" checked={sosOn} onCheckedChange={setSosOn} aria-label="SOS button" />
              <input type="hidden" name="sos_enabled" value={sosOn ? "on" : "off"} />
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
        open={!!created}
        onOpenChange={(o) => {
          if (o) return;
          setAdding(false);
          // `useActionState` has no reset, so the created state is cleared by
          // reloading against the data the action already revalidated.
          window.location.reload();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Account created</DialogTitle>
            <DialogDescription>
              {created ? `Tell ${created.fullName} how to sign in, on the app or the website.` : ""}
            </DialogDescription>
          </DialogHeader>

          {created && (
            <dl className="grid gap-3 rounded-xl border border-app-line bg-muted/50 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{created.fullName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Mobile</dt>
                <dd className="font-mono font-medium">{created.phone}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Employee code</dt>
                <dd className="font-mono font-medium">{created.employeeCode}</dd>
              </div>
            </dl>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
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
      <PersonPreviewDialog personId={detailId} onClose={() => setDetail(null)} version={version}>
        {(p) =>
          detail && canManage ? (
            <div className="space-y-5 border-t border-border pt-5">
              {editing ? (
                <form
                  className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                  action={(form) => runContact(detail, form)}
                >
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input id="edit-email" name="email" type="email" defaultValue={p.email ?? ""} autoFocus />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <PhoneInput id="edit-phone" name="phone" defaultValue={p.phone ?? ""} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="lg" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="lg" disabled={pending}>
                      Save
                    </Button>
                  </div>
                </form>
              ) : null}

              {detail.id !== selfId && (
                <div className="flex flex-col gap-2 sm:max-w-xs">
                  <Label htmlFor="change-role">Role</Label>
                  <Select
                    value={choiceOf(p)}
                    onValueChange={(v) => runRole(detail, v as RoleChoice)}
                    disabled={pending}
                  >
                    <SelectTrigger id="change-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.filter((r) => isDeveloper || r.value !== "developer").map((r) => (
                        <SelectItem key={r.value} value={r.value} description={r.note}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {detail.id !== selfId && (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3 sm:max-w-xs">
                  <div>
                    <Label htmlFor="person-sos">SOS button</Label>
                    <p className="text-xs text-muted-foreground">{detail.sos_enabled ? "On: they can raise an SOS." : "Off: no SOS from their app."}</p>
                  </div>
                  <Switch id="person-sos" checked={detail.sos_enabled} disabled={pending} onCheckedChange={(on) => runSos(detail, on)} aria-label="SOS button" />
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {!editing && (
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing(true)}>
                    <Pencil data-icon="inline-start" />
                    Edit contact
                  </Button>
                )}
                {isDeveloper && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending || detail.id === selfId || !detail.active}
                    onClick={() => runViewAs(detail)}
                  >
                    <Eye data-icon="inline-start" />
                    View as
                  </Button>
                )}
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
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={pending || detail.id === selfId}
                  onClick={() => askDelete(detail)}
                >
                  <Trash2 data-icon="inline-start" />
                  Delete
                </Button>
              </div>
            </div>
          ) : null
        }
      </PersonPreviewDialog>

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
            ? `${confirm.row.full_name} will not be able to sign in. Every shift and punch already recorded for them is kept. Nothing is deleted, and they can be reactivated at any time.`
            : ""
        }
      />

      {/* ------------------------------------------------------- delete ---- */}
      <ConfirmDialog
        open={confirm?.kind === "delete"}
        onOpenChange={(o) => {
          if (!o) {
            setConfirm(null);
            setFootprint(null);
          }
        }}
        onConfirm={() => (confirm ? runDelete(confirm.row) : undefined)}
        destructive
        hold
        // Nothing can be confirmed until the footprint has arrived. Agreeing to destroy
        // an unknown number of attendance records is not consent.
        confirmDisabled={!footprint}
        title="Delete this account permanently?"
        confirmLabel="Delete for good"
        description={
          confirm ? (
            <span className="block space-y-2">
              <span className="block">
                <span className="font-medium text-foreground">{confirm.row.full_name}</span>{" "}
                <span className="font-mono text-xs">{confirm.row.employee_code}</span> will be
                erased, along with everything below. This cannot be undone.
              </span>

              {!footprint ? (
                <span className="block text-xs">Working out what this would delete…</span>
              ) : (
                <>
                  <span className="block rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
                    <span className="block font-medium text-destructive">
                      Destroyed with the account
                    </span>
                    <span className="mt-1 block tabular-nums">
                      {footprint.attendance} attendance record
                      {footprint.attendance === 1 ? "" : "s"} · {footprint.shifts} rostered shift
                      {footprint.shifts === 1 ? "" : "s"} · {footprint.sosAlerts} SOS alert
                      {footprint.sosAlerts === 1 ? "" : "s"} · {footprint.positions} location point
                      {footprint.positions === 1 ? "" : "s"}
                    </span>
                  </span>

                  {footprint.attendance > 0 && (
                    // The reason this dialog exists rather than a plain "are you sure?".
                    // Attendance is what payroll and client invoices are computed from,
                    // and an admin deleting a duplicate typo account has no idea they
                    // might be deleting a month of somebody's wages.
                    <span className="block text-xs font-medium text-destructive">
                      Payroll and client billing are computed from those attendance records.
                      Deactivating instead keeps them and still stops the sign-in.
                    </span>
                  )}
                </>
              )}
            </span>
          ) : (
            ""
          )
        }
      />

    </>
  );
}
