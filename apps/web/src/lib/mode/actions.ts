"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { currentSession } from "@/lib/auth";

import { DATA_MODE_COOKIE, type DataMode } from "./shared";

/**
 * Flip the header's Test / Live switch. Developers only: for anyone else the database
 * ignores the mode and shows the side their own account is on, so the cookie is not
 * even set for them.
 */
export async function setDataMode(mode: DataMode): Promise<{ ok: boolean }> {
  const session = await currentSession();
  if (session?.realProfile.role !== "developer") return { ok: false };
  (await cookies()).set(DATA_MODE_COOKIE, mode === "test" ? "test" : "live", {
    // Not httpOnly: the browser's Supabase client reads it to send the mode as a header.
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
