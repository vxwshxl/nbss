import type { Metadata } from "next";

import { Icon } from "@/components/Icon";
import { site } from "@/content/site";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireRole("admin");
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("audit_log")
    .select("id, actor_code, action, entity, entity_id, ip, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = data ?? [];

  return (
    <div className="cwrap">
      <div className="chead">
        <div>
          <h1 className="chead__h">Audit log</h1>
          <p className="chead__lede">
            Every privileged action, in the order it happened. Append-only — nothing here can be
            edited or removed, including by an administrator.
          </p>
        </div>
      </div>

      <div className="cpanel">
        {rows.length === 0 ? (
          <p className="cempty">
            <strong>Nothing logged yet.</strong>
            Sign-ins, attendance corrections and roster changes are recorded here.
          </p>
        ) : (
          <div className="ctable-scroll">
            <table className="ctable">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">Action</th>
                  <th scope="col">Entity</th>
                  <th scope="col">From</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">
                      {new Date(r.created_at).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                        timeZone: site.timeZone,
                      })}
                    </td>
                    <td className="mono">{r.actor_code ?? "—"}</td>
                    <td>{r.action}</td>
                    <td>{r.entity ?? "—"}</td>
                    <td className="mono">{r.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="admin-note">
        <Icon name="key" />
        <span>Retained indefinitely. Treat it as a business record.</span>
      </p>
    </div>
  );
}
