import type { Metadata } from "next";

import { Icon } from "@/components/Icon";
import { site } from "@/content/site";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Today" };
export const dynamic = "force-dynamic";

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

/**
 * What a guard sees when they open the app at the start of a shift.
 *
 * Deliberately one screen with one decision on it. The check-in control itself
 * needs the browser's geolocation, so it arrives with the next piece of work —
 * this page is what it will sit inside.
 */
export default async function DutyPage() {
  const profile = await requireRole("guard");
  const supabase = await supabaseServer();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [openPunch, recent] = await Promise.all([
    supabase
      .from("attendance")
      .select("id, check_in_at, site_id, status, sites(name, address)")
      .eq("guard_id", profile.id)
      .is("check_out_at", null)
      .maybeSingle(),
    supabase
      .from("attendance")
      .select("id, check_in_at, check_out_at, worked_minutes, overtime_minutes, status, sites(name)")
      .eq("guard_id", profile.id)
      .gte("check_in_at", weekAgo.toISOString())
      .order("check_in_at", { ascending: false })
      .limit(10),
  ]);

  const open = openPunch.data;
  const history = recent.data ?? [];
  const openSite = open ? (Array.isArray(open.sites) ? open.sites[0] : open.sites) : null;

  const weekMinutes = history.reduce((sum, r) => sum + (r.worked_minutes ?? 0), 0);
  const weekOvertime = history.reduce((sum, r) => sum + (r.overtime_minutes ?? 0), 0);

  return (
    <div className="cwrap">
      <div className="chead">
        <div>
          <h1 className="chead__h">{profile.full_name.split(" ")[0]}, here is your shift</h1>
          <p className="chead__lede">
            {open
              ? `On duty at ${openSite?.name ?? "your site"} since ${time(open.check_in_at!)}.`
              : "You are not checked in."}
          </p>
        </div>
      </div>

      <div className="cstats">
        <div className={`cstat${open ? " cstat--ok" : ""}`}>
          <span className="cstat__v">{open ? "On" : "Off"}</span>
          <span className="cstat__l">duty</span>
        </div>
        <div className="cstat">
          <span className="cstat__v">{hours(weekMinutes)}</span>
          <span className="cstat__l">worked, 7 days</span>
        </div>
        <div className="cstat">
          <span className="cstat__v">{hours(weekOvertime)}</span>
          <span className="cstat__l">overtime, 7 days</span>
        </div>
        <div className="cstat">
          <span className="cstat__v">{history.length}</span>
          <span className="cstat__l">shifts, 7 days</span>
        </div>
      </div>

      <div className="cpanel">
        <div className="cpanel__head">
          <h2 className="cpanel__h">Check in</h2>
        </div>
        <div className="cpanel__body">
          <p className="chead__lede" style={{ margin: 0 }}>
            Checking in needs your phone&apos;s location, and only works while you are standing
            inside your site&apos;s boundary. That control is the next piece being built — until
            then a supervisor records your attendance for you.
          </p>
        </div>
      </div>

      <div className="cpanel">
        <div className="cpanel__head">
          <h2 className="cpanel__h">Last 7 days</h2>
        </div>

        {history.length === 0 ? (
          <p className="cempty">
            <strong>No attendance recorded yet.</strong>
            Once you start checking in, every shift and its hours appear here.
          </p>
        ) : (
          <div className="ctable-scroll">
            <table className="ctable">
              <thead>
                <tr>
                  <th scope="col">Site</th>
                  <th scope="col">In</th>
                  <th scope="col">Out</th>
                  <th scope="col">Worked</th>
                  <th scope="col">Overtime</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => {
                  const place = Array.isArray(row.sites) ? row.sites[0] : row.sites;
                  return (
                    <tr key={row.id}>
                      <td>{place?.name ?? "—"}</td>
                      <td className="mono">{row.check_in_at ? time(row.check_in_at) : "—"}</td>
                      <td className="mono">{row.check_out_at ? time(row.check_out_at) : "—"}</td>
                      <td className="mono">{hours(row.worked_minutes)}</td>
                      <td className="mono">{hours(row.overtime_minutes)}</td>
                      <td>
                        <span
                          className={`cbadge ${
                            row.status === "late"
                              ? "cbadge--late"
                              : row.check_out_at
                                ? "cbadge--off"
                                : "cbadge--on"
                          }`}
                        >
                          {row.status}
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
          Your hours are calculated by the system from the times you check in and out. If something
          here looks wrong, tell your supervisor — corrections are recorded, never silent.
        </span>
      </p>
    </div>
  );
}
