import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Phone, ShieldOff } from "lucide-react";

import { site, tel } from "@/content/site";

import { AuthShell } from "../login/auth-shell";

export const metadata: Metadata = { title: "Account inactive", robots: { index: false } };

/**
 * Where a sign-in lands when the name and mobile are right but an administrator has
 * switched the account off. Said plainly, with the office's number, instead of
 * "no account matches", which would send the person to check their spelling.
 */
export default function AccountInactivePage() {
  return (
    <AuthShell>
      <div className="animate-in fade-in-0 slide-in-from-bottom-4 text-center duration-500 ease-out">
        <div className="relative mx-auto grid size-20 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/20 [animation-duration:2.4s]" />
          <span className="relative grid size-20 place-items-center rounded-full bg-amber-100 text-amber-700 ring-8 ring-amber-50">
            <ShieldOff className="size-9" strokeWidth={1.75} />
          </span>
        </div>
        <span className="mt-6 inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Account inactive</span>
        <h1 className="mt-3 font-display text-[30px] leading-tight font-extrabold tracking-[-0.025em]">This account is switched off</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Your NBSS account is inactive, so the app and the console are closed to it. Contact the NBSS administrator to switch it back on.
          Your duties and attendance are kept safe.
        </p>

        <a
          href={`tel:${tel(site.phone)}`}
          className="press mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient-strong text-[15px] font-semibold text-white shadow-sm"
        >
          <Phone className="size-5" />
          Call the office · {site.phone}
        </a>
        <Link
          href="/login"
          className="press mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-app-line text-sm font-semibold text-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
