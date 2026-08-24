"use client";

import { useId, useMemo, useRef, useState } from "react";

import { Popover } from "./Popover";

/**
 * A calendar, replacing `<input type="date">`.
 *
 * The native control renders a different widget in every browser, cannot be
 * themed at all in Safari, and shows its placeholder as "dd/mm/yyyy" in a font
 * nothing else on the page uses. This is one widget everywhere, in the
 * console's own type and colours.
 *
 * Values are plain `YYYY-MM-DD` strings, matching what the database stores and
 * what `useTableControls` compares — no Date objects cross this boundary,
 * because a Date is a moment in time and a calendar day is not.
 */

const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Local calendar day, not UTC — `toISOString()` would shift IST back a day. */
function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function parseKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function humanise(key: string): string {
  const d = parseKey(key);
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]!.slice(0, 3)} ${d.getFullYear()}`;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Any date",
  min,
  max,
  label,
  hint,
  name,
  clearable = true,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  label?: string;
  hint?: string;
  name?: string;
  clearable?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const fieldId = useId();

  const selected = parseKey(value);
  const [view, setView] = useState(() => selected ?? new Date());

  const todayKey = toKey(new Date());

  /**
   * Six weeks from the Monday on or before the 1st. Always six rows, so the
   * popup does not change height between months and shift the page under the
   * pointer.
   */
  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // Monday-first
    const start = new Date(first);
    start.setDate(first.getDate() - offset);

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [view]);

  const blocked = (key: string) => (min && key < min) || (max && key > max);

  const pick = (d: Date) => {
    const key = toKey(d);
    if (blocked(key)) return;
    onChange(key);
    setOpen(false);
    trigger.current?.focus();
  };

  const shiftMonth = (by: number) =>
    setView((v) => new Date(v.getFullYear(), v.getMonth() + by, 1));

  const control = (
    <>
      <button
        className="ui-select__btn ui-date__btn"
        type="button"
        ref={trigger}
        id={fieldId}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ?? label ?? placeholder}
        onClick={() => {
          if (!open && selected) setView(selected);
          setOpen((o) => !o);
        }}
      >
        <span className={`ui-select__value${value ? "" : " ui-select__value--empty"}`}>
          {value ? humanise(value) : placeholder}
        </span>
        <span className="ui-select__caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {name && <input type="hidden" name={name} value={value} />}

      <Popover anchor={trigger} open={open} onClose={() => setOpen(false)} role="dialog" className="ui-cal">
        <div className="ui-cal__head">
          <button className="ui-cal__nav" type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            ‹
          </button>
          <span className="ui-cal__title">
            {MONTHS[view.getMonth()]} {view.getFullYear()}
          </span>
          <button className="ui-cal__nav" type="button" onClick={() => shiftMonth(1)} aria-label="Next month">
            ›
          </button>
        </div>

        <div className="ui-cal__grid">
          {DOW.map((d, i) => (
            <span className="ui-cal__dow" key={i} aria-hidden="true">
              {d}
            </span>
          ))}

          {days.map((d) => {
            const key = toKey(d);
            const outside = d.getMonth() !== view.getMonth();
            return (
              <button
                key={key}
                className={`ui-cal__day${outside ? " is-muted" : ""}${
                  key === todayKey ? " is-today" : ""
                }${key === value ? " is-on" : ""}`}
                type="button"
                disabled={!!blocked(key)}
                onClick={() => pick(d)}
                aria-label={humanise(key)}
                aria-current={key === todayKey ? "date" : undefined}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>

        <div className="ui-cal__foot">
          <button
            className="btn btn--ghost btn--sm"
            type="button"
            onClick={() => {
              const now = new Date();
              setView(now);
              if (!blocked(todayKey)) pick(now);
            }}
          >
            Today
          </button>
          {clearable && value && (
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              Clear
            </button>
          )}
        </div>
      </Popover>
    </>
  );

  if (!label) return <div className="ui-select">{control}</div>;

  return (
    <div className="ui-field">
      <label className="ui-label" htmlFor={fieldId}>
        {label}
      </label>
      <div className="ui-select">{control}</div>
      {hint && <span className="ui-hint">{hint}</span>}
    </div>
  );
}
