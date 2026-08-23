import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/Icon";
import { requireRole } from "@/lib/auth";
import { site } from "@/content/site";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/**
 * Timestamps are stored as UTC and this renders on the server, which on the
 * host is a UTC box rather than a desk in Kokrajhar. The zone is pinned to IST
 * and printed, so a time on this page says what it means.
 */
function time(iso: string): string {
  return `${new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: site.timeZone,
  })} IST`;
}

function hours(minutes: number | null): string {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export default async function ConsoleDashboard() {
  const profile = await requireRole("admin", "supervisor");
  const supabase = await supabaseServer();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [guards, sites, onDuty, todayPunches] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "guard").eq("active", true),
    supabase.from("sites").select("id", { count: "exact", head: true }).eq("active", true),
    supabase
      .from("attendance")
      .select("id, guard_id, site_id, check_in_at, status, profiles(full_name, employee_code), sites(name)")
      .is("check_out_at", null)
      .order("check_in_at", { ascending: false }),
    supabase
      .from("attendance")
      .select("id, worked_minutes, overtime_minutes, status")
      .gte("check_in_at", startOfToday.toISOString()),
  ]);

  const live = onDuty.data ?? [];
  const punches = todayPunches.data ?? [];

  const overtimeToday = punches.reduce((sum, p) => sum + (p.overtime_minutes ?? 0), 0);
  const lateToday = punches.filter((p) => p.status === "late").length;
  const needsReview = punches.filter((p) => p.status === "pending_review").length;

  const noSites = (sites.count ?? 0) === 0;

  return (
    <div className="cwrap">
      <div className="chead">
        <div>
          <h1 className="chead__h">Good day, {profile.full_name.split(" ")[0]}</h1>
          <p className="chead__lede">
            {live.length > 0
              ? `${live.length} guard${live.length === 1 ? "" : "s"} on duty right now.`
              : "Nobody is on duty right now."}
          </p>
        </div>
      </div>

      <div className="cstats">
        <div className="cstat cstat--ok">
          <span className="cstat__v">{live.length}</span>
          <span className="cstat__l">on duty</span>
        </div>
        <div className="cstat">
          <span className="cstat__v">{guards.count ?? 0}</span>
          <span className="cstat__l">active guards</span>
        </div>
        <div className="cstat">
          <span className="cstat__v">{sites.count ?? 0}</span>
          <span className="cstat__l">sites</span>
        </div>
        <div className={`cstat${lateToday ? " cstat--warn" : ""}`}>
          <span className="cstat__v">{lateToday}</span>
          <span className="cstat__l">late today</span>
        </div>
        <div className="cstat">
          <span className="cstat__v">{hours(overtimeToday)}</span>
          <span className="cstat__l">overtime today</span>
        </div>
        <div className={`cstat${needsReview ? " cstat--warn" : ""}`}>
          <span className="cstat__v">{needsReview}</span>
          <span className="cstat__l">needs review</span>
        </div>
      </div>

      {noSites && (
        <div className="cpanel">
          <div className="cpanel__head">
            <h2 className="cpanel__h">Start here</h2>
          </div>
          <div className="cpanel__body">
            <p className="chead__lede" style={{ margin: 0 }}>
              No sites are registered yet. A guard cannot check in until there is a site with a
              geofence around it — that fence is what makes attendance mean &ldquo;actually at the
              gate&rdquo; rather than &ldquo;tapped a button&rdquo;.
            </p>
            <p style={{ marginTop: 14 }}>
              <Link className="btn btn--solid btn--sm" href="/console/sites">
                Register the first site
              </Link>
            </p>
          </div>
        </div>
      )}

      <div className="cpanel">
        <div className="cpanel__head">
          <h2 className="cpanel__h">On duty now</h2>
          <Link className="clogin__back" href="/console/attendance">
            All attendance →
          </Link>
        </div>

        {live.length === 0 ? (
          <p className="cempty">
            <strong>Nobody is checked in.</strong>
            When a guard punches in at a site, they appear here with the time they arrived.
          </p>
        ) : (
          <div className="ctable-scroll">
            <table className="ctable">
              <thead>
                <tr>
                  <th scope="col">Guard</th>
                  <th scope="col">Code</th>
                  <th scope="col">Site</th>
                  <th scope="col">Checked in</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {live.map((row) => {
                  // The embedded rows come back as an object for a to-one
                  // relationship, but PostgREST's generated types describe the
                  // general case, so both shapes are handled.
                  const guard = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
                  const place = Array.isArray(row.sites) ? row.sites[0] : row.sites;

                  return (
                    <tr key={row.id}>
                      <td>{guard?.full_name ?? "—"}</td>
                      <td className="mono">{guard?.employee_code ?? "—"}</td>
                      <td>{place?.name ?? "—"}</td>
                      <td className="mono">{row.check_in_at ? time(row.check_in_at) : "—"}</td>
                      <td>
                        <span className={`cbadge ${row.status === "late" ? "cbadge--late" : "cbadge--on"}`}>
                          <span className="cdot" />
                          {row.status === "late" ? "late" : "on duty"}
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
          Live location, rosters and the deployment map arrive in Phase 2. Attendance recorded now
          is already the real ledger — hours and overtime on this page are computed by the database
          from punch pairs, not estimated.
        </span>
      </p>
    </div>
  );
}
