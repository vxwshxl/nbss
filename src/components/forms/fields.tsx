"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

import { Icon } from "@/components/Icon";
import { useFormErrors, useFormField } from "@/components/forms/FormContext";

/** Inline error under a control. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="field__err">{message}</span>;
}

function Label({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field__l">
        {label} {required && <b>*</b>}
      </span>
      {children}
      <FieldError message={error} />
    </label>
  );
}

export function TextField({
  name,
  label,
  type = "text",
  required,
  ...rest
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type" | "value" | "onChange">) {
  const { value, error, set } = useFormField(name);
  return (
    <Label label={label} required={required} error={error}>
      <input
        type={type}
        name={name}
        value={value}
        onChange={(e) => set(e.target.value)}
        required={required}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </Label>
  );
}

export function TextArea({
  name,
  label,
  required,
  ...rest
}: {
  name: string;
  label: string;
  required?: boolean;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "value" | "onChange">) {
  const { value, error, set } = useFormField(name);
  return (
    <Label label={label} required={required} error={error}>
      <textarea
        name={name}
        value={value}
        onChange={(e) => set(e.target.value)}
        required={required}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </Label>
  );
}

export function SelectField({
  name,
  label,
  options,
  placeholder = "Choose…",
  required,
}: {
  name: string;
  label: string;
  /** Plain strings, or `{ value, label }` when the two differ. */
  options: readonly (string | { value: string; label: string })[];
  placeholder?: string;
  required?: boolean;
}) {
  const { value, error, set } = useFormField(name);
  return (
    <Label label={label} required={required} error={error}>
      <select
        name={name}
        value={value}
        onChange={(e) => set(e.target.value)}
        required={required}
        aria-invalid={error ? true : undefined}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => {
          const optionValue = typeof o === "string" ? o : o.value;
          const optionLabel = typeof o === "string" ? o : o.label;
          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </Label>
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
    <fieldset className="radios">
      <legend className="field__l">{legend}</legend>
      {options.map((option) => (
        <label className="radio" key={option}>
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => set(option)}
          />
          <span>{option}</span>
        </label>
      ))}
      <FieldError message={error} />
    </fieldset>
  );
}

export function ConsentBox({ children }: { children: ReactNode }) {
  const { value, error, set } = useFormField("consent");
  return (
    <>
      <label className="check">
        <input
          type="checkbox"
          name="consent"
          value="yes"
          checked={value === "yes"}
          onChange={(e) => set(e.target.checked ? "yes" : "")}
        />
        <span>
          {children} <b>*</b>
        </span>
      </label>
      <FieldError message={error} />
    </>
  );
}

/**
 * Hidden from people by CSS and from assistive tech by `aria-hidden`, but
 * filled in by most scripted submitters. Cheaper and kinder than a CAPTCHA.
 */
export function Honeypot() {
  return (
    <div className="hp" aria-hidden="true">
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
    <button className="btn btn--gold btn--lg" type="submit" disabled={pending}>
      {pending ? busy : idle}
    </button>
  );
}

export function ErrorSummary() {
  const errors = useFormErrors();
  const count = Object.keys(errors).length;
  if (count === 0) return null;
  return (
    <p className="form-note form-note--error" role="alert">
      Please correct the {count} highlighted field{count === 1 ? "" : "s"} below.
    </p>
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
    <div className="success" role="status" tabIndex={-1}>
      <span className="success__tick">
        <Icon name="check" />
      </span>
      <h3 className="success__t">{title}</h3>
      <p className="success__b">{body}</p>
      <p className="success__ref">
        Reference <strong>{reference}</strong> — quote it if you call.
      </p>
    </div>
  );
}
