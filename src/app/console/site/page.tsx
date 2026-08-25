import type { Metadata } from "next";

import { Icon } from "@/components/Icon";
import { site as company } from "@/content/site";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Deployment" };
export const dynamic = "force-dynamic";

function time(iso: string): string {
  return `${new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: company.timeZone,
  })} IST`;
}

function hours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`;
}

/**
 * What a client sees: who is on duty at their site, and the man-hours behind
 * the invoice.
 *
 * Deliberately narrower than the supervisor's view. A client is entitled to
 * know their site is staffed and what they are being billed for — they are not
 * entitled to a guard's coordinates, their accuracy readings or their
 * attendance history at anybody else's site. So this page shows presence and
 * totals, and no evidence trail.
 */
export default async function ClientSitePage() {
  const profile = await requireRole("client");
  const supabase = await supabaseServer();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [onDuty, month] = await Promise.all([
    supabase
      .from("attendance")
      .select("id, check_in_at, profiles(full_name), sites(name)")
      .is("check_out_at", null)
      .order("check_in_at", { ascending: false }),
    supabase
      .from("attendance")
      .select("worked_minutes, overtime_minutes, status")
      .gte("check_in_at", monthStart.toISOString()),
  ]);

  const live = onDuty.data ?? [];
  const punches = month.data ?? [];

  const manMinutes = punches.reduce((sum, p) => sum + (p.worked_minutes ?? 0), 0);
  const overtime = punches.reduce((sum, p) => sum + (p.overtime_minutes ?? 0), 0);

  return (
    <div className="cwrap">
      <div className="chead">
        <div>
          <h1 className="chead__h">Deployment</h1>
          <p className="chead__lede">
            {live.length > 0
              ? `${live.length} guard${live.length === 1 ? "" : "s"} on duty at your site right now.`
              : "No guard is checked in at your site right now."}
          </p>
        </div>
      </div>

      <div className="cstats">
        <div className={`cstat${live.length ? " cstat--ok" : ""}`}>
          <span className="cstat__v">{live.length}</span>
          <span className="cstat__l">on duty now</span>
        </div>
        <div className="cstat">
          <span className="cstat__v">{hours(manMinutes)}</span>
          <span className="cstat__l">man-hours this month</span>
        </div>
        <div className="cstat">
          <span className="cstat__v">{hours(overtime)}</span>
          <span className="cstat__l">of which overtime</span>
        </div>
        <div className="cstat">
          <span className="cstat__v">{punches.length}</span>
          <span className="cstat__l">shifts this month</span>
        </div>
      </div>

      <div className="cpanel cpanel--table">
        <div className="cpanel__head">
          <h2 className="cpanel__h">On duty now</h2>
        </div>

        {live.length === 0 ? (
          <p className="cempty">
            <strong>Nobody is checked in.</strong>
            Guards appear here from the moment they arrive on site.
          </p>
        ) : (
          <div className="ctable-scroll">
            <table className="ctable">
              <thead>
                <tr>
                  <th scope="col">Guard</th>
                  <th scope="col">Site</th>
                  <th scope="col">On duty since</th>
                </tr>
              </thead>
              <tbody>
                {live.map((row) => {
                  const guard = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
                  const place = Array.isArray(row.sites) ? row.sites[0] : row.sites;
                  return (
                    <tr key={row.id}>
                      <td>{guard?.full_name ?? "—"}</td>
                      <td>{place?.name ?? "—"}</td>
                      <td className="mono">{row.check_in_at ? time(row.check_in_at) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="admin-note">
        <Icon name="shield-check" />
        <span>
          Man-hours are computed from the times guards checked in and out at your site, each one
          verified against its boundary. Questions about this page go to the deployment desk on{" "}
          {company.phone}. Signed in as {profile.full_name}.
        </span>
      </p>
    </div>
  );
}
