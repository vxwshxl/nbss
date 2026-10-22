import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";

import { GateScene } from "@/components/auth/gate-scene";
import { BrandLockup } from "@/components/brand";
import { LoginNibo } from "@/components/nibo/login-nibo";
import { site } from "@/content/site";

/**
 * The frame shared by /login and /register.
 *
 * Wide screens: a night gate on the left (the picture of what the console is
 * for) and the form on the right under the full lockup. Below lg the picture
 * becomes a band at the foot, so a phone opens straight onto the form.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="main"
      className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
    >
      <aside
        aria-hidden
        className="relative hidden flex-col overflow-hidden bg-[#06110d] text-white lg:sticky lg:top-0 lg:flex lg:h-dvh"
      >
        <div className="bg-grid absolute inset-0 opacity-[0.07]" />
        <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_18%_8%,rgb(16_185_129/0.22),transparent_70%),radial-gradient(45%_40%_at_92%_55%,rgb(20_184_166/0.18),transparent_70%)]" />
        <div className="relative p-12 pt-[14svh]">
          <p className="text-sm font-semibold text-emerald-300">On guard tonight</p>
          <p className="mt-4 max-w-lg font-display text-[clamp(2.75rem,4.4vw,4.25rem)] leading-[0.98] font-extrabold tracking-[-0.035em]">
            Your safety, <span className="text-emerald-300">our responsibility.</span>
          </p>
          <p className="mt-5 max-w-sm text-lg text-white/65">
            Attendance at the gate, live posts, SOS and your own site, all in one place.
          </p>
        </div>
        <LoginNibo className="absolute top-[16svh] right-[9%] size-36 xl:size-44" />
        <GateScene className="mt-auto" />
      </aside>

      <section className="flex min-h-dvh flex-col px-5 pt-8 sm:px-10">
        <div className="m-auto w-full max-w-[400px] py-8">
          <Link href="/" aria-label={`${site.shortName} home`} className="mx-auto flex w-fit text-foreground">
            <BrandLockup size="lg" priority />
          </Link>
          <div
            aria-hidden
            className="mx-auto mt-6 h-px w-24 bg-[linear-gradient(90deg,transparent,var(--primary),transparent)]"
          />
          <div className="animate-rise mt-6">{children}</div>
        </div>

        <div aria-hidden className="-mx-5 overflow-hidden rounded-t-[28px] bg-[#06110d] sm:-mx-10 lg:hidden">
          <GateScene className="h-[220px] sm:h-[280px]" />
        </div>

        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 py-5 text-xs text-muted-foreground">
          <Link href="/" className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline">
            <ArrowLeft className="size-3.5" />
            Back to {site.shortName}
          </Link>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <LockKeyhole className="size-3.5 text-primary-ink" />
            Secured sign-in
          </span>
          <span aria-hidden>·</span>
          <Link href="/privacy-policy" className="underline-offset-4 hover:text-foreground hover:underline">
            Privacy
          </Link>
          <span aria-hidden>·</span>
          <Link href="/terms-and-conditions" className="underline-offset-4 hover:text-foreground hover:underline">
            Terms
          </Link>
        </p>
      </section>
    </main>
  );
}
