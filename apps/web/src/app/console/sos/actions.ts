"use server";

import { revalidatePath } from "next/cache";

import { audit, requireRoleSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/types";

/**
 * Answering an SOS from the console.
 *
 * Both go through the same database functions the app uses (0006), on the
 * signed-in person's own session — so `acknowledge_sos` records *who* is on
 * the way from the JWT, and `close_sos` applies the same rule it applies on a
 * phone. Nothing here writes to the SOS tables directly.
 */

export type SosResult = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/console");
  revalidatePath("/console/sos");
  revalidatePath("/console/sites");
}

export async function respondToSos(
  alertId: string,
  response: Enums["sos_response"],
): Promise<SosResult> {
  const session = await requireRoleSession("admin", "supervisor");
  if (session.impersonating) {
    return { ok: false, error: "Stop viewing as someone else before answering an alert." };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("acknowledge_sos", { p_alert_id: alertId, p_response: response });
  if (error) return { ok: false, error: error.message };

  await audit({
    actor: session.realProfile,
    action: "sos_acknowledged",
    entity: "sos_alerts",
    entityId: alertId,
    detail: { response, via: "console" },
  });
  refresh();
  return { ok: true };
}

export async function closeSosAlert(
  alertId: string,
  status: Extract<Enums["sos_status"], "resolved" | "false_alarm">,
  note: string,
): Promise<SosResult> {
  const session = await requireRoleSession("admin", "supervisor");
  if (session.impersonating) {
    return { ok: false, error: "Stop viewing as someone else before closing an alert." };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("close_sos", {
    p_alert_id: alertId,
    p_status: status,
    p_note: note.trim() || undefined,
  });
  if (error) return { ok: false, error: error.message };

  await audit({
    actor: session.realProfile,
    action: "sos_closed",
    entity: "sos_alerts",
    entityId: alertId,
    detail: { status, note: note.trim() || null, via: "console" },
  });
  refresh();
  return { ok: true };
}
