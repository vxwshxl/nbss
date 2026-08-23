import type { Metadata } from "next";

import { Icon } from "@/components/Icon";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Guards" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  supervisor: "Supervisor",
  guard: "Guard",
  client: "Client",
};

export default async function GuardsPage() {
  await requireRole("admin", "supervisor");
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("profiles")
    .select("id, employee_code, full_name, role, phone, active, joined_at")
    .order("employee_code");

  const people = data ?? [];

  return (
    <div className="cwrap">
      <div className="chead">
        <div>
          <h1 className="chead__h">People</h1>
          <p className="chead__lede">
            Everyone with a login. A guard signs in with the employee code shown here.
          </p>
        </div>
      </div>

      <div className="cpanel">
        <div className="cpanel__head">
          <h2 className="cpanel__h">{people.length} account{people.length === 1 ? "" : "s"}</h2>
        </div>

        {people.length === 0 ? (
          <p className="cempty">
            <strong>No accounts yet.</strong>
            Create one with <code>node scripts/create-user.mjs</code>.
          </p>
        ) : (
          <div className="ctable-scroll">
            <table className="ctable">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Phone</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.employee_code}</td>
                    <td>{p.full_name}</td>
                    <td>{ROLE_LABEL[p.role] ?? p.role}</td>
                    <td className="mono">{p.phone ?? "—"}</td>
                    <td>
                      <span className={`cbadge ${p.active ? "cbadge--on" : "cbadge--off"}`}>
                        {p.active ? "active" : "inactive"}
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
        <Icon name="shield-alt" />
        <span>
          Adding and deactivating people from this screen — along with PIN resets and the document
          vault — is Phase 2. For now accounts are created from the command line.
        </span>
      </p>
    </div>
  );
}
