/**
 * The site form's state. Separate from actions.ts because a "use server"
 * module may only export async functions.
 */
export type SiteFormValues = {
  name: string;
  client_name: string;
  address: string;
  district: string;
  lat: string;
  lng: string;
  geofence_radius_m: string;
  max_accuracy_m: string;
  grace_minutes: string;
  standard_shift_minutes: string;
  shift_start: string;
  shift_end: string;
};

export type SiteFormState = {
  ok: boolean;
  /** Echoed back on failure so nothing typed is lost. Null once saved. */
  values: SiteFormValues | null;
  error?: string;
  created?: string;
};

export const emptySiteForm: SiteFormState = {
  ok: false,
  values: {
    name: "",
    client_name: "",
    address: "",
    district: "",
    lat: "",
    lng: "",
    geofence_radius_m: "150",
    max_accuracy_m: "100",
    grace_minutes: "10",
    standard_shift_minutes: "480",
    shift_start: "",
    shift_end: "",
  },
};
