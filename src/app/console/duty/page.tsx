import type { Metadata } from "next";

import { Icon } from "@/components/Icon";
import { AttendanceTable, type AttendanceRow } from "@/components/console/tables";
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

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [openPunch, recent] = await Promise.all([
    supabase
      .from("attendance")
      .select("id, check_in_at, site_id, status, sites(name, address)")
      .eq("guard_id", profile.id)
      .is("check_out_at", null)
      .maybeSingle(),
    supabase
      .from("attendance")
      .select("id, check_in_at, check_out_at, worked_minutes, overtime_minutes, status, check_in_distance_m, sites(name)")
      .eq("guard_id", profile.id)
      .gte("check_in_at", ninetyDaysAgo.toISOString())
      .order("check_in_at", { ascending: false })
      .limit(500),
  ]);

  const open = openPunch.data;
  const history = recent.data ?? [];
  const openSite = open ? (Array.isArray(open.sites) ? open.sites[0] : open.sites) : null;

  const sinceWeek = weekAgo.toISOString();
  const thisWeek = history.filter((r) => (r.check_in_at ?? "") >= sinceWeek);

  const weekMinutes = thisWeek.reduce((sum, r) => sum + (r.worked_minutes ?? 0), 0);
  const weekOvertime = thisWeek.reduce((sum, r) => sum + (r.overtime_minutes ?? 0), 0);

  const rows: AttendanceRow[] = history.map((r) => {
    const place = Array.isArray(r.sites) ? r.sites[0] : r.sites;
    return {
      id: r.id,
      check_in_at: r.check_in_at,
      check_out_at: r.check_out_at,
      worked_minutes: r.worked_minutes,
      overtime_minutes: r.overtime_minutes,
      status: r.status,
      check_in_distance_m: r.check_in_distance_m,
      guard_name: null,
      guard_code: null,
      site_name: place?.name ?? null,
    };
  });

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
          <span className="cstat__v">{thisWeek.length}</span>
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

      <div className="cpanel cpanel--table">
        <div className="cpanel__head">
          <h2 className="cpanel__h">My shifts</h2>
        </div>
        <div className="cpanel__body">
          <AttendanceTable rows={rows} showGuard={false} />
        </div>
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
