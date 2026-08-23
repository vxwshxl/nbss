"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signIn } from "@/app/console/actions";
import { emptySignInState } from "@/app/console/sign-in-state";
import { Icon } from "@/components/Icon";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn--solid" type="submit" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useActionState(signIn, emptySignInState);

  return (
    <div className="clogin">
      <div className="clogin__card">
        <div>
          <div className="clogin__brand">
            <Icon name="shield-check" />
            <span className="csb__mark">NBSS OPERATIONS</span>
          </div>
          <h1 className="clogin__h">Sign in</h1>
          <p className="clogin__lede">
            Use the employee code on your identity card. If you have forgotten your PIN, your
            supervisor can reset it.
          </p>
        </div>

        <form className="clogin__form" action={action}>
          {state.error && (
            <p className="cerror" role="alert">
              <Icon name="close" />
              <span>{state.error}</span>
            </p>
          )}

          <label className="cfield">
            <span className="cfield__l">Employee code</span>
            <input
              className="cfield__i cfield__i--code"
              name="code"
              defaultValue={state.code}
              placeholder="NBSS-041"
              autoComplete="username"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              required
              autoFocus
            />
          </label>

          <label className="cfield">
            <span className="cfield__l">PIN</span>
            <input
              className="cfield__i"
              name="secret"
              type="password"
              autoComplete="current-password"
              // A guard's PIN is digits, so phones should offer the number pad.
              // `inputMode` rather than `type="number"`, which would strip a
              // leading zero and give the field spinner arrows.
              inputMode="numeric"
              required
            />
            <span className="cfield__hint">
              Guards use a 6-digit PIN. Office staff use their passphrase.
            </span>
          </label>

          <div className="clogin__foot">
            <SubmitButton />
            <Link className="clogin__back" href="/">
              Back to the site →
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
