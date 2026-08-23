import type { Metadata } from "next";

import { Icon } from "@/components/Icon";
import { SiteForm } from "@/components/console/SiteForm";
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

      <div className="cpanel">
        <div className="cpanel__head">
          <h2 className="cpanel__h">New site</h2>
        </div>
        <SiteForm />
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
          Coordinates can be pasted straight from Google Maps. A drawn map with a draggable pin
          arrives with the tile proxy, which keeps map tiles behind this site&apos;s own origin
          rather than opening the content policy to a CDN.
        </span>
      </p>
    </div>
  );
}
