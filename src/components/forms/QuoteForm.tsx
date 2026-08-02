"use client";

import { useActionState, useEffect, useRef } from "react";

import { submitQuote } from "@/app/actions";
import { emptyFormState } from "@/lib/validate";
import { districtOptions } from "@/content/site";
import { services } from "@/content/services";
import { startWhenOptions } from "@/content/gallery";
import { Eyebrow } from "@/components/blocks";
import { FormProvider } from "@/components/forms/FormContext";
import {
  ConsentBox,
  ErrorSummary,
  Honeypot,
  RadioGroup,
  SelectField,
  SubmitButton,
  SuccessPanel,
  TextArea,
  TextField,
} from "@/components/forms/fields";

const serviceOptions = services.map((s) => ({ value: s.slug, label: s.name }));

export function QuoteForm({
  /** Pre-selects the service when the form is opened from a service page. */
  service,
  boxed = true,
}: {
  service?: string;
  boxed?: boolean;
}) {
  const [state, action] = useActionState(submitQuote, emptyFormState);
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
    <FormProvider state={state} seed={service ? { service } : undefined}>
      <form className={`form${boxed ? " form--boxed" : ""}`} action={action} noValidate>
        <div className="form__head">
          <Eyebrow num="RFQ" text="Request a quotation" />
          <h3 className="form__title">
            Tell us the site. We will survey it and cost it line by line.
          </h3>
        </div>

        <ErrorSummary />

        <div className="form__row">
          <TextField name="name" label="Your name" required maxLength={80} autoComplete="name" />
          <TextField
            name="company"
            label="Organisation"
            required
            maxLength={120}
            autoComplete="organization"
          />
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
          <TextField name="email" label="Email" type="email" maxLength={120} autoComplete="email" />
        </div>

        <SelectField
          name="service"
          label="Which service?"
          required
          options={serviceOptions}
          placeholder="Choose a service…"
        />

        <div className="form__row form__row--3">
          <SelectField name="district" label="District" required options={districtOptions} />
          <TextField
            name="site_type"
            label="Site type"
            required
            maxLength={120}
            placeholder="Rice mill, 4 acres"
          />
          <TextField
            name="headcount"
            label="Personnel needed"
            type="number"
            min={1}
            max={2000}
            inputMode="numeric"
            placeholder="8"
          />
        </div>

        <RadioGroup name="start_when" legend="When do you need cover?" options={startWhenOptions} />

        <TextArea
          name="message"
          label="Anything else we should know?"
          rows={3}
          maxLength={2000}
          placeholder="Shift pattern, existing agency, armed requirement, tender reference…"
        />

        <ConsentBox>NBSS may contact me about this requirement.</ConsentBox>

        <Honeypot />

        <div className="form__foot">
          <SubmitButton idle="Request the quotation" busy="Sending…" />
          <p className="form__small">
            Site survey within 48 hours inside the BTR districts. No obligation.
          </p>
        </div>
      </form>
    </FormProvider>
  );
}
