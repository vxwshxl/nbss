"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";

import { startImpersonation, stopImpersonation } from "@/app/console/impersonate";
import { Icon } from "@/components/Icon";
import { Popover } from "@/components/ui/Popover";
import { useToast } from "@/components/ui/Toast";
import type { Role } from "@/lib/auth";

export type Person = {
  id: string;
  employee_code: string;
  full_name: string;
  role: Role;
};

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  supervisor: "Supervisor",
  guard: "Guard",
  client: "Client",
};

/** `redirect()` signals by throwing; that throw has to reach Next, not a catch. */
function isRedirect(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

/**
 * The console's top-right controls: who you are, and whose console you are
 * looking at.
 *
 * Two separate menus rather than one, because they answer different questions.
 * "View as" changes what is on screen; the avatar menu is about your own
 * account. Merging them puts a destructive-feeling action next to Sign out.
 */
export function ConsoleHeader({
  name,
  role,
  code,
  isAdmin,
  impersonating,
  realName,
  people,
  signOut,
}: {
  name: string;
  role: Role;
  code: string;
  isAdmin: boolean;
  impersonating: boolean;
  realName: string;
  people: Person[];
  signOut: () => Promise<void>;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();

  const viewAnchor = useRef<HTMLButtonElement>(null);
  const meAnchor = useRef<HTMLButtonElement>(null);

  const [viewOpen, setViewOpen] = useState(false);
  const [meOpen, setMeOpen] = useState(false);
  const [scope, setScope] = useState<Role | "all">("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const map = new Map<Role, number>();
    for (const p of people) map.set(p.role, (map.get(p.role) ?? 0) + 1);
    return map;
  }, [people]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people
      .filter((p) => (scope === "all" ? true : p.role === scope))
      .filter(
        (p) =>
          !q ||
          p.full_name.toLowerCase().includes(q) ||
          p.employee_code.toLowerCase().includes(q) ||
          ROLE_LABEL[p.role].toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [people, scope, query]);

  const view = (id: string) =>
    start(async () => {
      try {
        setViewOpen(false);
        await startImpersonation(id);
      } catch (e) {
        if (isRedirect(e)) throw e;
        toast.error("Could not open that view", e instanceof Error ? e.message : undefined);
      }
    });

  const stop = () =>
    start(async () => {
      try {
        setViewOpen(false);
        await stopImpersonation();
      } catch (e) {
        if (isRedirect(e)) throw e;
        toast.error("Could not return to your own view");
      }
    });

  return (
    <div className="chdr">
      {isAdmin && (
        <>
          <button
            className={`chdr__view${impersonating ? " is-on" : ""}`}
            type="button"
            ref={viewAnchor}
            aria-expanded={viewOpen}
            aria-haspopup="dialog"
            onClick={() => setViewOpen((o) => !o)}
          >
            <Icon name={impersonating ? "user-shield" : "search"} />
            {!impersonating && <span className="chdr__view-lede">View as</span>}
            <strong>{impersonating ? name : "Myself"}</strong>
          </button>

          <Popover
            anchor={viewAnchor}
            open={viewOpen}
            onClose={() => setViewOpen(false)}
            role="dialog"
            className="chdr__pop"
            align="end"
          >
            <div className="chdr__panes">
              <div className="chdr__pane chdr__pane--roles">
                <p className="chdr__pane-h">
                  <Icon name="shield-check" /> View as
                </p>

                <button
                  className={`ui-opt${scope === "all" ? " is-on" : ""}`}
                  type="button"
                  onClick={() => setScope("all")}
                >
                  <span>Everyone</span>
                  <span className="chdr__count">{people.length}</span>
                </button>

                {(["admin", "supervisor", "guard", "client"] as Role[]).map((r) => (
                  <button
                    key={r}
                    className={`ui-opt${scope === r ? " is-on" : ""}`}
                    type="button"
                    onClick={() => setScope(r)}
                  >
                    <span>{ROLE_LABEL[r]}</span>
                    <span className="chdr__count">{counts.get(r) ?? 0}</span>
                  </button>
                ))}

                {impersonating && (
                  <>
                    <div className="ui-menu__sep" />
                    <button className="ui-opt ui-opt--danger" type="button" onClick={stop} disabled={pending}>
                      <span>{pending ? "Returning…" : "Back to my own view"}</span>
                    </button>
                  </>
                )}
              </div>

              <div className="chdr__pane">
                <p className="chdr__pane-h">
                  <Icon name="people" /> Impersonate a user
                </p>

                <div className="ctools__search chdr__search">
                  <Icon name="search" />
                  <input
                    className="ctools__input"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name, code, role…"
                    aria-label="Search people to view as"
                  />
                </div>

                <div className="chdr__list">
                  {matches.length === 0 ? (
                    <p className="ui-hint" style={{ padding: "10px 9px" }}>
                      Nobody matches that.
                    </p>
                  ) : (
                    matches.map((p) => (
                      <button
                        key={p.id}
                        className="ui-opt"
                        type="button"
                        disabled={pending}
                        onClick={() => view(p.id)}
                      >
                        <span>
                          {p.full_name}
                          <span className="ui-opt__note">
                            {ROLE_LABEL[p.role]} · {p.employee_code}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Popover>
        </>
      )}

      <button
        className="chdr__me"
        type="button"
        ref={meAnchor}
        aria-expanded={meOpen}
        aria-haspopup="menu"
        onClick={() => setMeOpen((o) => !o)}
      >
        <span className="chdr__me-text">
          <span className="chdr__me-name">{name}</span>
          <span className="chdr__me-role">{ROLE_LABEL[role]}</span>
        </span>
        <span className="chdr__avatar" aria-hidden="true">
          {initials(name)}
        </span>
      </button>

      <Popover anchor={meAnchor} open={meOpen} onClose={() => setMeOpen(false)} role="menu" align="end">
        <div className="chdr__id">
          <strong>{name}</strong>
          <span className="ui-hint">
            {code} · {ROLE_LABEL[role]}
          </span>
          {impersonating && (
            <span className="ui-hint">Really signed in as {realName}</span>
          )}
        </div>

        <div className="ui-menu__sep" />

        <Link className="ui-opt" href="/console/profile" role="menuitem" onClick={() => setMeOpen(false)}>
          <span>Manage profile</span>
        </Link>

        <form action={signOut}>
          <button className="ui-opt ui-opt--danger" type="submit" role="menuitem" style={{ width: "100%" }}>
            <span>Sign out</span>
          </button>
        </form>
      </Popover>
    </div>
  );
}
