import type { Metadata } from "next";

import { Icon } from "@/components/Icon";
import { SitesTable } from "@/components/console/tables";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sites" };
export const dynamic = "force-dynamic";

export default async function SitesPage() {
  await requireRole("admin", "supervisor");
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("sites")
    .select("id, name, client_name, district, lat, lng, geofence_radius_m, active, created_at")
    .order("name");

  const sites = data ?? [];

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

      <div className="cpanel cpanel--table">
        <div className="cpanel__head">
          <h2 className="cpanel__h">{sites.length} site{sites.length === 1 ? "" : "s"}</h2>
        </div>
        <div className="cpanel__body">
          <SitesTable rows={sites} />
        </div>
      </div>

      <p className="admin-note">
        <Icon name="pin" />
        <span>
          Registering a site by dropping a pin on a map is the next piece of work, together with
          the check-in control it enables.
        </span>
      </p>
    </div>
  );
}
