import type { Metadata } from "next";

import { SiteForm } from "@/components/console/SiteForm";
import { SitesWorkspace, type SiteRow } from "@/components/console/SitesWorkspace";
import { Icon } from "@/components/Icon";
import { requireRoleSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sites" };
export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const session = await requireRoleSession("admin", "supervisor");
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("sites")
    .select(
      "id, name, client_name, address, district, lat, lng, geofence_radius_m, max_accuracy_m, polygon, shift_start, shift_end, grace_minutes, standard_shift_minutes, active, created_at",
    )
    .order("name");

  const sites = (data ?? []) as SiteRow[];
  const canManage = session.profile.role === "admin" && !session.impersonating;

  return (
    <div className="cwrap">
      <div className="chead">
        <div>
          <h1 className="chead__h">Sites</h1>
          <p className="chead__lede">
            Every client site and the boundary a guard must stand inside to mark attendance.
          </p>
        </div>
      </div>

      {canManage && (
        <div className="cpanel">
          <div className="cpanel__head">
            <h2 className="cpanel__h">New site</h2>
          </div>
          <SiteForm />
        </div>
      )}

      <div className="cpanel cpanel--table">
        <div className="cpanel__head">
          <h2 className="cpanel__h">
            {sites.length} {sites.length === 1 ? "site" : "sites"}
          </h2>
          <span className="ui-hint">Select a row to open it</span>
        </div>
        <div className="cpanel__body">
          <SitesWorkspace rows={sites} canManage={canManage} />
        </div>
      </div>

      <p className="admin-note">
        <Icon name="pin" />
        <span>
          Boundaries are drawn on a map rather than typed. Map tiles are served from this site&apos;s
          own origin and cached in the nbss bucket, so the content policy needs no exception for a
          map CDN.
        </span>
      </p>
    </div>
  );
}
