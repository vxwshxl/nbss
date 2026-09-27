import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/app/login/auth-shell";
import { safeFrom } from "@/app/login/state";
import { currentProfile, homeFor } from "@/lib/auth";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Create a client account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const [profile, params] = await Promise.all([currentProfile(), searchParams]);
  const from = safeFrom(params.from) || "/console/book";
  if (profile) redirect(profile.role === "client" ? from : homeFor(profile.role));

  return (
    <AuthShell>
      <RegisterForm from={from} />
    </AuthShell>
  );
}
