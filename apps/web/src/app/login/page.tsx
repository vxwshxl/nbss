import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { currentProfile, homeFor } from "@/lib/auth";

import { AuthShell } from "./auth-shell";
import { safeFrom } from "./state";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The one sign-in for everybody — administrators, supervisors, guards and
 * clients. Nobody picks a role here: the profile decides where each person
 * lands, so the page only has to ask who they are and to prove it.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const [profile, params] = await Promise.all([currentProfile(), searchParams]);
  const from = safeFrom(params.from);

  // Already through the door: straight to where the button was going (a
  // client pressing "Book guards" lands on the booking page), else home.
  if (profile) redirect(profile.role === "client" && from ? from : homeFor(profile.role));

  return (
    <AuthShell>
      <SignInForm from={from} />
    </AuthShell>
  );
}
