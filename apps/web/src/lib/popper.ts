// Helpers for keeping modal layers (Dialog, Sheet) open while a portalled popper
// (Select, Popover, DropdownMenu) is open.
//
// Radix `Select` is modal and sets `pointer-events: none` on <body>. Because
// `pointer-events` is inherited, the whole dialog becomes non-interactive while
// the menu is open, so a click on empty dialog space hit-tests to <html> — i.e.
// *outside* the dialog — and Radix dismisses the dialog. We guard against that:
// while any popper is open, an outside-interaction must not close the layer.

const POPPER_SELECTORS = [
  '[data-slot="select-content"]',
  '[data-slot="popover-content"]',
  '[data-slot="dropdown-menu-content"]',
  "[data-radix-popper-content-wrapper]",
].join(",");

/** True when the event target sits inside a portalled popper or a toast. */
export function isInPopper(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(`${POPPER_SELECTORS},[data-sonner-toast]`) != null
  );
}

/** True when any popper (select / popover / menu) is currently open. */
export function isAnyPopperOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector(POPPER_SELECTORS) != null;
}

/**
 * Shared guard for a modal layer's outside-interaction handlers. Returns true
 * when the layer should stay open — either the interaction came from a popper,
 * or a popper is open (so the click is meant to dismiss the popper, not us).
 */
export function shouldKeepLayerOpen(target: EventTarget | null): boolean {
  return isInPopper(target) || isAnyPopperOpen();
}
