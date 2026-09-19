import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "./LoginForm";
import { currentProfile, homeFor } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Nothing to ask someone who is already through the door.
  const profile = await currentProfile();
  if (profile) redirect(homeFor(profile.role));

  return <LoginForm />;
}
