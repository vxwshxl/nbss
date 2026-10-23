"use server";

import { revalidatePath } from "next/cache";

import { audit, requireRoleSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

/** A note from the desk to whoever is next on a site: it shows on their app at check-in. */
export async function addHandoverNote(siteId: string, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireRoleSession("admin", "supervisor");
  if (session.impersonating) return { ok: false, error: "Stop viewing as someone else to write a note." };
  const text = body.trim();
  if (!siteId) return { ok: false, error: "Choose the site the note is for." };
  if (!text) return { ok: false, error: "Write the note first." };
  if (text.length > 2000) return { ok: false, error: "Keep it under 2,000 characters." };
  const supabase = await supabaseServer();
  const { error } = await supabase.from("handover_notes").insert({ site_id: siteId, author_id: session.realProfile.id, body: text });
  if (error) return { ok: false, error: error.message };
  await audit({ actor: session.realProfile, action: "handover_note", entity: "sites", entityId: siteId });
  revalidatePath("/console/handover");
  return { ok: true };
}
