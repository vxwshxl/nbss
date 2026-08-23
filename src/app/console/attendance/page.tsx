import type { Metadata } from "next";

import { Icon } from "@/components/Icon";
import { site } from "@/content/site";
import { requireProfile } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

function when(iso: string | null): string {
  if (!iso) return "—";
  return `${new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: site.timeZone,
  })}`;
}

function hours(minutes: number | null): string {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/**
 * One page for two audiences. A guard's row-level policy limits them to their
 * own punches, so the same query returns a personal history for them and the
 * whole agency's for an admin — no branch needed, and no way for the branch to
 * be wrong.
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
    .limit(100);

  const rows = data ?? [];
  const mine = profile.role === "guard";

  return (
    <div className="cwrap">
      <div className="chead">
        <div>
          <h1 className="chead__h">{mine ? "My attendance" : "Attendance"}</h1>
          <p className="chead__lede">
            {mine
              ? "Every shift you have been recorded for."
              : "The most recent 100 punches across all sites."}
          </p>
        </div>
      </div>

      <div className="cpanel">
        {rows.length === 0 ? (
          <p className="cempty">
            <strong>No attendance recorded yet.</strong>
            Punches appear here as soon as check-in is live.
          </p>
        ) : (
          <div className="ctable-scroll">
            <table className="ctable">
              <thead>
                <tr>
                  {!mine && <th scope="col">Guard</th>}
                  <th scope="col">Site</th>
                  <th scope="col">In</th>
                  <th scope="col">Out</th>
                  <th scope="col">Worked</th>
                  <th scope="col">Overtime</th>
                  <th scope="col">Distance</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const guard = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
                  const place = Array.isArray(r.sites) ? r.sites[0] : r.sites;
                  return (
                    <tr key={r.id}>
                      {!mine && <td>{guard?.full_name ?? "—"}</td>}
                      <td>{place?.name ?? "—"}</td>
                      <td className="mono">{when(r.check_in_at)}</td>
                      <td className="mono">{when(r.check_out_at)}</td>
                      <td className="mono">{hours(r.worked_minutes)}</td>
                      <td className="mono">{hours(r.overtime_minutes)}</td>
                      <td className="mono">
                        {r.check_in_distance_m === null ? "—" : `${Math.round(r.check_in_distance_m)} m`}
                      </td>
                      <td>
                        <span
                          className={`cbadge ${
                            r.status === "late" || r.status === "pending_review"
                              ? "cbadge--late"
                              : r.check_out_at
                                ? "cbadge--off"
                                : "cbadge--on"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
