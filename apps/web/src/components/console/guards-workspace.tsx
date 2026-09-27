"use client";

import { useActionState, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  Eye,
  KeyRound,
  Mail,
  Pencil,
  Plus,
  Power,
  PowerOff,
  ShieldUser,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  accountFootprint,
  addGuard,
  changeRole,
  deleteAccount,
  resetPin,
  setAccountActive,
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
import { Panel } from "@/components/ui/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PersonPreviewDialog } from "@/components/console/person-preview";
import { StatusPill } from "@/components/ui/status-pill";
import { initials } from "@/lib/ui/initials";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";

export type PersonRow = {
  id: string;
  employee_code: string;
  full_name: string;
  role: Role;
  phone: string | null;
  email: string | null;
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

const ROLE_TONE: Record<Role, "emerald" | "violet" | "rose" | "sky"> = {
  guard: "emerald",
  supervisor: "violet",
  admin: "rose",
  client: "sky",
};

const TABS: { value: Role | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "admin", label: "Admins" },
  { value: "supervisor", label: "Supervisors" },
  { value: "guard", label: "Guards" },
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

export function GuardsWorkspace({
  rows,
  canManage,
  selfId,
  showRoleTabs = false,
  defaultRole = "guard",
}: {
  rows: PersonRow[];
  canManage: boolean;
  selfId: string;
  /** The Users page: every account, split by role. */
  showRoleTabs?: boolean;
  /** What "Add person" starts on. */
  defaultRole?: Role;
}) {
  const [pending, start] = useTransition();

  const [adding, setAdding] = useState(false);
  // `?person=<id>` opens someone directly — how a punch, a site or an SOS
  // links to the person in it.
  const params = useSearchParams();
  const [detailId, setDetailId] = useState<string | null>(params.get("person"));
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<Role | "all">("all");
  const [editing, setEditing] = useState(false);
  const detail = rows.find((r) => r.id === detailId) ?? null;
  const setDetail = (row: PersonRow | null) => {
    setEditing(false);
    setDetailId(row?.id ?? null);
  };
  const visible = tab === "all" ? rows : rows.filter((r) => r.role === tab);
  const [confirm, setConfirm] = useState<
    null | { kind: "deactivate" | "reset" | "delete"; row: PersonRow }
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
  const [issued, setIssued] = useState<null | { pin: string; who: string }>(null);

  const [addState, addAction] = useActionState(addGuard, emptyGuardForm);
  const [role, setRole] = useState<Role>(defaultRole);
  const emailRequired = role === "guard" || role === "client";

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

  function runRole(row: PersonRow, next: Role) {
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
      searchValue: (r) => `${r.full_name} ${r.employee_code} ${r.phone ?? ""} ${r.email ?? ""}`,
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
      header: "Contact",
      cell: (r) => (
        <span className="block min-w-0">
          <span className={cn("block max-w-[16rem] truncate text-sm", !r.email && "text-muted-foreground")}>
            {r.email ?? (r.role === "guard" || r.role === "client" ? "No email yet" : "—")}
          </span>
          {r.phone && <span className="block font-mono text-xs text-muted-foreground">{r.phone}</span>}
        </span>
      ),
      sortValue: (r) => r.email ?? "",
      printCell: (r) => [r.email, r.phone].filter(Boolean).join(" · ") || "—",
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
  const createdShown = !!issued || !!addState.created;

  return (
    <>
      {showRoleTabs && (
        <div className="scrollbar-none -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1">
          {TABS.map((t) => {
            const count = t.value === "all" ? rows.length : rows.filter((r) => r.role === t.value).length;
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

      <Panel
        tone="emerald"
        title={`${visible.length} ${visible.length === 1 ? "account" : "accounts"}`}
        icon={showRoleTabs ? Users : ShieldUser}
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
      </Panel>

      {/* ---------------------------------------------------------- add ---- */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a person</DialogTitle>
            <DialogDescription>
              They sign in with a code sent to their email.
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
              <Label htmlFor="email">
                Email {emailRequired && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={addState.values?.email}
                placeholder="name@example.com"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required={emailRequired}
              />
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

            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="pin">{role === "guard" ? "PIN" : "Passphrase"} <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                id="pin"
                name="pin"
                placeholder={role === "guard" ? "Leave blank to generate one" : "Leave blank to sign in by email code"}
              />
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
        open={createdShown}
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
                  ? addState.created.email
                    ? `${addState.created.fullName} signs in with ${addState.created.email} — a code is emailed each time.`
                    : `${addState.created.fullName} can sign in with ${addState.created.employeeCode}.`
                  : ""}
            </DialogDescription>
          </DialogHeader>

          {secret ? (
            <>
              <p className="text-sm font-medium">{issued ? "PIN" : "Backup PIN"}</p>
              <Secret value={secret} />
              <p className="text-xs text-muted-foreground">
                Shown once — it is stored hashed and cannot be read back.
              </p>
            </>
          ) : (
            <p className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm text-accent-foreground">
              <Mail className="size-4" /> No PIN needed — sign-in is by emailed code.
            </p>
          )}

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
                    <Input id="edit-phone" name="phone" inputMode="tel" defaultValue={p.phone ?? ""} />
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
                    value={p.role}
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
                          <span className="ml-2 text-xs text-muted-foreground">{r.note}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {!editing && (
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing(true)}>
                    <Pencil data-icon="inline-start" />
                    Edit contact
                  </Button>
                )}
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
                  {p.role === "guard" ? "Reset PIN" : "Reset passphrase"}
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
              {p.mustChangePin && (
                <p className="flex items-center gap-1.5 text-xs text-amber-700">
                  <TriangleAlert className="size-3.5" /> Using a temporary PIN issued by the office.
                </p>
              )}
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
            ? `${confirm.row.full_name} will not be able to sign in. Every shift and punch already recorded for them is kept — nothing is deleted, and they can be reactivated at any time.`
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
