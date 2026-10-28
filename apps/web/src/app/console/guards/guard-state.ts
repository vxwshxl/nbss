import type { RoleChoice } from "@nbss/shared/identity";

export type GuardFormValues = {
  full_name: string;
  phone: string;
  email: string;
  role: RoleChoice;
};

export type GuardFormState = {
  ok: boolean;
  values: GuardFormValues | null;
  error?: string;
  /** Present once, immediately after creation, to tell the person how to sign in. */
  created?: {
    employeeCode: string;
    fullName: string;
    phone: string;
    email: string | null;
  };
};

export const emptyGuardForm: GuardFormState = {
  ok: false,
  values: { full_name: "", phone: "", email: "", role: "guard" },
};
