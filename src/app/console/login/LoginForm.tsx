"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowLeft, LogIn, ShieldCheck } from "lucide-react";

import { signIn } from "@/app/console/actions";
import { emptySignInState } from "@/app/console/sign-in-state";
import { Mark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { site } from "@/content/site";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      <LogIn data-icon="inline-start" />
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

/**
 * The one door into the console.
 *
 * Two panels on a wide screen and one on a phone, and the split is not
 * decoration: the left panel is the only thing on this screen that tells
 * someone standing at a gate in the rain that they are in the right place and
 * that the fence is why they are being asked. On a phone that panel is dropped
 * entirely rather than stacked — it would push the two fields below the fold,
 * and the fields are the whole point.
 */
export function LoginForm() {
  const [state, action] = useActionState(signIn, emptySignInState);

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* The brand side. Hidden below lg — see above. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-foreground p-10 text-background lg:flex">
        <div
          aria-hidden
          className="bg-grid pointer-events-none absolute inset-0 opacity-[0.07]"
        />
        <div className="relative flex items-center gap-3">
          <Mark size={40} priority />
          <span className="font-display text-lg font-bold tracking-tight">
            {site.shortName}
          </span>
        </div>

        <div className="relative max-w-md">
          <div className="aronai mb-8 w-28 text-primary" role="presentation" aria-hidden />
          <h2 className="font-display text-4xl leading-[1.1] font-bold tracking-tight text-balance">
            {site.tagline}
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-background/70">
            Attendance here is recorded against a geofence at the site itself, not
            against a signature in a register. What this console shows is where
            people actually were.
          </p>
        </div>

        <p className="relative text-xs text-background/50">
          {site.address.city}, {site.address.region} · {site.address.state}
        </p>
      </aside>

      {/* The form side. */}
      <main
        id="main"
        className="bg-app-ground flex flex-col items-center justify-center px-5 py-12"
      >
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary lg:hidden">
              <ShieldCheck className="size-6" strokeWidth={1.9} />
            </span>
            <h1 className="font-display text-3xl font-bold tracking-tight">Sign in</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Use the employee code printed on your identity card. If you have
              forgotten your PIN, your supervisor can reset it.
            </p>
          </div>

          <form action={action} className="flex flex-col gap-5">
            {state.error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Employee code</Label>
              <Input
                id="code"
                name="code"
                defaultValue={state.code}
                placeholder="NBSS-041"
                autoComplete="username"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                required
                autoFocus
                className="font-mono tracking-wider uppercase"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="secret">PIN</Label>
              <PasswordInput
                id="secret"
                name="secret"
                autoComplete="current-password"
                // A guard's PIN is digits, so phones should offer the number
                // pad. `inputMode` rather than `type="number"`, which would
                // strip a leading zero and add spinner arrows to a secret.
                inputMode="numeric"
                required
              />
              <p className="text-xs text-muted-foreground">
                Guards use a 6-digit PIN. Office staff use their passphrase.
              </p>
            </div>

            <SubmitButton />
          </form>

          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to the website
          </Link>
        </div>
      </main>
    </div>
  );
}
