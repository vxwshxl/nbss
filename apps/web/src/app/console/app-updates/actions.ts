"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { audit, requireRoleSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

import type { ReleaseState } from "./state";

/**
 * Publishes the app's latest release. Every phone on a lower build number shows
 * the update screen at its next launch or return to the front.
 */
export async function saveRelease(_prev: ReleaseState, data: FormData): Promise<ReleaseState> {
  const session = await requireRoleSession("admin");
  if (session.impersonating) return { ok: false, error: "Stop viewing as someone else to change the app release." };

  const typed = {
    version_code: String(data.get("version_code") ?? "").trim(),
    version_name: String(data.get("version_name") ?? "").trim(),
    store_url: String(data.get("store_url") ?? "").trim(),
    notes: String(data.get("notes") ?? "").trim(),
  };
  const refuse = (error: string): ReleaseState => ({ ok: false, error, values: typed });
  const versionCode = Number(typed.version_code);
  const versionName = String(data.get("version_name") ?? "").trim();
  const storeUrl = String(data.get("store_url") ?? "").trim();
  const notes = String(data.get("notes") ?? "").trim();

  if (!Number.isInteger(versionCode) || versionCode < 0 || versionCode > 2_100_000_000) {
    return refuse("The build number is a whole number, as shown in the Play Console (version code).");
  }
  if (versionCode > 0 && !storeUrl) return refuse("Add the Play Store link, so the update button has somewhere to go.");
  if (storeUrl) {
    let url: URL;
    try {
      url = new URL(storeUrl);
    } catch {
      return refuse("That Play Store link does not look right.");
    }
    if (url.protocol !== "https:") return refuse("The Play Store link must start with https://");
  }
  if (versionName.length > 40) return refuse("Keep the version name short, like 1.0.1.");
  if (notes.length > 500) return refuse("Keep what's new under 500 characters: it is shown on a phone.");

  const { error } = await supabaseAdmin()
    .from("app_release")
    .update({
      version_code: versionCode,
      version_name: versionName || null,
      store_url: storeUrl || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
      updated_by: session.realProfile.id,
    })
    .eq("id", 1);
  if (error) return refuse(error.message);

  const h = await headers();
  await audit({
    actor: session.realProfile,
    action: "app_release_updated",
    entity: "app_release",
    detail: { version_code: versionCode, version_name: versionName || null },
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  revalidatePath("/console/app-updates");
  return {
    ok: true,
    message: versionCode
      ? `Published. Phones on a build below ${versionCode} now show the update screen.`
      : "Saved. With the build number at 0, no phone is asked to update.",
  };
}
