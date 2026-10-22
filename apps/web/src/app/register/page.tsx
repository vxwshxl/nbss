import { redirect } from "next/navigation";

/**
 * Client accounts are created by the sign-in form itself now (the first code to a new
 * email makes one), so this address only forwards there, keeping old links working.
 */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  redirect(from ? `/login?from=${encodeURIComponent(from)}` : "/login?from=/console/book");
}
