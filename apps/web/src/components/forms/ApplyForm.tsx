"use client";

import { useActionState, useEffect, useRef } from "react";

import { submitApplication } from "@/app/actions";
import { emptyFormState } from "@/lib/validate";
import { educationOptions, type Vacancy } from "@/content/gallery";
import { Eyebrow } from "@/components/marketing/blocks";
import { FormProvider } from "@/components/forms/FormContext";
import {
  ConsentBox,
  ErrorSummary,
  Honeypot,
  SelectField,
  SubmitButton,
  SuccessPanel,
  TextArea,
  TextField,
} from "@/components/forms/fields";

export function ApplyForm({ vacancy }: { vacancy: Vacancy }) {
  const [state, action] = useActionState(submitApplication, emptyFormState);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.success) panel.current?.querySelector<HTMLElement>(".success")?.focus();
  }, [state.success]);

  if (state.success) {
    return (
      <div ref={panel}>
        <SuccessPanel {...state.success} />
      </div>
    );
  }

  return (
    <FormProvider state={state} seed={{ vacancy_id: vacancy.id }}>
      <form className="relative flex flex-col gap-5 rounded-2xl border border-app-line-soft bg-card p-6 shadow-card sm:p-8" action={action} noValidate>
        <input type="hidden" name="vacancy_id" value={vacancy.id} />

        <div className="flex flex-col gap-1.5">
          <Eyebrow num="APP" text="Application" />
          <h3 className="font-display text-xl font-bold tracking-tight">Apply for {vacancy.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {vacancy.type} · {vacancy.location}
          </p>
        </div>

        <ErrorSummary />

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="name" label="Full name" required maxLength={80} autoComplete="name" />
          <TextField name="age" label="Age" required type="number" min={18} max={60} inputMode="numeric" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="phone"
            label="Phone"
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="98640 12345"
          />
          <TextField
            name="email"
            label="Email (if you have one)"
            type="email"
            maxLength={120}
            autoComplete="email"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="district"
            label="Home district"
            required
            maxLength={60}
            placeholder="Kokrajhar"
          />
          <SelectField name="education" label="Education" required options={educationOptions} />
        </div>

        <TextArea
          name="experience"
          label="Previous experience"
          rows={3}
          maxLength={1000}
          placeholder="Where you worked, for how long, and what the duty was. Write “fresher” if this is your first job — freshers are welcome."
        />

        <ConsentBox>The details above are correct, and NBSS may verify them.</ConsentBox>

        <Honeypot />

        <div className="flex flex-col gap-3 border-t border-app-line-soft pt-5">
          <SubmitButton idle="Submit application" busy="Sending…" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Bring Aadhaar, address proof and two references to the verification interview.
          </p>
        </div>
      </form>
    </FormProvider>
  );
}
