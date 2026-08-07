"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { districtOptions, site } from "@/content/site";
import { serviceBySlug } from "@/content/services";
import { educationOptions, startWhenOptions, vacancyById } from "@/content/gallery";
import { addSubmission, setStatus, type NewSubmission, type Status } from "@/lib/store";
import { Validator, type FormState } from "@/lib/validate";

/**
 * Server actions behind the three public forms.
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
      "Thank you — your message is with us.",
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

  revalidatePath("/admin");

  return {
    ok: true,
    errors: {},
    values: {},
    success: {
      reference: saved.id,
      title: `Message received — reference ${saved.id}`,
      body: `The deployment desk answers enquiries within one working day. If it is urgent, call ${site.phone} and quote your reference.`,
    },
  };
}

// ----------------------------------------------------------------- quote

export async function submitQuote(_prev: FormState, data: FormData): Promise<FormState> {
  const f = new Validator(data);

  if (f.isBot) return silentlyAccepted("Thank you.", "We will be in touch.");

  f.required("name", "Your name").length("name", "Your name", 2, 80);
  f.required("phone", "A phone number").phone("phone");
  f.email("email");
  f.required("company", "Your organisation").length("company", "Organisation", 2, 120);
  f.required("service", "A service");
  f.required("district", "A district").oneOf("district", districtOptions);
  f.required("site_type", "A site type").length("site_type", "Site type", 2, 120);
  f.intRange("headcount", "Number of personnel", 1, 2000);
  f.oneOf("start_when", startWhenOptions);
  f.length("message", "Notes", 0, 2000);
  f.consent("consent", "Please confirm we may contact you about this requirement.");

  // The select is populated from the catalogue, so anything else was crafted by
  // hand and is rejected rather than stored.
  const service = serviceBySlug(f.get("service"));
  if (f.get("service") && !service) {
    f.reject("service", "Please choose a service from the list.");
  }

  if (!f.valid) return f.toFailure();

  const saved = await addSubmission({
    kind: "quote",
    name: f.get("name"),
    email: f.get("email") || undefined,
    phone: f.get("phone"),
    company: f.get("company"),
    service: service?.name,
    siteType: f.get("site_type"),
    district: f.get("district"),
    headcount: f.get("headcount") || undefined,
    startWhen: f.get("start_when") || undefined,
    message: f.get("message") || undefined,
    ...(await requestMeta()),
  });

  revalidatePath("/admin");

  return {
    ok: true,
    errors: {},
    values: {},
    success: {
      reference: saved.id,
      title: `Quotation request logged — ${saved.id}`,
      body: "A field officer will call to arrange a visit to the site, and you will get a costed proposal with the wage, the applicable statutory heads and our service charge shown separately.",
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

  revalidatePath("/admin");

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
  revalidatePath("/admin");
}
