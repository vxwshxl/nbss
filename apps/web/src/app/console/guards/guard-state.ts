import type { Role } from "@/lib/auth";

export type GuardFormValues = {
  employee_code: string;
  full_name: string;
  phone: string;
  role: Role;
  pin: string;
};

export type GuardFormState = {
  ok: boolean;
  values: GuardFormValues | null;
  error?: string;
  /** Present once, immediately after creation, so the PIN can be written down. */
  created?: { employeeCode: string; fullName: string; pin: string; generated: boolean };
};

export const emptyGuardForm: GuardFormState = {
  ok: false,
  values: { employee_code: "", full_name: "", phone: "", role: "guard", pin: "" },
};

export type PinResetResult =
  | { ok: true; pin: string; employeeCode: string; fullName: string }
  | { ok: false; error: string };
