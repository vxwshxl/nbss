import type { Metadata } from "next";

import { Icon } from "@/components/Icon";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sites" };
export const dynamic = "force-dynamic";

export default async function SitesPage() {
  await requireRole("admin", "supervisor");
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("sites")
    .select("id, name, client_name, district, lat, lng, geofence_radius_m, active")
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
          <h2 className="cpanel__h">{sites.length} site{sites.length === 1 ? "" : "s"}</h2>
        </div>

        {sites.length === 0 ? (
          <p className="cempty">
            <strong>No sites registered.</strong>
            A site needs a location and a radius before anyone can check in there.
          </p>
        ) : (
          <div className="ctable-scroll">
            <table className="ctable">
              <thead>
                <tr>
                  <th scope="col">Site</th>
                  <th scope="col">Client</th>
                  <th scope="col">District</th>
                  <th scope="col">Coordinates</th>
                  <th scope="col">Fence</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.client_name ?? "—"}</td>
                    <td>{s.district ?? "—"}</td>
                    <td className="mono">
                      {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                    </td>
                    <td className="mono">{s.geofence_radius_m} m</td>
                    <td>
                      <span className={`cbadge ${s.active ? "cbadge--on" : "cbadge--off"}`}>
                        {s.active ? "active" : "inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
