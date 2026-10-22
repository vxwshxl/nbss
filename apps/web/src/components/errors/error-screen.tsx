import { ArrowLeft, Phone } from "lucide-react";
import Link from "next/link";

import { BrandLockup } from "@/components/brand";
import { site, tel } from "@/content/site";

/** What each status says, in the desk's words rather than the server's. */
export const ERRORS: Record<number, { title: string; body: string }> = {
  401: { title: "Sign in to continue.", body: "This part of NBSS is for signed-in staff, guards and clients. Sign in with your email or employee code." },
  403: { title: "Not on your access list.", body: "Your account cannot open this page. If you need it for your work, ask an administrator to change your role." },
  404: { title: "This page is not at its post.", body: "The address does not exist here. It may have moved, or the link may have been mistyped." },
  500: { title: "Something went wrong.", body: "The page did not load. Nothing you entered has been lost. Try again in a moment." },
  503: { title: "Back shortly.", body: "NBSS is being updated. Please try again in a few minutes." },
};

/**
 * Every full-page error, as birdev draws its own: the status code filled with a
 * photograph of the guards, plain words, and a way out. `action` replaces the
 * default "Back to home" (a retry, a sign-in).
 */
export function ErrorScreen({ code, action }: { code: number; action?: React.ReactNode }) {
  const e = ERRORS[code] ?? ERRORS[500]!;
  return (
    <main id="main" className="relative isolate grid min-h-svh place-items-center overflow-hidden bg-[#f4f7f5] px-4 py-24 text-center text-ink">
      <div aria-hidden className="blueprint absolute inset-0 -z-10 opacity-60" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_55%_at_50%_45%,rgb(255_255_255/0.95),rgb(244_247_245/0.2))]" />

      <Link href="/" className="absolute top-6 left-1/2 -translate-x-1/2 text-left" aria-label={`${site.shortName} home`}>
        <BrandLockup size="sm" />
      </Link>

      <div className="max-w-xl">
        <p
          className="text-photo display-hero text-[clamp(7rem,26vw,15rem)] leading-[0.85] [filter:contrast(1.15)_saturate(1.1)]"
          style={{ backgroundImage: "url(/img/nbss/parade-salute.jpg)", backgroundSize: "150%", backgroundPosition: "50% 40%" }}
        >
          {code}
        </p>
        <h1 className="display-section mt-4 text-[clamp(1.75rem,4vw,2.75rem)]">{e.title}</h1>
        <p className="mx-auto mt-3 max-w-md text-[17px] text-ink/70">{e.body}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {action ?? (
            <Link href="/" className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium text-ink-fg transition-transform hover:scale-[1.03]">
              <ArrowLeft className="size-4" /> Back to home
            </Link>
          )}
          <Link href="/contact" className="inline-flex h-12 items-center rounded-full border-2 border-border bg-elevated px-6 text-[15px] font-medium hover:bg-subtle">
            Contact us
          </Link>
        </div>
      </div>

      <a href={`tel:${tel(site.phone)}`} className="absolute inset-x-0 bottom-6 mx-auto inline-flex w-fit items-center gap-1.5 text-[13px] text-ink/60 hover:text-ink">
        <Phone className="size-3.5" /> {site.phone}
      </a>
    </main>
  );
}
