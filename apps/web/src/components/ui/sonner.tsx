"use client";

import { CheckCircle2, Info, Loader2, TriangleAlert, XCircle } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Toasts in birdev's house style: an ink pill at the foot, with emerald, amber and red icons. */
function Toaster({ position = "bottom-center", ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position={position}
      gap={8}
      offset={20}
      icons={{
        success: <CheckCircle2 className="size-[18px] text-[var(--ds-gold-soft)]" />,
        info: <Info className="size-[18px] text-white/80" />,
        warning: <TriangleAlert className="size-[18px] text-amber-300" />,
        error: <XCircle className="size-[18px] text-[#ff6b60]" />,
        loading: <Loader2 className="size-[18px] animate-spin text-white/80" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-[min(92vw,380px)] items-center gap-3 rounded-2xl bg-ink px-4 py-3.5 text-[14px] text-ink-fg shadow-e3 ring-1 ring-white/10",
          icon: "mt-px shrink-0 self-start",
          content: "min-w-0 flex-1",
          title: "font-medium leading-5",
          description: "mt-0.5 text-[13px] text-ink-fg/70",
          actionButton: "ml-auto rounded-full bg-ink-fg px-3 py-1.5 text-[12px] font-medium text-ink",
          cancelButton: "rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-medium",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
