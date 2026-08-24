"use client";

import { useId, useMemo, useRef, useState } from "react";

import { Popover } from "./Popover";

export type Option<T extends string = string> = {
  value: T;
  label: string;
  /** Second line, for a hint the label alone cannot carry. */
  note?: string;
  disabled?: boolean;
};

/**
 * A select built from a button and a listbox.
 *
 * The native element cannot be styled on iOS or Android at all — it renders
 * the platform's own wheel or sheet — so a console meant to look the same on
 * a supervisor's laptop and a guard's phone cannot use one.
 *
 * A hidden input carries the value so this still works inside a plain <form>
 * posting to a server action, with no client state plumbing at the call site.
 */
export function Select<T extends string = string>({
  value,
  onChange,
  options,
  name,
  placeholder = "Select…",
  disabled = false,
  label,
  hint,
  required = false,
  id,
}: {
  value: T | "";
  onChange: (value: T) => void;
  options: Option<T>[];
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  hint?: string;
  required?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const generated = useId();
  const fieldId = id ?? generated;

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const openAt = () => {
    const index = options.findIndex((o) => o.value === value);
    setActive(index >= 0 ? index : 0);
    setOpen(true);
  };

  const commit = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  };

  /** Skips disabled entries so arrowing never parks on an unselectable row. */
  const step = (from: number, direction: 1 | -1) => {
    let next = from;
    for (let i = 0; i < options.length; i++) {
      next = (next + direction + options.length) % options.length;
      if (!options[next]?.disabled) return next;
    }
    return from;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        openAt();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => step(i, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => step(i, -1));
        break;
      case "Home":
        e.preventDefault();
        setActive(step(options.length - 1, 1));
        break;
      case "End":
        e.preventDefault();
        setActive(step(0, -1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(active);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        trigger.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  const control = (
    <>
      <button
        className="ui-select__btn"
        type="button"
        ref={trigger}
        id={fieldId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openAt())}
        onKeyDown={onKeyDown}
      >
        <span className={`ui-select__value${selected ? "" : " ui-select__value--empty"}`}>
          {selected?.label ?? placeholder}
        </span>
        <span className="ui-select__caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {name && <input type="hidden" name={name} value={value} required={required} />}

      <Popover
        anchor={trigger}
        open={open}
        onClose={() => setOpen(false)}
        matchWidth
        labelledBy={fieldId}
      >
        {options.map((option, index) => (
          <button
            key={option.value}
            className={`ui-opt${index === active ? " is-active" : ""}${
              option.value === value ? " is-on" : ""
            }`}
            type="button"
            role="option"
            aria-selected={option.value === value}
            disabled={option.disabled}
            onMouseEnter={() => setActive(index)}
            onClick={() => commit(index)}
          >
            <span>
              {option.label}
              {option.note && <span className="ui-opt__note">{option.note}</span>}
            </span>
            {option.value === value && (
              <span className="ui-opt__tick" aria-hidden="true">
                ✓
              </span>
            )}
          </button>
        ))}
      </Popover>
    </>
  );

  if (!label) return <div className="ui-select">{control}</div>;

  return (
    <div className="ui-field">
      <label className="ui-label" htmlFor={fieldId}>
        {label}
        {required && <span className="ui-req"> *</span>}
      </label>
      <div className="ui-select">{control}</div>
      {hint && <span className="ui-hint">{hint}</span>}
    </div>
  );
}
