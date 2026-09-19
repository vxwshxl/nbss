/**
 * Form validation, shared by every server action.
 *
 * A `Validator` accumulates per-field errors so one submission surfaces every
 * problem at once, rather than making the visitor fix them one round trip at a
 * time. The collected values go back to the client so nothing typed is lost.
 */

export type FieldErrors = Record<string, string>;

export type FormState = {
  ok: boolean;
  /** Present once a submission succeeds. */
  success?: { reference: string; title: string; body: string };
  errors: FieldErrors;
  /** Echoed back so the re-rendered form keeps what the visitor typed. */
  values: Record<string, string>;
};

export const emptyFormState: FormState = { ok: false, errors: {}, values: {} };

export class Validator {
  readonly values: Record<string, string> = {};
  readonly errors: FieldErrors = {};

  constructor(data: FormData) {
    for (const [key, value] of data.entries()) {
      if (typeof value === "string") this.values[key] = value.trim();
    }
  }

  get valid(): boolean {
    return Object.keys(this.errors).length === 0;
  }

  get(field: string): string {
    return this.values[field] ?? "";
  }

  /** Keeps the first error per field, so the most specific check wins. */
  private fail(field: string, message: string): this {
    if (!(field in this.errors)) this.errors[field] = message;
    return this;
  }

  required(field: string, label: string): this {
    if (!this.get(field)) this.fail(field, `${label} is required.`);
    return this;
  }

  length(field: string, label: string, min: number, max: number): this {
    const value = this.get(field);
    if (!value) return this;
    const n = [...value].length;
    if (n < min) {
      return this.fail(field, `${label} looks too short — please give at least ${min} characters.`);
    }
    if (n > max) {
      return this.fail(field, `${label} is too long — keep it under ${max} characters.`);
    }
    return this;
  }

  email(field: string): this {
    const value = this.get(field);
    if (!value) return this; // optional everywhere on this site
    if (!/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(value)) {
      this.fail(field, "That does not look like a valid email address.");
    }
    return this;
  }

  /**
   * Accepts Indian mobile and landline formats, ignoring spaces, dashes and an
   * optional +91 or leading 0.
   */
  phone(field: string): this {
    const value = this.get(field);
    if (!value) return this;

    let digits = value.replace(/\D/g, "");
    if (digits.startsWith("91")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = digits.slice(1);

    if (digits.length !== 10) {
      return this.fail(field, "Enter a 10-digit Indian phone number.");
    }
    if (!/^[6-9]/.test(digits)) {
      this.fail(field, "An Indian mobile number starts with 6, 7, 8 or 9.");
    }
    return this;
  }

  /** Empty passes — combine with `required` when the field is mandatory. */
  oneOf(field: string, allowed: readonly string[]): this {
    const value = this.get(field);
    if (!value) return this;
    if (!allowed.includes(value)) {
      this.fail(field, "Please choose one of the listed options.");
    }
    return this;
  }

  intRange(field: string, label: string, min: number, max: number): this {
    const value = this.get(field);
    if (!value) return this;
    const n = Number(value);
    if (!Number.isInteger(n)) return this.fail(field, `${label} must be a whole number.`);
    if (n < min || n > max) {
      this.fail(field, `${label} must be between ${min} and ${max}.`);
    }
    return this;
  }

  consent(field: string, message: string): this {
    if (!this.get(field)) this.fail(field, message);
    return this;
  }

  /** Records a rejection discovered outside the standard checks. */
  reject(field: string, message: string): this {
    return this.fail(field, message);
  }

  /**
   * The honeypot field is hidden from people by CSS and from assistive tech by
   * `aria-hidden`, but scripted submitters fill in every input they find. This
   * is the only anti-spam measure — a CAPTCHA would cost more conversions than
   * the spam costs the office.
   */
  get isBot(): boolean {
    return Boolean(this.get("website"));
  }

  /** Builds the state sent back to a failed form. */
  toFailure(): FormState {
    return { ok: false, errors: this.errors, values: this.values };
  }
}
