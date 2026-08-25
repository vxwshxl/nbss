import type { Metadata } from "next";

import { AttendanceWorkspace, type AttendanceRow } from "@/components/console/AttendanceWorkspace";
import { Icon } from "@/components/Icon";
import { requireSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

/**
 * One page for two audiences. A guard's row-level policy limits them to their
 * own punches, so the same query returns a personal history for them and the
 * whole agency's for an admin — no branch needed, and so no branch to get wrong.
 */
export default async function AttendancePage() {
  const session = await requireSession();
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("attendance")
    .select(
      "id, check_in_at, check_out_at, check_in_lat, check_in_lng, check_in_accuracy_m, check_in_distance_m, check_in_method, check_out_distance_m, check_out_method, worked_minutes, overtime_minutes, status, device_reported_at, ip, review_note, reviewed_at, profiles(full_name, employee_code), sites(name)",
    )
    .order("check_in_at", { ascending: false })
    .limit(1000);

  const rows: AttendanceRow[] = (data ?? []).map((r) => {
    const guard = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const place = Array.isArray(r.sites) ? r.sites[0] : r.sites;
    return {
      id: r.id,
      check_in_at: r.check_in_at,
      check_out_at: r.check_out_at,
      check_in_lat: r.check_in_lat,
      check_in_lng: r.check_in_lng,
      check_in_accuracy_m: r.check_in_accuracy_m,
      check_in_distance_m: r.check_in_distance_m,
      check_in_method: r.check_in_method,
      check_out_distance_m: r.check_out_distance_m,
      check_out_method: r.check_out_method,
      worked_minutes: r.worked_minutes,
      overtime_minutes: r.overtime_minutes,
      status: r.status,
      device_reported_at: r.device_reported_at,
      ip: r.ip,
      review_note: r.review_note,
      reviewed_at: r.reviewed_at,
      // A guard sees only their own rows, so repeating their name on each is noise.
      guard_name: session.profile.role === "guard" ? null : (guard?.full_name ?? null),
      guard_code: guard?.employee_code ?? null,
      site_name: place?.name ?? null,
    };
  });

  const mine = session.profile.role === "guard";
  const canReview =
    (session.profile.role === "admin" || session.profile.role === "supervisor") &&
    !session.impersonating;

  return (
    <div className="cwrap">
      <div className="chead">
        <div>
          <h1 className="chead__h">{mine ? "My attendance" : "Attendance"}</h1>
          <p className="chead__lede">
            {mine
              ? "Every shift you have been recorded for. Select one to see its detail."
              : "Every punch across all sites. Select one to see the evidence behind it."}
          </p>
        </div>
      </div>

      <div className="cpanel cpanel--table">
        <div className="cpanel__body">
          <AttendanceWorkspace rows={rows} canReview={canReview} />
        </div>
      </div>

      <p className="admin-note">
        <Icon name="shield-alt" />
        <span>
          Distance is how far from the site centre the guard stood when they punched. It is stored
          on every punch, so a dispute months later has evidence rather than an argument.
        </span>
      </p>
    </div>
  );
}
