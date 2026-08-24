"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * The anchored surface behind Select, Menu and DatePicker.
 *
 * Portalled and `position: fixed` for one reason: the console's panels and
 * table scroll regions set `overflow`, and any absolutely-positioned popup
 * inside one gets clipped at its edge. Rendering to body and positioning from
 * the trigger's viewport rect avoids that entirely.
 *
 * It flips above the trigger when there is not enough room below, and clamps
 * to the viewport horizontally so a control near the right edge does not open
 * off screen.
 */
export function Popover({
  anchor,
  open,
  onClose,
  children,
  align = "start",
  className = "",
  matchWidth = false,
  labelledBy,
  role = "listbox",
}: {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
  matchWidth?: boolean;
  labelledBy?: string;
  role?: "listbox" | "menu" | "dialog";
}) {
  const surface = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });

  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const trigger = anchor.current;
      const el = surface.current;
      if (!trigger || !el) return;

      const t = trigger.getBoundingClientRect();
      const s = el.getBoundingClientRect();
      const gap = 6;
      const margin = 8;

      const spaceBelow = window.innerHeight - t.bottom;
      const flip = spaceBelow < s.height + gap && t.top > spaceBelow;

      const top = flip ? Math.max(margin, t.top - s.height - gap) : t.bottom + gap;

      let left = align === "end" ? t.right - s.width : t.left;
      left = Math.min(Math.max(margin, left), window.innerWidth - s.width - margin);

      setStyle({
        top,
        left,
        opacity: 1,
        ...(matchWidth ? { minWidth: t.width } : null),
      });
    };

    place();

    // Reposition rather than close on scroll: closing a select because the
    // page moved a pixel under a trackpad is maddening.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchor, align, matchWidth]);

  useEffect(() => {
    if (!open) return;

    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (surface.current?.contains(target) || anchor.current?.contains(target)) return;
      onClose();
    };

    // Pointerdown, not click: a click listener fires after the control under
    // the pointer has already reacted, so the popup would close a beat late.
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, onClose, anchor]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`ui-pop ${className}`}
      style={style}
      ref={surface}
      role={role}
      aria-labelledby={labelledBy}
    >
      {children}
    </div>,
    document.body,
  );
}
