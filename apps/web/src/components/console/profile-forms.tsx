"use client";

import { PhoneInput } from "@/components/ui/phone-input";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { updateOwnProfile } from "@/app/console/profile/actions";
import { emptyProfileState } from "@/app/console/profile/profile-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Save({ label = "Save changes" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/**
 * The outcome of a form action.
 *
 * Rendered inline rather than raised as a toast: a toast is right for something
 * that happened elsewhere on the page, and wrong for the result of the form you
 * are still looking at — it appears at the top of the screen, away from the
 * field that caused it, and is gone before a slow reader finds it.
 */
function Note({ state }: { state: { ok: boolean; error?: string; message?: string } }) {
  if (state.error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <span>{state.error}</span>
      </div>
    );
  }
  if (state.ok && state.message) {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm text-primary"
      >
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        <span>{state.message}</span>
      </div>
    );
  }
  return null;
}

export function DetailsForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [state, action] = useActionState(updateOwnProfile, emptyProfileState);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Note state={state} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" defaultValue={fullName} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Phone</Label>
        <PhoneInput id="phone" name="phone" defaultValue={phone} />
      </div>

      <div className="sm:col-span-2">
        <Save />
      </div>
    </form>
  );
}
