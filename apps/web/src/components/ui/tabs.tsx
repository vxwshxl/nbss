"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        // Segmented control: a full-width track with equal-width segments and
        // a raised active pill. The track is a foreground *tint*, not
        // `bg-muted`: muted (L 0.965) is the same lightness as the console's
        // ambient ground (L 0.966), so on a page — rather than inside a card —
        // the track vanished and the pill floated on nothing. A tint reads on
        // the ground, on a card and in a dialog alike.
        default:
          "w-full gap-1 rounded-xl bg-foreground/5 p-1 ring-1 ring-app-line-soft ring-inset group-data-horizontal/tabs:h-10",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/**
 * Tracks the active trigger's box so the highlight can be clipped to it.
 * Measured rather than computed from an index because the segments are
 * `flex-1` inside a gapped, padded track — the arithmetic version drifts by a
 * pixel or two per tab, which is exactly where this effect stops looking right.
 */
function useActiveTabClip(
  wrapRef: React.RefObject<HTMLDivElement | null>,
  listRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean
) {
  const [clip, setClip] = React.useState<string | null>(null)

  React.useLayoutEffect(() => {
    if (!enabled) return
    const wrap = wrapRef.current
    const list = listRef.current
    if (!wrap || !list) return

    const measure = () => {
      // Radix has used both spellings across versions; accept either.
      const active = list.querySelector<HTMLElement>(
        '[data-state="active"], [data-active]'
      )
      if (!active) return
      const wb = wrap.getBoundingClientRect()
      const ab = active.getBoundingClientRect()
      if (ab.width === 0) return
      const l = Math.max(0, ab.left - wb.left)
      const r = Math.max(0, wb.right - ab.right)
      setClip(`inset(0 ${r}px 0 ${l}px round var(--radius))`)
    }

    measure()
    const mo = new MutationObserver(measure)
    mo.observe(list, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-state", "data-active"],
    })
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    return () => {
      mo.disconnect()
      ro.disconnect()
    }
  }, [wrapRef, listRef, enabled])

  return clip
}

function TabsList({
  className,
  variant = "default",
  sticky = false,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants> & {
    /**
     * Pin the tab bar as the page scrolls. For primary, page-level tabs only.
     *
     * The bar floats as its own frosted panel rather than sitting on a band
     * of page colour. The band (a -50vw `::before` in `bg-background`) was
     * drawn for the old flat white page; on the console's ambient ground it
     * read as a white slab from the sidebar to the content edge, even before
     * anything scrolled. A panel carries its own backdrop, so nothing needs to
     * bleed and nothing can widen the page.
     *
     * `top-3` on desktop because the console topbar only sticks below `lg`
     * (see app-shell) — pinning under a topbar that has scrolled away left a
     * 64px hole above the bar. Below `lg` it clears the sticky topbar.
     */
    sticky?: boolean
  }) {
  const segmented = variant === "default"
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const clip = useActiveTabClip(wrapRef, listRef, segmented)

  const list = (
    <TabsPrimitive.List
      ref={segmented ? listRef : undefined}
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(
        tabsListVariants({ variant }),
        !segmented &&
          sticky &&
          "sticky top-3 z-20 my-1 rounded-2xl bg-card/80 p-1 shadow-card ring-1 ring-app-line-soft backdrop-blur-md max-lg:top-16",
        // A `line` bar is `w-fit`, so six day-tabs simply run off a phone —
        // /timetable pushed the page 374px sideways. Let it scroll instead.
        // Not when sticky: that bar is a padded panel and a scroll container
        // would clip its ring and shadow.
        !segmented && !sticky && "max-w-full overflow-x-auto scrollbar-none",
        className
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  )

  if (!segmented) return list

  return (
    <div
      ref={wrapRef}
      data-slot="tabs-list-wrapper"
      className={cn(
        "relative isolate w-full",
        sticky &&
          "sticky top-3 z-20 my-1 rounded-xl bg-card/80 shadow-card backdrop-blur-md max-lg:top-16"
      )}
    >
      {list}
      {/*
        The selected segment is a clipped duplicate of the whole bar, not a pill
        sliding under live text. Crossfading each label's colour against a moving
        pill never lines up — you see two states overlapping mid-travel. Here the
        colour boundary *is* the clip edge, so a label switches exactly as the
        edge crosses it, which is the one way to make it look like a single
        object moving. Hidden from assistive tech; the real list above owns all
        semantics and focus.
      */}
      <div
        aria-hidden
        data-slot="tabs-list-highlight"
        className={cn(
          tabsListVariants({ variant }),
          "pointer-events-none absolute inset-0 bg-transparent",
          "transition-[clip-path] duration-250 ease-out-strong motion-reduce:transition-none",
          clip === null && "opacity-0"
        )}
        style={clip ? { clipPath: clip } : undefined}
      >
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return null
          const props = child.props as { children?: React.ReactNode }
          return (
            <span
              className={cn(
                "inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5",
                "rounded-lg border border-transparent bg-card px-1.5 py-0.5 shadow-sm ring-1 ring-app-line dark:bg-foreground/15",
                "text-sm font-medium whitespace-nowrap text-foreground",
                "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
              )}
            >
              {props.children}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-lg border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-[color,background-color,box-shadow] duration-150 ease-out-strong group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        // Default variant: the live label goes transparent when active — the
        // raised pill and its label are drawn by the clipped highlight copy in
        // TabsList. Line variant keeps plain foreground text + underline (below).
        "data-active:text-foreground group-data-[variant=default]/tabs-list:rounded-lg group-data-[variant=default]/tabs-list:data-active:bg-transparent group-data-[variant=default]/tabs-list:data-active:text-transparent",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity after:duration-150 after:ease-out-strong group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
