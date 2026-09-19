"use client";

import { useActionState, useEffect, useRef } from "react";

import { submitEnquiry } from "@/app/actions";
import { emptyFormState } from "@/lib/validate";
import { site } from "@/content/site";
import { FormProvider } from "@/components/forms/FormContext";
import {
  ConsentBox,
  ErrorSummary,
  Honeypot,
  SubmitButton,
  SuccessPanel,
  TextArea,
  TextField,
} from "@/components/forms/fields";

export function EnquiryForm() {
  const [state, action] = useActionState(submitEnquiry, emptyFormState);
  const panel = useRef<HTMLDivElement>(null);

  // Move focus to the confirmation so assistive tech and keyboard users land on
  // the outcome rather than back at the top of the page.
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
    <FormProvider state={state}>
      <form className="relative flex flex-col gap-5" action={action} noValidate>
        <ErrorSummary />

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="name" label="Your name" required maxLength={80} autoComplete="name" />
          <TextField name="company" label="Organisation" maxLength={120} autoComplete="organization" />
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
          <TextField name="email" label="Email" type="email" maxLength={120} autoComplete="email" />
        </div>

        <TextField
          name="subject"
          label="Subject"
          required
          maxLength={120}
          placeholder="Night guarding for a warehouse in Chirang"
        />

        <TextArea
          name="message"
          label="Message"
          required
          rows={5}
          maxLength={2000}
          placeholder="Tell us the site, the shift pattern and roughly how many personnel you have in mind."
        />

        <ConsentBox>I agree that NBSS may contact me about this enquiry.</ConsentBox>

        <Honeypot />

        <div className="flex flex-col gap-3 border-t border-app-line-soft pt-5">
          <SubmitButton idle="Send the enquiry" busy="Sending…" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Answered within one working day. Urgent? Call the deployment desk on {site.phone}.
          </p>
        </div>
      </form>
    </FormProvider>
  );
}
