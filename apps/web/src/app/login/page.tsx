import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { Wordmark } from "@/components/brand";
import { currentProfile, homeFor } from "@/lib/auth";
import { site } from "@/content/site";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The one sign-in for everybody — administrators, supervisors, guards and
 * clients. Nobody picks a role here: the profile decides where each person
 * lands, so the page only has to ask who they are and to prove it.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const [profile, params] = await Promise.all([currentProfile(), searchParams]);
  if (profile) redirect(homeFor(profile.role));

  return (
    <main
      id="main"
      className="relative min-h-dvh bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
    >
      <section className="flex min-h-dvh flex-col px-5 py-6 sm:px-8 lg:px-14 lg:py-10">
        <Link href="/" aria-label={`${site.shortName} home`} className="w-fit">
          <Wordmark size={38} priority />
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="animate-rise w-full max-w-[400px]">
            <SignInForm from={params.from ?? ""} />
          </div>
        </div>

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary-ink" />
          Secured sign-in
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

      <aside className="relative hidden p-3 lg:block" aria-hidden>
        <div className="sticky top-3 h-[calc(100dvh-1.5rem)] overflow-hidden rounded-3xl bg-[#062b20]">
          <Image
            src="/img/ops-parade.jpg"
            alt=""
            fill
            priority
            sizes="55vw"
            className="object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-[linear-gradient(160deg,rgb(0_145_100/0.55)_0%,rgb(0_60_42/0.75)_55%,rgb(3_22_16/0.95)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 p-12 text-white">
            <div className="mb-6 h-1 w-16 rounded-full bg-brand-gradient" />
            <p className="max-w-lg font-display text-5xl leading-[1.05] font-bold tracking-tight text-balance">
              {site.tagline}
            </p>
            <p className="mt-5 text-sm text-white/70">
              {site.address.city}, {site.address.region} · {site.address.state}
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
}
