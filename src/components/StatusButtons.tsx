"use client";

import { useTransition } from "react";

import { updateStatus } from "@/app/actions";
import type { Status } from "@/lib/store";

const STATUSES: Status[] = ["new", "contacted", "closed"];

/**
 * Triage controls on a submission. The action revalidates `/admin`, so the
 * badge in the header re-renders from the server rather than from local state
 * that could drift out of sync with the file.
 */
export function StatusButtons({ id, current }: { id: string; current: Status }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="sub__acts">
      {STATUSES.map((status) => (
        <button
          key={status}
          className={`btn btn--xs${status === current ? " is-on" : ""}`}
          type="button"
          disabled={pending || status === current}
          onClick={() => startTransition(() => updateStatus(id, status))}
        >
          {status}
        </button>
      ))}
    </div>
  );
}
