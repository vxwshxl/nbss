import type { Role } from "@/lib/auth";

export type GuardFormValues = {
  employee_code: string;
  full_name: string;
  phone: string;
  email: string;
  role: Role;
  pin: string;
};

export type GuardFormState = {
  ok: boolean;
  values: GuardFormValues | null;
  error?: string;
  /** Present once, immediately after creation, so the PIN can be written down. */
  created?: {
    employeeCode: string;
    fullName: string;
    email: string | null;
    /** Null when the account signs in by emailed code only. */
    pin: string | null;
    generated: boolean;
  };
};

export const emptyGuardForm: GuardFormState = {
  ok: false,
  values: { employee_code: "", full_name: "", phone: "", email: "", role: "guard", pin: "" },
};

export type PinResetResult =
  | { ok: true; pin: string; employeeCode: string; fullName: string }
  | { ok: false; error: string };
