"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { changeOwnPin, updateOwnProfile } from "@/app/console/profile/actions";
import { emptyProfileState } from "@/app/console/profile/profile-state";
import { Icon } from "@/components/Icon";

function Save({ label = "Save changes" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn--solid btn--sm" type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

function Note({ state }: { state: { ok: boolean; error?: string; message?: string } }) {
  if (state.error) {
    return (
      <p className="cerror" role="alert">
        <Icon name="close" />
        <span>{state.error}</span>
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p className="cokay" role="status">
        <Icon name="check" />
        <span>{state.message}</span>
      </p>
    );
  }
  return null;
}

export function DetailsForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [state, action] = useActionState(updateOwnProfile, emptyProfileState);

  return (
    <form className="cform" action={action}>
      <div className="cform__wide">
        <Note state={state} />
      </div>

      <label className="ui-field">
        <span className="ui-label">Full name</span>
        <input className="cfield__i" name="full_name" defaultValue={fullName} required />
      </label>

      <label className="ui-field">
        <span className="ui-label">Phone</span>
        <input className="cfield__i" name="phone" defaultValue={phone} inputMode="tel" />
      </label>

      <div className="cform__foot">
        <Save />
      </div>
    </form>
  );
}

export function PinForm({ isGuard, mustChange }: { isGuard: boolean; mustChange: boolean }) {
  const [state, action] = useActionState(changeOwnPin, emptyProfileState);
  const word = isGuard ? "PIN" : "passphrase";

  return (
    <form className="cform" action={action}>
      <div className="cform__wide">
        {mustChange && !state.ok && (
          <p className="cpunch__hint" style={{ marginBottom: 12 }}>
            This {word} was issued to you by the office. Choose your own — nobody else should know
            how you sign in.
          </p>
        )}
        <Note state={state} />
      </div>

      <label className="ui-field">
        <span className="ui-label">Current {word}</span>
        <input
          className="cfield__i"
          name="current"
          type="password"
          autoComplete="current-password"
          inputMode={isGuard ? "numeric" : undefined}
          required
        />
      </label>

      <div />

      <label className="ui-field">
        <span className="ui-label">New {word}</span>
        <input
          className="cfield__i"
          name="next"
          type="password"
          autoComplete="new-password"
          inputMode={isGuard ? "numeric" : undefined}
          required
        />
        <span className="ui-hint">{isGuard ? "Six to twelve digits." : "At least eight characters."}</span>
      </label>

      <label className="ui-field">
        <span className="ui-label">Repeat new {word}</span>
        <input
          className="cfield__i"
          name="confirm"
          type="password"
          autoComplete="new-password"
          inputMode={isGuard ? "numeric" : undefined}
          required
        />
      </label>

      <div className="cform__foot">
        <Save label={`Change ${word}`} />
      </div>
    </form>
  );
}
