"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { shouldKeepLayerOpen } from "@/lib/popper"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

/**
 * Keep a centered dialog fully visible when the mobile/tablet on-screen keyboard
 * opens. The keyboard shrinks the *visual* viewport (not the layout viewport on
 * iOS Safari), so a `100dvh`-tall dialog would hide its lower half — including
 * the focused input and footer buttons — behind the keyboard with nothing to
 * scroll. This mirrors the visible area onto CSS vars so the dialog re-centers
 * above the keyboard and caps its height, making the overflow scrollable.
 */
function useVisualViewportFit(ref: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const vv = window.visualViewport
    const el = ref.current
    if (!vv || !el) return
    const update = () => {
      el.style.setProperty("--dialog-top", `${vv.offsetTop + vv.height / 2}px`)
      el.style.setProperty("--dialog-max-h", `${vv.height - 32}px`)
    }
    update()
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
    }
  }, [ref])
}

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-(color:--scrim) ease-out-strong data-open:duration-200 data-closed:duration-150 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onPointerDownOutside,
  onInteractOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  useVisualViewportFit(contentRef)
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={contentRef}
        data-slot="dialog-content"
        onPointerDownOutside={(e) => {
          if (shouldKeepLayerOpen(e.target)) e.preventDefault()
          onPointerDownOutside?.(e)
        }}
        onInteractOutside={(e) => {
          if (shouldKeepLayerOpen(e.target)) e.preventDefault()
          onInteractOutside?.(e)
        }}
        className={cn(
          // pointer-events-auto! : an open Select is a higher dismissable layer,
          // so Radix sets an *inline* `pointer-events: none` on this (lower)
          // dialog content. Only an !important rule overrides that inline style;
          // without it, clicks inside the dialog hit-test to <html> and dismiss
          // it. Keeping the dialog interactive lets the dropdown close on its own.
          // max-h + overflow-y-auto: on short viewports the dialog must never
          // exceed the screen and hide its footer buttons — it caps at the
          // viewport (minus a 1rem gutter each side) and scrolls internally.
          // The `--dialog-top` / `--dialog-max-h` vars (set by useVisualViewportFit)
          // track the on-screen keyboard so the dialog re-centers above it and
          // shrinks to stay scrollable; they fall back to a static centered layout.
          "pointer-events-auto! fixed top-[var(--dialog-top,50%)] left-1/2 z-50 grid max-h-[var(--dialog-max-h,calc(100dvh-2rem))] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto overscroll-contain rounded-2xl border border-app-line-soft bg-popover p-5 text-sm text-popover-foreground shadow-raised ease-out-strong outline-none data-open:duration-200 data-closed:duration-150 sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            {/* top-4 on a p-5 surface centres the 28px button on the title's
                first line, so the X sits beside the heading, not in the corner. */}
            <Button
              variant="ghost"
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 pr-8", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-5 -mb-5 flex flex-col-reverse gap-2 rounded-b-2xl border-t border-app-line-soft bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-snug font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
