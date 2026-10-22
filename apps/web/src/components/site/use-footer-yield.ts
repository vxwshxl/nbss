"use client";

import { useEffect, type RefObject } from "react";

/**
 * Fixed chrome (the header, the WhatsApp button) yields to the footer. Once the footer's top
 * edge (the first [data-nav-stop], i.e. its marquee) climbs to the element, the element is
 * pushed along with it, one-to-one with the scroll, so it leaves with the page instead of
 * floating over a footer that already has the logo and the contact links. Scrolling back
 * brings it back the same way. Ported from SchoolERP's PlatformTopNav.
 * Pass `active: false` while the element must stay put (the header with its menu open).
 */
export function useFooterYield(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    let frame = 0;
    let shift = 0;

    const update = () => {
      frame = 0;
      const stop = document.querySelector("[data-nav-stop]");
      const top = stop ? stop.getBoundingClientRect().top : Infinity;
      // The untranslated bottom: the live rect includes the current shift, so add it back.
      const bottom = el.getBoundingClientRect().bottom - shift;
      const next = Math.min(0, Math.round(top - bottom));
      if (next === shift) return;
      shift = next;
      el.style.transform = shift ? `translate3d(0, ${shift}px, 0)` : "";
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      el.style.transform = "";
    };
  }, [ref, active]);
}
