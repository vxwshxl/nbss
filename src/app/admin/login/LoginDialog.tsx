"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signIn } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { FormProvider } from "@/components/forms/FormContext";
import { SubmitButton, TextField } from "@/components/forms/fields";
import { emptyFormState } from "@/lib/validate";

/**
 * The sign-in popup.
 *
 * It is a page rather than a dialog opened over the inbox, because there is no
 * inbox to open it over until the credentials are accepted — the middleware
 * redirects here before `/admin` renders at all. What it borrows from a modal
 * is the presentation: the site's own chrome sits blurred behind it, so the
 * prompt reads as part of NBSS rather than as part of the browser.
 *
 * `<dialog>` is deliberately not used. Its modal behaviour only exists once
 * `showModal()` has run, which would make the form dependent on JavaScript,
 * and this form has to submit without it — the action is a plain server action
 * and the markup below is a plain `<form>`.
 */
export function LoginDialog({ from }: { from?: string }) {
  const [state, action] = useActionState(signIn, emptyFormState);

  return (
    <div className="lock">
      <div className="lock__veil" aria-hidden="true" />

      <FormProvider state={state}>
        <form
          className="dialog"
          action={action}
          noValidate
          role="dialog"
          aria-modal="true"
          aria-labelledby="lock-title"
        >
          <p className="eyebrow">
            <span className="eyebrow__num">OPS</span>
            <span className="eyebrow__rule" />
            Restricted
          </p>

          <span className="dialog__ico">
            <Icon name="key" />
          </span>

          <h1 className="dialog__t" id="lock-title">
            Operations sign-in.
          </h1>
          <p className="dialog__lede">
            The submissions inbox holds names and phone numbers given to us in confidence. It is
            not part of the public site.
          </p>

          {state.errors.form && (
            <p className="form-note form-note--error" role="alert">
              {state.errors.form}
            </p>
          )}

          <div className="dialog__fields">
            <TextField
              name="user"
              label="Operator"
              required
              autoComplete="username"
              autoFocus
              maxLength={80}
              spellCheck={false}
              autoCapitalize="none"
            />
            <TextField
              name="pass"
              label="Passphrase"
              type="password"
              required
              autoComplete="current-password"
              maxLength={200}
            />
          </div>

          {/* Carried through the round trip so a deep link survives sign-in. */}
          <input type="hidden" name="from" value={from ?? "/admin"} />

          <div className="dialog__foot">
            <SubmitButton idle="Sign in" busy="Checking…" />
            <Link className="dialog__back" href="/">
              Back to the public site
              <Icon name="arrow" />
            </Link>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
