"use server";

import type { MapSite } from "@/components/console/site-map";
import { requireRoleSession } from "@/lib/auth";
import { toRing } from "@/lib/fence";
import { supabaseServer } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/types";

/**
 * One alert, as the desk needs it: who pressed it and how to reach them, where
 * they were against the fence, who was told, who answered and how far away
 * they were, and how it ended.
 */
export type SosResponder = {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  response: Enums["sos_response"];
  distance: number | null;
  at: string;
};

export type SosDetail = {
  id: string;
  status: Enums["sos_status"];
  kind: Enums["sos_kind"];
  note: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  insideFence: boolean | null;
  raisedAt: string;
  acknowledgedAt: string | null;
  closedAt: string | null;
  closingNote: string | null;
  closedBy: string | null;
  guard: { id: string; name: string; code: string; phone: string | null } | null;
  site: (MapSite & { address: string | null; clientPhone: string | null }) | null;
  responders: SosResponder[];
  notified: { staff: number; guards: number; client: number };
  /** Whether the viewer is on the notified list, which is what may acknowledge. */
  canAcknowledge: boolean;
};

export async function sosDetail(id: string): Promise<SosDetail | { error: string }> {
  const session = await requireRoleSession("admin", "supervisor");
  const supabase = await supabaseServer();

  const [{ data: a }, { data: acks }, { data: notes }] = await Promise.all([
    supabase
      .from("sos_alerts")
      .select(
        "id, status, kind, note, lat, lng, accuracy_m, inside_fence, raised_at, acknowledged_at, closed_at, closing_note, closer:profiles!sos_alerts_closed_by_fkey(full_name), guard:profiles!sos_alerts_raised_by_fkey(id, full_name, employee_code, phone), sites(id, name, client_name, client_id, district, address, lat, lng, geofence_radius_m, polygon)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("sos_acknowledgements")
      .select("response, distance_m, at, profiles(id, full_name, role, phone)")
      .eq("alert_id", id)
      .order("at"),
    supabase.from("sos_notifications").select("profile_id, audience").eq("alert_id", id),
  ]);

  if (!a) return { error: "That alert could not be found." };

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const guard = one(a.guard as unknown as { id: string; full_name: string; employee_code: string; phone: string | null } | null);
  const closer = one(a.closer as unknown as { full_name: string } | null);
  const s = one(
    a.sites as unknown as {
      id: string;
      name: string;
      client_name: string | null;
      client_id: string | null;
      district: string | null;
      address: string | null;
      lat: number;
      lng: number;
      geofence_radius_m: number;
      polygon: Parameters<typeof toRing>[0];
    } | null,
  );

  let clientPhone: string | null = null;
  if (s?.client_id) {
    const { data: c } = await supabase.from("profiles").select("phone").eq("id", s.client_id).maybeSingle();
    clientPhone = c?.phone ?? null;
  }

  const list = notes ?? [];
  return {
    id: a.id,
    status: a.status,
    kind: a.kind,
    note: a.note,
    lat: a.lat,
    lng: a.lng,
    accuracy: a.accuracy_m,
    insideFence: a.inside_fence,
    raisedAt: a.raised_at,
    acknowledgedAt: a.acknowledged_at,
    closedAt: a.closed_at,
    closingNote: a.closing_note,
    closedBy: closer?.full_name ?? null,
    guard: guard ? { id: guard.id, name: guard.full_name, code: guard.employee_code, phone: guard.phone } : null,
    site: s
      ? {
          id: s.id,
          name: s.name,
          client_name: s.client_name,
          district: s.district,
          address: s.address,
          lat: s.lat,
          lng: s.lng,
          geofence_radius_m: s.geofence_radius_m,
          ring: toRing(s.polygon),
          onDuty: 0,
          assigned: 0,
          clientPhone,
        }
      : null,
    responders: (acks ?? []).flatMap((r) => {
      const p = one(r.profiles as unknown as { id: string; full_name: string; role: string; phone: string | null } | null);
      return p
        ? [{ id: p.id, name: p.full_name, role: p.role, phone: p.phone, response: r.response, distance: r.distance_m, at: r.at }]
        : [];
    }),
    notified: {
      staff: list.filter((n) => n.audience === "staff").length,
      guards: list.filter((n) => n.audience === "on_duty_guard").length,
      client: list.filter((n) => n.audience === "client").length,
    },
    canAcknowledge: list.some((n) => n.profile_id === session.realProfile.id),
  };
}
