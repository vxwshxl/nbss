export type RegisterValues = { fullName: string; organisation: string; phone: string; email: string };

export type RegisterState = {
  step: "details" | "code";
  values: RegisterValues;
  error?: string;
  notice?: string;
  sentAt?: number;
};

export const initialRegisterState: RegisterState = {
  step: "details",
  values: { fullName: "", organisation: "", phone: "", email: "" },
};
