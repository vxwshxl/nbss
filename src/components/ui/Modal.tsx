"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/Icon";

/**
 * A dialog, rendered into document.body.
 *
 * Portalled rather than rendered in place because the console shell has
 * `overflow` and `position: sticky` on the sidebar and panels; a dialog
 * rendered inside one would be clipped by it.
 *
 * Focus is trapped while open and returned to whatever opened it on close,
 * which is what makes the whole thing usable without a mouse — and what a
 * native <dialog> would give for free if it were stylable enough to use here.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide = false,
  closeLabel = "Close",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  closeLabel?: string;
}) {
  const titleId = useId();
  const descId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;

    // The page behind must not scroll while a dialog is over it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus in, preferring the first control over the panel itself.
    const first = panel.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-close]), [tabindex]:not([tabindex="-1"])',
    );
    (first ?? panel.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== "Tab" || !panel.current) return;

      // Cycle focus within the panel rather than letting it escape to the page
      // behind, which is still rendered and still full of tabbable controls.
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);

    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previous;
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="ui-scrim" onClick={onClose} aria-hidden="true" />
      <div className="ui-modal-wrap" role="presentation">
        <div
          className={`ui-modal${wide ? " ui-modal--wide" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          ref={panel}
          tabIndex={-1}
        >
          <header className="ui-modal__head">
            <div>
              <h2 className="ui-modal__title" id={titleId}>
                {title}
              </h2>
              {description && (
                <p className="ui-modal__sub" id={descId}>
                  {description}
                </p>
              )}
            </div>
            <button className="ui-x" type="button" onClick={onClose} aria-label={closeLabel} data-close>
              <Icon name="close" />
            </button>
          </header>

          <div className="ui-modal__body">{children}</div>

          {footer && <footer className="ui-modal__foot">{footer}</footer>}
        </div>
      </div>
    </>,
    document.body,
  );
}

/**
 * Confirmation, replacing `window.confirm`.
 *
 * The native one blocks the whole page, cannot say which record it is about,
 * and looks like a browser warning rather than part of the application — which
 * teaches people to dismiss it without reading.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Confirm",
  danger = false,
  pending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  pending?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn btn--ghost btn--sm" type="button" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button
            className={`btn btn--sm ${danger ? "btn--danger" : "btn--solid"}`}
            type="button"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 14, color: "var(--paper-dim)", lineHeight: 1.55 }}>{body}</p>
    </Modal>
  );
}
