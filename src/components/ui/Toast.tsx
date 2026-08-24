"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/Icon";

/**
 * Toasts, replacing `alert()`.
 *
 * `alert` blocks the page, cannot be styled, and on a phone looks like a
 * browser security warning — which trains people to dismiss it unread. These
 * announce through an aria-live region instead, so a screen reader hears them
 * without focus moving.
 *
 * Errors do not auto-dismiss. A success message that vanishes is fine; an
 * error that vanishes before it is read means the person never learns what
 * went wrong.
 */

export type ToastKind = "ok" | "error" | "info";

export type Toast = {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
};

type ToastApi = {
  toast: (t: Omit<Toast, "id">) => void;
  ok: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  dismiss: (id: number) => void;
};

const Ctx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>.");
  return api;
}

const ICON: Record<ToastKind, string> = {
  ok: "check",
  error: "close",
  info: "shield-alt",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((list) => [...list, { ...t, id }]);

      if (t.kind !== "error") {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), t.kind === "ok" ? 4000 : 6000),
        );
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      dismiss,
      ok: (title, message) => toast({ kind: "ok", title, message }),
      error: (title, message) => toast({ kind: "error", title, message }),
      info: (title, message) => toast({ kind: "info", title, message }),
    }),
    [toast, dismiss],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="ui-toasts" role="region" aria-label="Notifications">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`ui-toast ui-toast--${t.kind}`}
                role={t.kind === "error" ? "alert" : "status"}
                aria-live={t.kind === "error" ? "assertive" : "polite"}
              >
                <Icon name={ICON[t.kind]} />
                <div className="ui-toast__body">
                  <div className="ui-toast__title">{t.title}</div>
                  {t.message && <p className="ui-toast__msg">{t.message}</p>}
                </div>
                <button className="ui-x" type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                  <Icon name="close" />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}
