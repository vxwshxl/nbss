"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Tooltips, with the delay behaviour that makes a toolbar feel fast.
 *
 * The first tooltip waits, so brushing past a control does not fire one. But
 * once one is open, moving to a neighbour should show its label *immediately* —
 * the user has already declared intent, and re-paying the delay for every
 * button in a row is what makes an icon toolbar feel sluggish.
 *
 * Radix's provider gives us the delay skip. What it does not give is skipping
 * the *animation* on those subsequent tooltips: a 150ms scale-in replayed on
 * every neighbour reads as lag even when the content is instant. So the
 * provider tracks whether we are inside the skip window and stamps
 * `data-instant` on the content, which zeroes the duration.
 */

const InstantContext = React.createContext(false);

function TooltipProvider({
  delayDuration = 600,
  skipDelayDuration = 300,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  // Mirrors Radix's own skip window: warm while a tooltip is open, and for
  // `skipDelayDuration` after the last one closes.
  const [instant, setInstant] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (timer.current) clearTimeout(timer.current);
      if (open) {
        setInstant(true);
      } else {
        timer.current = setTimeout(() => setInstant(false), skipDelayDuration);
      }
    },
    [skipDelayDuration],
  );

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    >
      <InstantContext.Provider value={instant}>
        <OpenChangeContext.Provider value={onOpenChange}>
          {children}
        </OpenChangeContext.Provider>
      </InstantContext.Provider>
    </TooltipPrimitive.Provider>
  );
}

const OpenChangeContext = React.createContext<(open: boolean) => void>(() => {});

function Tooltip({
  onOpenChange,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const notify = React.useContext(OpenChangeContext);
  return (
    <TooltipPrimitive.Root
      data-slot="tooltip"
      onOpenChange={(open) => {
        notify(open);
        onOpenChange?.(open);
      }}
      {...props}
    />
  );
}

function TooltipTrigger(
  props: React.ComponentProps<typeof TooltipPrimitive.Trigger>,
) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  const instant = React.useContext(InstantContext);
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        data-instant={instant || undefined}
        sideOffset={sideOffset}
        className={cn(
          // Grows from the trigger, not from its own centre.
          "z-50 w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin)",
          "rounded-md bg-foreground px-2 py-1 text-xs text-balance text-background",
          // 125ms: a label, not an event. Scale from 0.97 — nothing in the real
          // world appears out of nothing.
          "ease-out-strong data-open:duration-125 data-closed:duration-100",
          "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
          "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          // Subsequent tooltips in a row appear with no animation at all.
          "data-instant:duration-0",
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

/**
 * The common case in one element — wrap any control to give it a real tooltip.
 * Keeping this trivial is the point: a native `title` is one attribute, so the
 * replacement has to be about as cheap or call sites will keep reaching for
 * `title` instead.
 */
function Hint({
  label,
  children,
  side = "top",
  align = "center",
  ...props
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  side?: React.ComponentProps<typeof TooltipPrimitive.Content>["side"];
  align?: React.ComponentProps<typeof TooltipPrimitive.Content>["align"];
} & Omit<React.ComponentProps<typeof TooltipPrimitive.Root>, "children">) {
  if (!label) return <>{children}</>;

  // A tooltip is a *description*, not a name: Radix wires it up with
  // aria-describedby, which leaves an icon-only button with no accessible name
  // at all. Where the label is plain text and the child hasn't named itself,
  // borrow it as the name too — otherwise every icon button that gets a tooltip
  // silently becomes an unlabelled button in the a11y tree.
  let trigger = children;
  if (typeof label === "string" && React.isValidElement(children)) {
    const childProps = children.props as {
      "aria-label"?: string;
      "aria-labelledby"?: string;
    };
    if (!childProps["aria-label"] && !childProps["aria-labelledby"]) {
      trigger = React.cloneElement(
        children as React.ReactElement<{ "aria-label"?: string }>,
        { "aria-label": label },
      );
    }
  }

  return (
    <Tooltip {...props}>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side={side} align={align}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Hint };
