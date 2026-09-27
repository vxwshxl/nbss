"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, Building2, KeyRound, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";

import { signInAction } from "./actions";
import { initialSignInState, type SignInState } from "./state";

const RESEND_SECONDS = 30;

function Submit({ intent, children }: { intent: string; children: React.ReactNode }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("intent") === intent;
  return (
    <Button
      type="submit"
      name="intent"
      value={intent}
      disabled={pending}
      className="h-11 w-full rounded-xl text-[15px] font-semibold shadow-sm"
    >
      {mine ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
      {!mine && <ArrowRight className="size-4" />}
    </Button>
  );
}

function Resend({ sentAt }: { sentAt?: number }) {
  const { pending, data } = useFormStatus();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = sentAt ? Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000)) : 0;
  const sending = pending && data?.get("intent") === "resend";

  return (
    <button
      type="submit"
      name="intent"
      value="resend"
      formNoValidate
      disabled={left > 0 || pending}
      className="font-medium text-primary-ink underline-offset-4 enabled:hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground"
    >
      {sending ? "Sending…" : left > 0 ? `Resend in ${left}s` : "Resend code"}
    </button>
  );
}

function Alert({ tone, children }: { tone: "error" | "notice"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm",
        tone === "error"
          ? "border-destructive/25 bg-destructive/5 text-destructive"
          : "border-primary/20 bg-accent text-accent-foreground",
      )}
    >
      {tone === "error" && <AlertCircle className="mt-0.5 size-4 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

export function SignInForm({ from }: { from: string }) {
  const [state, action] = useActionState<SignInState, FormData>(signInAction, initialSignInState);
  // The server decides the step after each submit; switching between "code"
  // and "password" is a local choice that needs no round trip.
  const [step, setStep] = useState(state.step);
  const [identifier, setIdentifier] = useState(state.identifier);
  const codeRef = useRef<HTMLInputElement>(null);

  // Adopt the server's answer once per submit, during render rather than in an
  // effect, so the step never paints stale for a frame.
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    setStep(state.step);
    setIdentifier(state.identifier);
  }

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step, state]);

  const heading =
    step === "code"
      ? { title: "Check your email", sub: "Enter the 6-digit code we sent you." }
      : step === "password"
        ? { title: "Enter your password", sub: "Your password or PIN." }
        : { title: "Sign in", sub: "Welcome back. Continue with your email or employee code." };

  return (
    <div className="w-full">
      <div className="mb-7">
        <h1 className="font-display text-[28px] leading-tight font-bold tracking-tight">
          {heading.title}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{heading.sub}</p>
      </div>

      <form id="sign-in" action={action} className="flex flex-col gap-4" noValidate={step !== "identify"}>
        <input type="hidden" name="from" value={from} />

        {state.error && <Alert tone="error">{state.error}</Alert>}
        {!state.error && state.notice && step === "code" && (
          <Alert tone="notice">{state.notice}</Alert>
        )}

        {step === "identify" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="identifier">Email or employee code</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="identifier"
                name="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                autoFocus
                className="h-11 rounded-xl pl-10 text-[15px]"
              />
            </div>
          </div>
        ) : (
          <>
            <input type="hidden" name="identifier" value={identifier} />
            <div className="flex items-center justify-between gap-3 rounded-xl border border-app-line bg-muted/50 py-2 pr-2 pl-3.5">
              <span className="min-w-0 truncate text-sm font-medium">{identifier}</span>
              <button
                type="button"
                onClick={() => setStep("identify")}
                className="press shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-primary-ink hover:bg-accent"
              >
                Change
              </button>
            </div>
          </>
        )}

        {step === "code" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">Verification code</Label>
            <Input
              ref={codeRef}
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="••••••"
              onChange={(e) => {
                e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 6);
                if (e.currentTarget.value.length === 6) e.currentTarget.form?.requestSubmit();
              }}
              className="h-14 rounded-xl text-center font-mono text-2xl font-semibold tracking-[0.5em] placeholder:tracking-[0.5em]"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Didn&apos;t get it?</span>
              <Resend sentAt={state.sentAt} />
            </div>
          </div>
        )}

        {step === "password" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="secret">Password or PIN</Label>
            <PasswordInput
              id="secret"
              name="secret"
              autoComplete="current-password"
              autoFocus
              className="h-11 rounded-xl text-[15px]"
            />
          </div>
        )}

        <div className="mt-1">
          {step === "identify" && <Submit intent="send">Continue</Submit>}
          {step === "code" && <Submit intent="verify">Verify and sign in</Submit>}
          {step === "password" && <Submit intent="password">Sign in</Submit>}
        </div>
      </form>

      <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="mt-6">
        {step === "password" ? (
          // Keyed apart from the button below: React would otherwise reuse the
          // one DOM node and flip it to type="submit" mid-click, and the
          // browser would then submit the form the click was only switching.
          <Button
            key="send-code"
            type="submit"
            form="sign-in"
            name="intent"
            value="send"
            variant="outline"
            formNoValidate
            className="h-11 w-full rounded-xl text-[15px]"
          >
            <Mail className="size-4" />
            Email me a code instead
          </Button>
        ) : (
          <Button
            key="use-password"
            type="button"
            variant="outline"
            onClick={() => setStep("password")}
            disabled={!identifier.trim()}
            className="h-11 w-full rounded-xl text-[15px]"
          >
            <KeyRound className="size-4" />
            Use password or PIN
          </Button>
        )}
      </div>

      {step === "identify" && (
        // The door for people who do not work here yet: a business that wants
        // guards. Every "Book guards" button on the website lands on this page,
        // so the way in for a first-time client has to be impossible to miss.
        <div className="mt-8 rounded-2xl border border-app-line bg-brand-gradient-soft p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/80 text-primary-ink shadow-xs">
              <Building2 className="size-5" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-accent-foreground">New client?</p>
              <p className="text-xs text-accent-foreground/80">Book trained guards for your site.</p>
            </div>
          </div>
          <Button asChild className="mt-3 h-10 w-full rounded-xl text-sm font-semibold">
            <Link href={`/register${from ? `?from=${encodeURIComponent(from)}` : "?from=/console/book"}`}>
              Create a client account
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      )}

      {step !== "identify" && (
        <button
          type="button"
          onClick={() => setStep("identify")}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Use a different account
        </button>
      )}
    </div>
  );
}
