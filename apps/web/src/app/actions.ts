"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { educationOptions, vacancyById } from "@/content/gallery";
import { addSubmission, setStatus, type NewSubmission, type Status } from "@/lib/store";
import { Validator, type FormState } from "@/lib/validate";

/**
 * Server actions behind the public careers form, and the desk's triage of it.
 * Quote and enquiry requests are no longer anonymous forms: clients book from
 * the console (app/console/book) after signing in.
 *
 * Each is wired to a `<form action={...}>` via `useActionState`, so the forms
 * submit and validate perfectly well before React hydrates — the JavaScript
 * only upgrades them to swap in place instead of navigating.
 */

/** Captures request metadata for spam triage. */
async function requestMeta(): Promise<Pick<NewSubmission, "userAgent" | "remoteIp">> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    userAgent: h.get("user-agent") ?? undefined,
    remoteIp: forwarded?.split(",")[0]?.trim() ?? undefined,
  };
}

/**
 * A honeypot hit gets a page that looks exactly like success. Telling a bot it
 * failed only helps it try again, and nothing is written.
 */
function silentlyAccepted(title: string, body: string): FormState {
  return { ok: true, errors: {}, values: {}, success: { reference: "NBSS-00000", title, body } };
}

// ----------------------------------------------------------- application

export async function submitApplication(_prev: FormState, data: FormData): Promise<FormState> {
  const f = new Validator(data);

  if (f.isBot) return silentlyAccepted("Thank you.", "Your application is with us.");

  const vacancy = vacancyById(f.get("vacancy_id"));
  if (!vacancy) {
    return {
      ok: false,
      errors: { vacancy_id: "That position is no longer open. Please pick another from the list." },
      values: f.values,
    };
  }

  f.required("name", "Your name").length("name", "Your name", 2, 80);
  f.required("phone", "A phone number").phone("phone");
  f.email("email");
  f.required("age", "Your age").intRange("age", "Age", 18, 60);
  f.required("district", "Your district").length("district", "District", 2, 60);
  f.required("education", "Your education").oneOf("education", educationOptions);
  f.length("experience", "Experience", 0, 1000);
  f.consent("consent", "Please confirm the details you have given are correct.");

  if (!f.valid) return f.toFailure();

  const saved = await addSubmission({
    kind: "application",
    name: f.get("name"),
    email: f.get("email") || undefined,
    phone: f.get("phone"),
    vacancyId: vacancy.id,
    vacancyTitle: vacancy.title,
    age: f.get("age"),
    district: f.get("district"),
    education: f.get("education"),
    experience: f.get("experience") || undefined,
    ...(await requestMeta()),
  });

  revalidatePath("/console/submissions");

  return {
    ok: true,
    errors: {},
    values: {},
    success: {
      reference: saved.id,
      title: `Application received — ${saved.id}`,
      body: "Keep this reference. HR shortlists weekly and calls candidates for a verification interview at the Kokrajhar office. Bring Aadhaar, address proof and two references.",
    },
  };
}

// ------------------------------------------------------------------ admin

export async function updateStatus(id: string, status: Status): Promise<void> {
  await setStatus(id, status);
  revalidatePath("/console/submissions");
}
