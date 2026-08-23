import type { Metadata } from "next";

import { Icon } from "@/components/Icon";
import { AttendanceTable, type AttendanceRow } from "@/components/console/tables";
import { requireProfile } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

/**
 * One page for two audiences. A guard's row-level policy limits them to their
 * own punches, so the same query returns a personal history for them and the
 * whole agency's for an admin — no branch needed, and so no branch to get wrong.
 */
export default async function AttendancePage() {
  const profile = await requireProfile();
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("attendance")
    .select(
      "id, check_in_at, check_out_at, worked_minutes, overtime_minutes, status, check_in_distance_m, profiles(full_name, employee_code), sites(name)",
    )
    .order("check_in_at", { ascending: false })
    .limit(1000);

  // Flattened here rather than in the table: PostgREST types an embedded
  // to-one relationship as possibly-an-array, and that shape has no business
  // reaching a component whose job is presentation.
  const rows: AttendanceRow[] = (data ?? []).map((r) => {
    const guard = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const place = Array.isArray(r.sites) ? r.sites[0] : r.sites;
    return {
      id: r.id,
      check_in_at: r.check_in_at,
      check_out_at: r.check_out_at,
      worked_minutes: r.worked_minutes,
      overtime_minutes: r.overtime_minutes,
      status: r.status,
      check_in_distance_m: r.check_in_distance_m,
      guard_name: guard?.full_name ?? null,
      guard_code: guard?.employee_code ?? null,
      site_name: place?.name ?? null,
    };
  });

  const mine = profile.role === "guard";

  return (
    <div className="cwrap">
      <div className="chead">
        <div>
          <h1 className="chead__h">{mine ? "My attendance" : "Attendance"}</h1>
          <p className="chead__lede">
            {mine
              ? "Every shift you have been recorded for."
              : "Every punch across all sites, newest first."}
          </p>
        </div>
      </div>

      <div className="cpanel cpanel--table">
        <div className="cpanel__body">
          <AttendanceTable rows={rows} showGuard={!mine} />
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
