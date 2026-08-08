import type { Metadata } from "next";

import { LoginDialog } from "./LoginDialog";

export const metadata: Metadata = {
  title: "Operations — sign in",
  robots: { index: false, follow: false },
};

/** Reads the session cookie through the middleware, so it must not be cached. */
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  return <LoginDialog from={from} />;
}
