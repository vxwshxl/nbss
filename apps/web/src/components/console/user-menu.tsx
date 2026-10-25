"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/ui/initials";

/**
 * The account control in the top-right of the console.
 *
 * The employee code is shown under the name rather than an email address,
 * because for most people on this system the email is a synthetic internal
 * string they have never seen and would not recognise. The code is the thing
 * printed on their card and the thing they typed to get in.
 */
export function UserMenu({
  name,
  code,
  roleLabel,
  photoUrl,
  signOut,
}: {
  name: string;
  code: string;
  roleLabel: string;
  photoUrl?: string | null;
  signOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // The menu's generated ids differ between the server and the browser on some pages,
  // which React reports as a hydration mismatch. The same-looking button is drawn on the
  // server, and the menu attached once the page is running in the browser.
  const inBrowser = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const face = (
    <Avatar className="size-9 ring-2 ring-border">
      {photoUrl && <AvatarImage src={photoUrl} alt="" />}
      <AvatarFallback className="bg-accent-subtle text-xs font-semibold text-primary-ink">{initials(name)}</AvatarFallback>
    </Avatar>
  );
  if (!inBrowser) {
    return (
      <button type="button" className="rounded-full outline-none" aria-label="Account menu">
        {face}
      </button>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30"
          aria-label="Account menu"
        >
          {face}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-2xl border-2 border-border bg-elevated p-1.5 shadow-e3">
        <DropdownMenuLabel className="flex flex-col gap-0.5 px-3 py-2">
          <span className="truncate text-sm font-semibold">{name}</span>
          <span className="truncate text-xs font-normal text-secondary-fg">{code}</span>
          <span className="mt-1.5 w-fit rounded-md bg-accent-subtle px-1.5 py-0.5 text-[11px] font-semibold text-primary-ink">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1 h-0.5 bg-border" />
        <DropdownMenuItem asChild className="rounded-lg px-3 py-2">
          <Link href="/console/profile">
            <UserRound className="size-4" />
            My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1 h-0.5 bg-border" />
        <DropdownMenuItem
          className="rounded-lg px-3 py-2"
          disabled={pending}
          onSelect={(e) => {
            // The menu would otherwise close mid-transition and take the
            // pending state with it, so the item flashes back to "Sign out"
            // while the request is still in flight.
            e.preventDefault();
            startTransition(async () => {
              await signOut();
            });
          }}
        >
          <LogOut className="size-4" />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
