import Link from "next/link";
import { ArrowRight, Building2, LogIn } from "lucide-react";

import { Eyebrow } from "@/components/marketing/blocks";
import { BOOK_HREF, REGISTER_HREF } from "@/content/site";
import { cn } from "@/lib/utils";

/**
 * Where the public quote form used to be.
 *
 * Bookings are made from the client console now, so a request is tied to an
 * account the client can follow it from — reference, survey, quotation, and
 * finally the guards on their gate. This card is the way in: sign in, or
 * create a client account, and land straight on the booking page (with the
 * service already chosen when it came from a service page).
 */
export function BookingCard({ service, className }: { service?: string; className?: string }) {
  const suffix = service ? `?service=${encodeURIComponent(service)}` : "";
  const signIn = service ? `/login?from=${encodeURIComponent(`/console/book${suffix}`)}` : BOOK_HREF;
  const register = service ? `/register?from=${encodeURIComponent(`/console/book${suffix}`)}` : REGISTER_HREF;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-app-line-soft bg-card p-6 shadow-card sm:p-8",
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-brand-gradient opacity-10 blur-2xl" />
      <div className="relative">
        <Eyebrow num="RFQ" text="Book guards" />
        <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-balance">
          Book in two minutes. Follow it until the guards arrive.
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Sign in to request guards for your site. You get a reference, the survey and the
          quotation in one place — and, once deployed, who is on your gate right now.
        </p>

        <div className="mt-7 flex flex-col gap-3">
          <Link
            href={signIn}
            className="press inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-sm transition-[filter] hover:brightness-110"
          >
            <LogIn className="size-4" />
            Sign in to book guards
          </Link>
          <Link
            href={register}
            className="press inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 text-[15px] font-semibold transition-colors hover:bg-muted"
          >
            <Building2 className="size-4" />
            New client? Create an account
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
