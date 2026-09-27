"use server";

import { redirect } from "next/navigation";

import { audit, currentProfile } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export async function signOut(): Promise<void> {
  const profile = await currentProfile();
  const supabase = await supabaseServer();

  await audit({ actor: profile, action: "sign_out" });
  await supabase.auth.signOut();

  redirect("/login");
}
