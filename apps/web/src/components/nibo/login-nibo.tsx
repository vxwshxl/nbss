"use client";

import { useEffect, useRef, useState } from "react";

import { Nibo, type NiboEyes, type NiboMood } from "@/components/nibo/nibo";
import { cn } from "@/lib/utils";

/**
 * Nibo on the sign-in picture: he watches the pointer, shuts his eyes while a
 * password or PIN is being typed (one eye peeks if it is shown), cheers when the
 * form goes and looks worried when it comes back with an error.
 */
export function LoginNibo({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [eyes, setEyes] = useState<NiboEyes>("open");
  const [mood, setMood] = useState<NiboMood>("wave");

  useEffect(() => {
    const t = setTimeout(() => setMood("happy"), 2600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const secret = (el: EventTarget | null) =>
      el instanceof HTMLInputElement && (el.type === "password" || el.name === "secret" || el.name === "pin");

    const update = () => {
      let el = document.activeElement;
      // The show/hide toggle sits beside the field; pressing it keeps the field "in use".
      if (el instanceof HTMLButtonElement) el = el.parentElement?.querySelector("input") ?? el;
      if (!(el instanceof HTMLInputElement) || !secret(el)) {
        setEyes("open");
        return;
      }
      setEyes(el.type === "password" ? "closed" : "peek");
    };
    const look = (e: PointerEvent) => {
      const box = ref.current?.getBoundingClientRect();
      if (!box) return;
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = e.clientY - (box.top + box.height * 0.35);
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, len / 260) * 3.2;
      ref.current?.style.setProperty("--nibo-lx", ((dx / len) * k).toFixed(2));
      ref.current?.style.setProperty("--nibo-ly", ((dy / len) * k).toFixed(2));
    };
    const submit = () => {
      setMood("cheer");
      setTimeout(() => setMood("happy"), 1400);
    };
    // A server error drawn into the form (role="alert") gets a worried face.
    const mo = new MutationObserver(() => {
      if (document.querySelector("form [role='alert'], [data-auth-error]")) {
        setMood("oops");
        setTimeout(() => setMood("happy"), 1800);
      }
    });

    document.addEventListener("focusin", update);
    document.addEventListener("focusout", () => setTimeout(update, 0));
    document.addEventListener("input", update, true);
    document.addEventListener("click", () => setTimeout(update, 0), true);
    document.addEventListener("submit", submit, true);
    addEventListener("pointermove", look, { passive: true });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("input", update, true);
      document.removeEventListener("submit", submit, true);
      removeEventListener("pointermove", look);
      mo.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={cn("pointer-events-none", className)}>
      <Nibo uid="login" mood={mood} eyes={eyes} className="size-full drop-shadow-[0_10px_18px_rgba(16,185,129,0.25)]" />
    </div>
  );
}
