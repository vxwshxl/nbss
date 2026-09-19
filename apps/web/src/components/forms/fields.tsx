"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { useFormErrors, useFormField } from "@/components/forms/FormContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * The public forms' controls.
 *
 * Every one is a controlled field wired to `FormContext`, which is what lets a
 * failed submission come back with everything still typed in — the single
 * biggest reason a real enquiry never arrives is a form that empties itself on
 * a validation error.
 *
 * These are deliberately native `<select>` and `<input type="radio">` rather
 * than the Radix equivalents the console uses. This is a form filled in once,
 * often on a phone, sometimes over mobile data in a district office: the
 * platform's own controls are familiar, they work before hydration, and they
 * open the OS picker instead of a custom listbox. The console can afford a
 * richer control because the same person uses it forty times a day.
 */

/** Inline error under a control. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-destructive">
      <AlertCircle className="size-3.5 shrink-0" strokeWidth={2} />
      {message}
    </span>
  );
}

function Field({
  name,
  label,
  required,
  error,
  hint,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <UiLabel htmlFor={name}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </UiLabel>
      {children}
      {hint && !error && <span className="text-xs text-muted-foreground">{hint}</span>}
      <FieldError message={error} />
    </div>
  );
}

export function TextField({
  name,
  label,
  type = "text",
  required,
  hint,
  ...rest
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  hint?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type" | "value" | "onChange">) {
  const { value, error, set } = useFormField(name);
  return (
    <Field name={name} label={label} required={required} error={error} hint={hint}>
      <Input
        id={name}
        type={type}
        name={name}
        value={value}
        onChange={(e) => set(e.target.value)}
        required={required}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </Field>
  );
}

export function TextArea({
  name,
  label,
  required,
  hint,
  ...rest
}: {
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "value" | "onChange">) {
  const { value, error, set } = useFormField(name);
  return (
    <Field name={name} label={label} required={required} error={error} hint={hint}>
      <Textarea
        id={name}
        name={name}
        value={value}
        onChange={(e) => set(e.target.value)}
        required={required}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </Field>
  );
}

export function SelectField({
  name,
  label,
  options,
  placeholder = "Choose…",
  required,
  hint,
}: {
  name: string;
  label: string;
  /** Plain strings, or `{ value, label }` when the two differ. */
  options: readonly (string | { value: string; label: string })[];
  placeholder?: string;
  required?: boolean;
  hint?: string;
}) {
  const { value, error, set } = useFormField(name);
  return (
    <Field name={name} label={label} required={required} error={error} hint={hint}>
      <select
        id={name}
        name={name}
        value={value}
        onChange={(e) => set(e.target.value)}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(
          "h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none transition-[color,box-shadow]",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
          value ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => {
          const optionValue = typeof o === "string" ? o : o.value;
          const optionLabel = typeof o === "string" ? o : o.label;
          return (
            <option key={optionValue} value={optionValue} className="text-foreground">
              {optionLabel}
            </option>
          );
        })}
      </select>
    </Field>
  );
}

export function RadioGroup({
  name,
  legend,
  options,
}: {
  name: string;
  legend: string;
  options: readonly string[];
}) {
  const { value, error, set } = useFormField(name);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option}
            className={cn(
              "press cursor-pointer rounded-full border px-3.5 py-2 text-sm transition-colors",
              "has-focus-visible:ring-2 has-focus-visible:ring-ring/50",
              value === option
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-app-line bg-card text-muted-foreground hover:border-app-line hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => set(option)}
              className="sr-only"
            />
            {option}
          </label>
        ))}
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}

export function ConsentBox({ children }: { children: ReactNode }) {
  const { value, error, set } = useFormField("consent");
  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="consent"
          value="yes"
          checked={value === "yes"}
          onChange={(e) => set(e.target.checked ? "yes" : "")}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <span className="leading-relaxed text-muted-foreground">
          {children} <span className="text-destructive">*</span>
        </span>
      </label>
      <FieldError message={error} />
      <p className="text-xs text-muted-foreground">
        What you send is handled as described in the{" "}
        <Link href="/privacy-policy" className="text-primary hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

/**
 * Hidden from people by CSS and from assistive tech by `aria-hidden`, but
 * filled in by most scripted submitters. Cheaper and kinder than a CAPTCHA —
 * and a CAPTCHA on an enquiry form is a tax on the genuine enquiries, which
 * for a business this size are the only ones that matter.
 */
export function Honeypot() {
  return (
    <div
      aria-hidden
      className="absolute left-[-9999px] h-px w-px overflow-hidden"
      // `sr-only` would still be read by a screen reader, which is exactly the
      // audience that must not be asked to leave a field empty.
    >
      <label>
        Leave this empty
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}

/** Submit button that reflects the pending state of its parent form. */
export function SubmitButton({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="h-11 px-6 text-base" disabled={pending}>
      {pending ? busy : idle}
    </Button>
  );
}

export function ErrorSummary() {
  const errors = useFormErrors();
  const count = Object.keys(errors).length;
  if (count === 0) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>
        Please correct the {count} highlighted field{count === 1 ? "" : "s"} below.
      </span>
    </div>
  );
}

/** Replaces the form once a submission is stored. */
export function SuccessPanel({
  reference,
  title,
  body,
}: {
  reference: string;
  title: string;
  body: string;
}) {
  return (
    <div
      role="status"
      tabIndex={-1}
      className="flex flex-col items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-6 py-12 text-center outline-none"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
        <CheckCircle2 className="size-6" strokeWidth={1.9} />
      </span>
      <h3 className="font-display text-xl font-bold tracking-tight">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      <p className="mt-2 rounded-full bg-card px-4 py-2 text-sm">
        Reference{" "}
        <strong className="font-mono font-semibold tracking-wider">{reference}</strong> — quote
        it if you call.
      </p>
    </div>
  );
}
