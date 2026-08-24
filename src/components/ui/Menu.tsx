"use client";

import { useRef, useState, type ReactNode } from "react";

import { Popover } from "./Popover";

export type MenuEntry =
  | { kind: "item"; label: string; onSelect: () => void; danger?: boolean; disabled?: boolean; note?: string }
  | { kind: "separator" }
  | { kind: "label"; label: string };

/**
 * A dropdown menu of actions.
 *
 * Distinct from Select: a Select holds a value, a Menu fires commands. They
 * look similar and behave differently, so keeping them apart stops "choose an
 * option" and "do a thing" from drifting into one ambiguous control.
 */
export function Menu({
  trigger,
  entries,
  align = "end",
  label = "Actions",
}: {
  trigger: (props: { ref: React.Ref<HTMLButtonElement>; onClick: () => void; "aria-expanded": boolean }) => ReactNode;
  entries: MenuEntry[];
  align?: "start" | "end";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);

  const run = (entry: Extract<MenuEntry, { kind: "item" }>) => {
    if (entry.disabled) return;
    setOpen(false);
    // Let the popup unmount before the action runs, so a handler that opens a
    // dialog does not fight this one for focus.
    queueMicrotask(entry.onSelect);
  };

  return (
    <>
      {trigger({
        ref: anchor,
        onClick: () => setOpen((o) => !o),
        "aria-expanded": open,
      })}

      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} align={align} role="menu">
        <div aria-label={label}>
          {entries.map((entry, i) => {
            if (entry.kind === "separator") return <div className="ui-menu__sep" key={i} />;
            if (entry.kind === "label")
              return (
                <div className="ui-menu__label" key={i}>
                  {entry.label}
                </div>
              );

            return (
              <button
                key={i}
                className={`ui-opt${entry.danger ? " ui-opt--danger" : ""}`}
                type="button"
                role="menuitem"
                disabled={entry.disabled}
                onClick={() => run(entry)}
              >
                <span>
                  {entry.label}
                  {entry.note && <span className="ui-opt__note">{entry.note}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </Popover>
    </>
  );
}
