"use client";

import { useTransition } from "react";

import { Icon } from "@/components/Icon";

/**
 * The band across the top while an admin is viewing as someone else.
 *
 * Deliberately loud and impossible to dismiss. The failure mode of an
 * impersonation feature is forgetting it is on — an admin who thinks they are
 * looking at their own console and finds a guard's empty roster will report a
 * bug that does not exist, or worse, change something believing it is theirs.
 */
export function ImpersonationBar({
  name,
  code,
  role,
  adminName,
  stop,
}: {
  name: string;
  code: string;
  role: string;
  adminName: string;
  stop: () => Promise<void>;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="cimp" role="status">
      <Icon name="user-shield" />
      <p className="cimp__text">
        Viewing as <strong>{name}</strong> <span className="cimp__meta">{code} · {role}</span>
        <span className="cimp__real">You are signed in as {adminName}. Attendance cannot be recorded from this view.</span>
      </p>
      <button
        className="btn btn--sm cimp__stop"
        type="button"
        disabled={pending}
        onClick={() => start(async () => { await stop(); })}
      >
        {pending ? "Returning…" : "Stop viewing"}
      </button>
    </div>
  );
}
