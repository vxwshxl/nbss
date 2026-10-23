"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { educationOptions, vacancyById } from "@/content/gallery";
import { site } from "@/content/site";
import { sendMail } from "@/lib/mail";
import { addSubmission, setStatus, type NewSubmission, type Status } from "@/lib/store";
import { Validator, type FormState } from "@/lib/validate";

/**
 * Server actions behind the public enquiry and careers forms, and the desk's
 * triage of them. Booking guards is not an anonymous form: clients book from the
 * console (app/console/book) after signing in. The enquiry form is for
 * everything else, and needs no account.
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

// --------------------------------------------------------------- enquiry

export async function submitEnquiry(_prev: FormState, data: FormData): Promise<FormState> {
  const f = new Validator(data);

  if (f.isBot) {
    return silentlyAccepted(
      "Thank you, your message is with us.",
      "Our deployment desk will call you back on the number you gave.",
    );
  }

  f.required("name", "Your name").length("name", "Your name", 2, 80);
  f.required("phone", "A phone number").phone("phone");
  f.email("email");
  f.length("company", "Organisation", 0, 120);
  f.required("subject", "A subject").length("subject", "Subject", 3, 120);
  f.required("message", "A message").length("message", "Message", 10, 2000);
  f.consent("consent", "Please confirm we may contact you about this enquiry.");

  if (!f.valid) return f.toFailure();

  // Saved before it is mailed: the console inbox is the record, the email is the
  // nudge. A mail outage must never cost an enquiry.
  const saved = await addSubmission({
    kind: "enquiry",
    name: f.get("name"),
    email: f.get("email") || undefined,
    phone: f.get("phone"),
    company: f.get("company") || undefined,
    subject: f.get("subject"),
    message: f.get("message"),
    ...(await requestMeta()),
  });

  const lines = [
    `Reference: ${saved.id}`,
    `Name: ${saved.name}`,
    `Phone: ${saved.phone}`,
    ...(saved.email ? [`Email: ${saved.email}`] : []),
    ...(saved.company ? [`Organisation: ${saved.company}`] : []),
    "",
    saved.message ?? "",
    "",
    `Open the inbox: ${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/console/submissions`,
  ];
  const mailed = await sendMail({
    to: site.email,
    subject: `Enquiry ${saved.id}: ${saved.subject}`,
    text: lines.join("\n"),
    ...(saved.email && { replyTo: { address: saved.email, name: saved.name } }),
  });
  if (!mailed.ok) console.error(`[enquiry] ${saved.id} saved but not mailed: ${mailed.error}`);

  revalidatePath("/console/submissions");

  return {
    ok: true,
    errors: {},
    values: {},
    success: {
      reference: saved.id,
      title: `Message received: reference ${saved.id}`,
      body: `The deployment desk answers enquiries within one working day. If it is urgent, call ${site.phone} and quote your reference.`,
    },
  };
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
      title: `Application received: ${saved.id}`,
      body: "Keep this reference. HR shortlists weekly and calls candidates for a verification interview at the Kokrajhar office. Bring Aadhaar, address proof and two references.",
    },
  };
}

// ------------------------------------------------------------------ admin

export async function updateStatus(id: string, status: Status): Promise<void> {
  await setStatus(id, status);
  revalidatePath("/console/submissions");
}
