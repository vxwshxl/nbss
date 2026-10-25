"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowLeft, ArrowRight, IdCard, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PinInput } from "@/components/ui/pin-input";
import { supabaseBrowser } from "@/lib/supabase/browser";

import { signInAction } from "./actions";
import { initialSignInState, type SignInState } from "./state";

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-5">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * Hands off to Google. The browser client starts the PKCE flow (its verifier
 * goes in a cookie the callback reads) and navigates away, so the button only
 * has to show that something is happening until the page unloads.
 */
function GoogleButton({ from, onError }: { from: string; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    const next = new URL("/auth/callback", window.location.origin);
    if (from) next.searchParams.set("from", from);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: next.toString(), queryParams: { prompt: "select_account" } },
    });
    if (error) {
      setBusy(false);
      onError("Google sign-in could not start. Try again.");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={start}
      disabled={busy}
      className="h-12 w-full rounded-xl text-[15px] font-semibold shadow-sm"
    >
      {busy ? <Loader2 className="size-5 animate-spin" /> : <GoogleMark />}
      Sign in with Google
    </Button>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-11 w-full rounded-xl text-[15px] font-semibold shadow-sm">
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      Sign in
      {!pending && <ArrowRight className="size-4" />}
    </Button>
  );
}

/**
 * The employee code as it is printed: "NBSS-" fixed, the number typed after it. A code
 * from before (TEST-ADMIN) or an email still works: typing a letter, "-" or "@" drops
 * the prefix and the field takes the whole thing as written.
 */
function CodeField({ defaultValue }: { defaultValue?: string }) {
  const initial = (defaultValue ?? "").replace(/^NBSS-/i, "");
  const [value, setValue] = useState(initial);
  const custom = /[^0-9]/.test(value);
  const identifier = custom ? value.trim() : value ? `NBSS-${value}` : "";
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="identifier-input">Employee code</Label>
      <div className="flex h-11 items-center overflow-hidden rounded-xl border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        {!custom && <span className="flex h-full items-center bg-muted px-3.5 font-mono text-[15px] font-semibold tracking-wider text-muted-foreground">NBSS-</span>}
        <input
          id="identifier-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder=""
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode={custom ? "text" : "numeric"}
          required
          autoFocus
          className="h-full min-w-0 flex-1 bg-transparent px-3.5 font-mono text-[15px] tracking-wider outline-none"
        />
      </div>
      <input type="hidden" name="identifier" value={identifier} />
    </div>
  );
}

/** Employee code and PIN, for staff whose login has no Google account. */
function StaffForm({ from, onBack }: { from: string; onBack: () => void }) {
  const [state, action] = useActionState<SignInState, FormData>(signInAction, initialSignInState);

  return (
    <>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="from" value={from} />
        {state.error && <Alert>{state.error}</Alert>}

        <CodeField defaultValue={state.identifier} />

        <div className="flex flex-col gap-2">
          <Label htmlFor="secret">PIN</Label>
          <PinInput
            id="secret"
            name="secret"
            required
            // The fourth digit signs in, as an OTP box does, once the code is there.
            onComplete={(_, input) => {
              const form = input.form;
              if (form && new FormData(form).get("identifier")) form.requestSubmit();
            }}
          />
        </div>

        <div className="mt-1">
          <Submit />
        </div>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Sign in with Google instead
      </button>
    </>
  );
}

export function SignInForm({ from, error }: { from: string; error?: string }) {
  const [staff, setStaff] = useState(false);
  const [googleError, setGoogleError] = useState(error);

  return (
    <div className="w-full">
      <div className="mb-7 text-center [@media(max-height:740px)]:mb-4">
        <h1 className="font-display text-[32px] leading-tight font-extrabold tracking-[-0.025em]">Login</h1>
        {staff && <p className="mt-1.5 text-sm text-muted-foreground">With the employee code and PIN the office gave you.</p>}
      </div>

      {staff ? (
        <StaffForm from={from} onBack={() => setStaff(false)} />
      ) : (
        <div className="flex flex-col gap-4">
          {googleError && <Alert>{googleError}</Alert>}
          <GoogleButton from={from} onError={setGoogleError} />

          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            onClick={() => setStaff(true)}
            className="h-12 w-full rounded-xl text-[15px] font-semibold shadow-sm"
          >
            <IdCard className="size-4" />
            Sign in with employee code
          </Button>
        </div>
      )}
    </div>
  );
}
