"use client";

import { useActionState, useState, useTransition } from "react";

import { addGuard, changeRole, resetPin, setAccountActive } from "@/app/console/guards/actions";
import { emptyGuardForm } from "@/app/console/guards/guard-state";
import { startImpersonation } from "@/app/console/impersonate";
import { DataTable, type Column } from "@/components/console/DataTable";
import { Icon } from "@/components/Icon";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { byDate, byNum, byText } from "@/lib/hooks/useTableControls";
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

/**
 * Next signals a redirect by throwing. The error carries a `digest` beginning
 * with NEXT_REDIRECT, and it must be allowed to propagate.
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

/** A value the operator must copy before it is gone for good. */
function SecretRow({ value }: { value: string }) {
  const toast = useToast();
  return (
    <div className="ui-secret">
      <span className="ui-secret__v">{value}</span>
      <button
        className="btn btn--ghost btn--sm"
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast.ok("Copied");
          } catch {
            toast.error("Could not copy", "Select the text and copy it by hand.");
          }
        }}
      >
        Copy
      </button>
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
  const toast = useToast();
  const [pending, start] = useTransition();

  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<PersonRow | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: "deactivate" | "reset"; row: PersonRow }>(null);
  const [issued, setIssued] = useState<null | { pin: string; who: string }>(null);

  const [addState, addAction] = useActionState(addGuard, emptyGuardForm);
  const [role, setRole] = useState<Role>("guard");

  const columns: Column<PersonRow>[] = [
    {
      key: "code",
      label: "Code",
      mono: true,
      sort: byText((r) => r.employee_code),
      render: (r) => r.employee_code,
    },
    {
      key: "name",
      label: "Name",
      sort: byText((r) => r.full_name),
      render: (r) => (
        <span>
          {r.full_name}
          {r.must_change_pin && (
            <span className="cbadge cbadge--late" style={{ marginLeft: 8 }}>
              PIN pending
            </span>
          )}
        </span>
      ),
    },
    {
      key: "role",
      label: "Role",
      sort: byText((r) => r.role),
      render: (r) => ROLE_LABEL[r.role],
    },
    { key: "phone", label: "Phone", mono: true, render: (r) => r.phone ?? "—" },
    {
      key: "joined",
      label: "Joined",
      mono: true,
      sort: byDate((r) => r.joined_at ?? r.created_at),
      defaultDir: "desc",
      render: (r) => dateOnly(r.joined_at ?? r.created_at),
    },
    {
      key: "state",
      label: "State",
      sort: byNum((r) => (r.active ? 1 : 0)),
      render: (r) => (
        <span className={`cbadge ${r.active ? "cbadge--on" : "cbadge--off"}`}>
          {r.active ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  const runReset = (row: PersonRow) =>
    start(async () => {
      const result = await resetPin(row.id);
      setConfirm(null);
      if (!result.ok) {
        toast.error("Could not reset the PIN", result.error);
        return;
      }
      setIssued({ pin: result.pin, who: `${result.fullName} (${result.employeeCode})` });
      setDetail(null);
    });

  const runActive = (row: PersonRow, active: boolean) =>
    start(async () => {
      try {
        await setAccountActive(row.id, active);
        setConfirm(null);
        setDetail(null);
        toast.ok(active ? "Account reactivated" : "Account deactivated", `${row.full_name} · ${row.employee_code}`);
      } catch (e) {
        toast.error("Could not change the account", e instanceof Error ? e.message : undefined);
      }
    });

  const runRole = (row: PersonRow, next: Role) =>
    start(async () => {
      try {
        await changeRole(row.id, next);
        setDetail({ ...row, role: next });
        toast.ok("Role updated", `${row.full_name} is now ${ROLE_LABEL[next].toLowerCase()}.`);
      } catch (e) {
        toast.error("Could not change the role", e instanceof Error ? e.message : undefined);
      }
    });

  const runViewAs = (row: PersonRow) =>
    start(async () => {
      try {
        await startImpersonation(row.id);
      } catch (e) {
        // `redirect()` signals by throwing. That throw has to travel — catching
        // it here would both cancel the navigation and report a success as a
        // failure, which is exactly what a naive try/catch around a server
        // action that redirects does.
        if (isRedirect(e)) throw e;
        toast.error("Could not open that view", e instanceof Error ? e.message : undefined);
      }
    });

  return (
    <>
      {canManage && (
        <div className="chead__actions">
          <button className="btn btn--solid btn--sm" type="button" onClick={() => setAdding(true)}>
            Add person
          </button>
        </div>
      )}

      <div className="cpanel cpanel--table">
        <div className="cpanel__head">
          <h2 className="cpanel__h">
            {rows.length} {rows.length === 1 ? "account" : "accounts"}
          </h2>
          <span className="ui-hint">Select a row to open it</span>
        </div>
        <div className="cpanel__body">
          <DataTable
            rows={rows}
            columns={columns}
            getKey={(r) => r.id}
            onRowClick={setDetail}
            persistKey="nbss.table.people"
            initialSort="code"
            initialDir="asc"
            searchPlaceholder="Search by name, code or phone…"
            searchFields={(r) => [r.employee_code, r.full_name, r.phone, ROLE_LABEL[r.role]]}
            dateField={(r) => r.joined_at ?? r.created_at}
            empty={{
              title: "No accounts yet.",
              body: canManage ? "Add the first person to get started." : "Nothing to show.",
            }}
          />
        </div>
      </div>

      {/* ------------------------------------------------------- add person */}
      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a person"
        description="They sign in with the employee code and the PIN issued here."
      >
        <form action={addAction} id="add-person" className="ui-field" style={{ gap: 14 }}>
          {addState.error && (
            <p className="cerror" role="alert">
              <Icon name="close" />
              <span>{addState.error}</span>
            </p>
          )}

          <label className="ui-field">
            <span className="ui-label">
              Full name<span className="ui-req"> *</span>
            </span>
            <input className="cfield__i" name="full_name" defaultValue={addState.values?.full_name} required />
          </label>

          <label className="ui-field">
            <span className="ui-label">
              Employee code<span className="ui-req"> *</span>
            </span>
            <input
              className="cfield__i cfield__i--code"
              name="employee_code"
              defaultValue={addState.values?.employee_code}
              placeholder="NBSS-042"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              required
            />
            <span className="ui-hint">Printed on their identity card. Letters, digits and hyphens.</span>
          </label>

          <label className="ui-field">
            <span className="ui-label">Phone</span>
            <input className="cfield__i" name="phone" defaultValue={addState.values?.phone} inputMode="tel" />
          </label>

          <Select
            label="Role"
            name="role"
            required
            value={role}
            onChange={setRole}
            options={ROLES}
            hint="A guard only ever sees their own shifts."
          />

          <label className="ui-field">
            <span className="ui-label">PIN or passphrase</span>
            <input className="cfield__i" name="pin" placeholder="Leave blank to generate one" />
            <span className="ui-hint">
              {role === "guard"
                ? "Six digits. Left blank, one is generated and shown once."
                : "At least 8 characters. Required for this role."}
            </span>
          </label>
        </form>

        <div className="ui-modal__foot" style={{ padding: 0, border: 0 }}>
          <button className="btn btn--ghost btn--sm" type="button" onClick={() => setAdding(false)}>
            Cancel
          </button>
          <button className="btn btn--solid btn--sm" type="submit" form="add-person">
            Create account
          </button>
        </div>
      </Modal>

      {/* Shown once, after a create or a reset. */}
      <Modal
        open={!!addState.created || !!issued}
        onClose={() => {
          setIssued(null);
          setAdding(false);
          // The action result is not resettable, so the dialog is dismissed by
          // reloading the row data the page already revalidated.
          window.location.reload();
        }}
        title={issued ? "New PIN issued" : "Account created"}
        description={
          issued
            ? `Give this to ${issued.who}. It cannot be shown again.`
            : addState.created
              ? `${addState.created.fullName} can sign in with ${addState.created.employeeCode}.`
              : undefined
        }
        footer={
          <button
            className="btn btn--solid btn--sm"
            type="button"
            onClick={() => {
              setIssued(null);
              setAdding(false);
              window.location.reload();
            }}
          >
            Done
          </button>
        }
      >
        <SecretRow value={issued?.pin ?? addState.created?.pin ?? ""} />
        <p className="ui-hint">
          Written down now or not at all — it is stored hashed and cannot be read back. If it is
          lost, issue another.
        </p>
      </Modal>

      {/* ---------------------------------------------------- person detail */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.full_name ?? ""}
        description={detail ? `${detail.employee_code} · ${ROLE_LABEL[detail.role]}` : undefined}
        wide
        footer={
          detail && canManage ? (
            <>
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                disabled={pending || detail.id === selfId || !detail.active}
                onClick={() => runViewAs(detail)}
              >
                View as this person
              </button>
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                disabled={pending}
                onClick={() => setConfirm({ kind: "reset", row: detail })}
              >
                Reset PIN
              </button>
              <button
                className={`btn btn--sm ${detail.active ? "btn--danger" : "btn--solid"}`}
                type="button"
                disabled={pending || detail.id === selfId}
                onClick={() =>
                  detail.active
                    ? setConfirm({ kind: "deactivate", row: detail })
                    : runActive(detail, true)
                }
              >
                {detail.active ? "Deactivate" : "Reactivate"}
              </button>
            </>
          ) : null
        }
      >
        {detail && (
          <>
            <dl className="ui-dl">
              <dt>Employee code</dt>
              <dd className="mono">{detail.employee_code}</dd>

              <dt>Phone</dt>
              <dd className="mono">{detail.phone ?? "—"}</dd>

              <dt>Joined</dt>
              <dd className="mono">{dateOnly(detail.joined_at ?? detail.created_at)}</dd>

              <dt>State</dt>
              <dd>
                <span className={`cbadge ${detail.active ? "cbadge--on" : "cbadge--off"}`}>
                  {detail.active ? "Active" : "Inactive"}
                </span>
              </dd>

              <dt>PIN</dt>
              <dd>
                {detail.must_change_pin
                  ? "Temporary — they are asked to choose their own on next sign-in"
                  : "Set by the account holder"}
                {detail.pin_reset_at && (
                  <span className="ui-hint" style={{ display: "block" }}>
                    Last reset {dateOnly(detail.pin_reset_at)}
                  </span>
                )}
              </dd>
            </dl>

            {canManage && detail.id !== selfId && (
              <Select
                label="Change role"
                value={detail.role}
                onChange={(next) => runRole(detail, next)}
                options={ROLES}
                disabled={pending}
                hint="Takes effect the next time they load a page."
              />
            )}
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={confirm?.kind === "deactivate"}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && runActive(confirm.row, false)}
        pending={pending}
        danger
        title="Deactivate this account?"
        confirmLabel="Deactivate"
        body={
          confirm
            ? `${confirm.row.full_name} will not be able to sign in. Every shift and punch already recorded for them is kept — nothing is deleted, and they can be reactivated at any time.`
            : ""
        }
      />

      <ConfirmDialog
        open={confirm?.kind === "reset"}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && runReset(confirm.row)}
        pending={pending}
        title="Issue a new PIN?"
        confirmLabel="Issue new PIN"
        body={
          confirm
            ? `${confirm.row.full_name}'s current PIN stops working immediately. The new one is shown once on the next screen — write it down before closing it.`
            : ""
        }
      />
    </>
  );
}
