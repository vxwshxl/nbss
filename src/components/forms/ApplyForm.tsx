"use client";

import { useActionState, useEffect, useRef } from "react";

import { submitApplication } from "@/app/actions";
import { emptyFormState } from "@/lib/validate";
import { educationOptions, type Vacancy } from "@/content/gallery";
import { Eyebrow } from "@/components/blocks";
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
      <form className="form form--boxed" action={action} noValidate>
        <input type="hidden" name="vacancy_id" value={vacancy.id} />

        <div className="form__head">
          <Eyebrow num="APP" text="Application" />
          <h3 className="form__title">Apply for {vacancy.title}</h3>
          <p className="form__lede">
            {vacancy.openings} opening{vacancy.openings === 1 ? "" : "s"} · {vacancy.location}
          </p>
        </div>

        <ErrorSummary />

        <div className="form__row">
          <TextField name="name" label="Full name" required maxLength={80} autoComplete="name" />
          <TextField name="age" label="Age" required type="number" min={18} max={60} inputMode="numeric" />
        </div>

        <div className="form__row">
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

        <div className="form__row">
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

        <div className="form__foot">
          <SubmitButton idle="Submit application" busy="Sending…" />
          <p className="form__small">
            Bring Aadhaar, address proof and two references to the verification interview.
          </p>
        </div>
      </form>
    </FormProvider>
  );
}
