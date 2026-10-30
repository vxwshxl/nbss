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

/** Takes a note down: it leaves the log and the next guard's app. */
export async function deleteHandoverNote(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireRoleSession("admin", "supervisor");
  if (session.impersonating) return { ok: false, error: "Stop viewing as someone else to delete a note." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("handover_notes").delete().eq("id", id).select("site_id, body").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "That note is already gone." };
  await audit({ actor: session.realProfile, action: "handover_note_deleted", entity: "sites", entityId: data.site_id, detail: { body: data.body.slice(0, 200) } });
  revalidatePath("/console/handover");
  return { ok: true };
}
