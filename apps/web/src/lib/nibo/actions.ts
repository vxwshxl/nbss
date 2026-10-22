"use server";

import { currentSession } from "@/lib/auth";
import { getNiboNudges } from "@/lib/nibo/nudges";
import type { NiboLine } from "@/lib/nibo/types";

/** Nibo's live nudges for whoever is signed in (none while viewing as someone). */
export async function loadNiboNudges(): Promise<NiboLine[]> {
  const session = await currentSession();
  if (!session || session.impersonating) return [];
  try {
    return await getNiboNudges(session);
  } catch (e) {
    console.error("[nibo] nudges failed:", e);
    return [];
  }
}
