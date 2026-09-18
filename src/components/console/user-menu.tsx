"use client";

import { useState, useTransition } from "react";
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

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-3 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Account"
        >
          <span className="hidden text-right sm:block">
            <span className="block text-sm leading-none font-semibold">{name}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{roleLabel}</span>
          </span>
          <Avatar className="size-9 border border-border">
            {photoUrl && <AvatarImage src={photoUrl} alt="" />}
            <AvatarFallback className="bg-foreground text-xs font-semibold text-background">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">{name}</span>
          <span className="font-mono text-xs font-normal text-muted-foreground">{code}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/console/profile">
            <UserRound className="size-4" />
            My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
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
