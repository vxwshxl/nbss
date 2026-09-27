"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { registerAction } from "./actions";
import { initialRegisterState, type RegisterState } from "./state";

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
      {mine && <Loader2 className="size-4 animate-spin" />}
      {children}
      {!mine && <ArrowRight className="size-4" />}
    </Button>
  );
}

function Resend({ sentAt }: { sentAt?: number }) {
  const { pending } = useFormStatus();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = sentAt ? Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000)) : 0;
  return (
    <button
      type="submit"
      name="intent"
      value="resend"
      formNoValidate
      disabled={left > 0 || pending}
      className="font-medium text-primary-ink underline-offset-4 enabled:hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground"
    >
      {left > 0 ? `Resend in ${left}s` : "Resend code"}
    </button>
  );
}

function Field({
  id,
  label,
  optional,
  ...props
}: React.ComponentProps<typeof Input> & { id: string; label: string; optional?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>
      <Input id={id} name={id} className="h-11 rounded-xl text-[15px]" {...props} />
    </div>
  );
}

export function RegisterForm({ from }: { from: string }) {
  const [state, action] = useActionState<RegisterState, FormData>(registerAction, initialRegisterState);
  const [step, setStep] = useState(state.step);
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    setStep(state.step);
  }
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step, state]);

  const v = state.values;

  return (
    <div className="w-full">
      <div className="mb-7">
        <h1 className="font-display text-[28px] leading-tight font-bold tracking-tight">
          {step === "code" ? "Check your email" : "Create a client account"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {step === "code"
            ? `Enter the 6-digit code we sent to ${v.email}.`
            : "Book guards and follow your deployment in one place."}
        </p>
      </div>

      <form action={action} className="flex flex-col gap-4" noValidate={step === "code"}>
        <input type="hidden" name="from" value={from} />

        {state.error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}
        {!state.error && state.notice && step === "code" && (
          <div role="status" className="rounded-xl border border-primary/20 bg-accent px-3 py-2.5 text-sm text-accent-foreground">
            {state.notice}
          </div>
        )}

        {/* The details stay in the form on the code step, hidden, so a resend
            or a verify carries exactly what was typed. */}
        <div className={cn("flex flex-col gap-4", step === "code" && "hidden")}>
          <Field id="fullName" label="Your name" defaultValue={v.fullName} autoComplete="name" required autoFocus />
          <Field
            id="organisation"
            label="Organisation"
            optional
            defaultValue={v.organisation}
            autoComplete="organization"
            placeholder="Company, school, bank branch…"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="phone" label="Mobile" defaultValue={v.phone} inputMode="tel" autoComplete="tel" placeholder="98640 12345" required />
            <Field
              id="email"
              label="Email"
              type="email"
              defaultValue={v.email}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@company.com"
              required
            />
          </div>
        </div>

        {step === "code" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">Verification code</Label>
            <Input
              ref={codeRef}
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
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

        <div className="mt-1">
          {step === "details" ? (
            <Submit intent="send">Continue</Submit>
          ) : (
            <Submit intent="verify">Verify and continue</Submit>
          )}
        </div>
      </form>

      {step === "code" ? (
        <button
          type="button"
          onClick={() => setStep("details")}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Edit my details
        </button>
      ) : (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={`/login${from ? `?from=${encodeURIComponent(from)}` : ""}`}
            className="font-semibold text-primary-ink underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
