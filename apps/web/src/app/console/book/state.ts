export type BookingFormState = {
  ok: boolean;
  error?: string;
  /** The reference of the request just made, for the confirmation. */
  reference?: string;
};

export const emptyBookingState: BookingFormState = { ok: false };
