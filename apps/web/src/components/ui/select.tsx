"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon, SearchIcon } from "lucide-react"

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

/**
 * Search inside a dropdown.
 *
 * Any list longer than a handful gets a search field on top — the roster's
 * guard picker, the site picker and the service list are all long enough that
 * scrolling for a name is slower than typing two letters of it. Items stay
 * mounted and are only hidden, so the trigger keeps showing the chosen value.
 */
const SEARCH_AFTER = 6

const SelectSearchContext = React.createContext("")

/** The readable text of an item's children, for matching. */
function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(" ")
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children)
  return ""
}

/** Every SelectItem's search text, however deeply grouped. */
function itemTexts(children: React.ReactNode): string[] {
  const out: string[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<{ children?: React.ReactNode; textValue?: string; description?: React.ReactNode }>(child)) return
    if (child.type === SelectItem)
      out.push((child.props.textValue ?? `${textOf(child.props.children)} ${textOf(child.props.description)}`).toLowerCase())
    else out.push(...itemTexts(child.props.children))
  })
  return out
}

function matches(text: string, query: string) {
  return query.split(/\s+/).every((word) => text.includes(word))
}

function SelectContent({
  className,
  children,
  position = "item-aligned",
  align = "center",
  searchable,
  searchPlaceholder = "Search…",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content> & {
  /** Force the search field on or off. By default it appears past six options. */
  searchable?: boolean
  searchPlaceholder?: string
}) {
  const [query, setQuery] = React.useState("")
  const input = React.useRef<HTMLInputElement>(null)
  const texts = itemTexts(children)
  const show = searchable ?? texts.length > SEARCH_AFTER
  const q = query.trim().toLowerCase()
  const none = show && q !== "" && !texts.some((t) => matches(t, q))
  // A searchable list opens below its trigger: aligning the chosen item over
  // the trigger would move the list every time the filter changes its height.
  const place = show ? "popper" : position

  /**
   * The field mounts each time the list opens (this wrapper does not — Radix
   * keeps it alive between openings), so focus is taken here, after Radix has
   * positioned the list and moved focus to the chosen item.
   */
  const attach = React.useCallback((node: HTMLInputElement | null) => {
    input.current = node
    if (node) setTimeout(() => node.isConnected && node.focus(), 80)
  }, [])

  /**
   * Typing anywhere in the open list goes to the search field. Radix composes
   * its own handlers after this one and skips them once default is prevented,
   * so its jump-to-letter behaviour never fights the filter.
   */
  function onContentKey(e: React.KeyboardEvent<HTMLDivElement>) {
    props.onKeyDown?.(e)
    if (!show || e.defaultPrevented || e.target === input.current) return
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      setQuery((prev) => prev + e.key)
      input.current?.focus()
    } else if (e.key === "Backspace") {
      e.preventDefault()
      setQuery((prev) => prev.slice(0, -1))
      input.current?.focus()
    }
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Escape" || e.key === "Tab") return
    if (e.key === "Enter") {
      e.preventDefault()
      // Enter picks the first match, as a search box should.
      const first = e.currentTarget
        .closest("[data-slot=select-content]")
        ?.querySelector<HTMLElement>("[data-slot=select-item]:not([hidden]):not([data-disabled])")
      if (first) {
        first.focus()
        first.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
      }
      return
    }
    // Everything else is typing — keep it away from Radix's type-ahead.
    e.stopPropagation()
  }

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        data-align-trigger={place === "item-aligned"}
        className={cn("relative z-50 max-h-(--radix-select-content-available-height) min-w-36 origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-xl bg-popover text-popover-foreground shadow-raised ring-1 ring-app-line ease-out-strong data-open:duration-200 data-closed:duration-150 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", place ==="popper"&&"data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1", show && "max-h-[min(24rem,var(--radix-select-content-available-height))]", className )}
        position={place}
        align={show ? "start" : align}
        {...props}
        onKeyDown={onContentKey}
        onCloseAutoFocus={(e) => {
          props.onCloseAutoFocus?.(e)
          // A fresh list next time.
          setQuery("")
        }}
      >
        {show && (
          <div data-slot="select-search" className="sticky top-0 z-20 border-b border-app-line-soft bg-popover p-1.5">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={attach}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder={searchPlaceholder}
                aria-label="Search the list"
                autoComplete="off"
                className="h-8 w-full rounded-lg border border-input bg-background pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          </div>
        )}
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          data-position={place}
          className={cn(
            "data-[position=popper]:h-(--radix-select-trigger-height) data-[position=popper]:w-full data-[position=popper]:min-w-(--radix-select-trigger-width)",
            show && "data-[position=popper]:h-auto"
          )}
        >
          <SelectSearchContext.Provider value={q}>{children}</SelectSearchContext.Provider>
          {none && <p className="px-2 py-3 text-center text-sm text-muted-foreground">No matches for “{query.trim()}”</p>}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("px-1.5 py-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  description,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item> & {
  /** A quiet note beside the option, shown in the list but not in the trigger. */
  description?: React.ReactNode
}) {
  const query = React.useContext(SelectSearchContext)
  const hidden =
    query !== "" && !matches((props.textValue ?? `${textOf(children)} ${textOf(description)}`).toLowerCase(), query)
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      hidden={hidden}
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="pointer-events-none" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon
      />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon
      />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
