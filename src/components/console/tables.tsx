"use client";

import { DataTable, type Column } from "@/components/console/DataTable";
import { byDate, byNum, byText } from "@/lib/hooks/useTableControls";

/**
 * Column definitions for the console's tables.
 *
 * These live in a client module because a column carries `render` and `sort`
 * functions, and functions cannot cross the server/client boundary. Each page
 * stays a Server Component that fetches rows and hands this plain data.
 *
 * Formatting is done here rather than on the server for the same reason the
 * pages pin `Asia/Kolkata`: these values are read by a desk in Kokrajhar, and
 * a raw UTC timestamp is not what that desk means by "when".
 */

const IST = "Asia/Kolkata";

function dateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  });
}

function hours(minutes: number | null): string {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

function stateClass(status: string, closed: boolean): string {
  if (status === "late" || status === "pending_review" || status === "rejected") return "cbadge--late";
  return closed ? "cbadge--off" : "cbadge--on";
}

/* ------------------------------------------------------------------ people */

export type PersonRow = {
  id: string;
  employee_code: string;
  full_name: string;
  role: string;
  phone: string | null;
  active: boolean;
  joined_at: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  supervisor: "Supervisor",
  guard: "Guard",
  client: "Client",
};

export function PeopleTable({ rows }: { rows: PersonRow[] }) {
  const columns: Column<PersonRow>[] = [
    {
      key: "code",
      label: "Code",
      mono: true,
      sort: byText((r) => r.employee_code),
      render: (r) => r.employee_code,
    },
    { key: "name", label: "Name", sort: byText((r) => r.full_name), render: (r) => r.full_name },
    {
      key: "role",
      label: "Role",
      sort: byText((r) => r.role),
      render: (r) => ROLE_LABEL[r.role] ?? r.role,
    },
    { key: "phone", label: "Phone", mono: true, render: (r) => r.phone ?? "—" },
    {
      key: "joined",
      label: "Joined",
      mono: true,
      sort: byDate((r) => r.joined_at),
      defaultDir: "desc",
      render: (r) =>
        r.joined_at
          ? new Date(r.joined_at).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              timeZone: IST,
            })
          : "—",
    },
    {
      key: "state",
      label: "State",
      sort: byNum((r) => (r.active ? 1 : 0)),
      render: (r) => (
        <span className={`cbadge ${r.active ? "cbadge--on" : "cbadge--off"}`}>
          {r.active ? "active" : "inactive"}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getKey={(r) => r.id}
      persistKey="nbss.table.people"
      initialSort="code"
      initialDir="asc"
      searchPlaceholder="Search by name, code or phone…"
      searchFields={(r) => [r.employee_code, r.full_name, r.phone, ROLE_LABEL[r.role]]}
      dateField={(r) => r.joined_at}
      empty={{
        title: "No accounts yet.",
        body: (
          <>
            Create one with <code>node scripts/create-user.mjs</code>.
          </>
        ),
      }}
    />
  );
}

/* ------------------------------------------------------------------- sites */

export type SiteRow = {
  id: string;
  name: string;
  client_name: string | null;
  district: string | null;
  lat: number;
  lng: number;
  geofence_radius_m: number;
  active: boolean;
  created_at: string;
};

export function SitesTable({ rows }: { rows: SiteRow[] }) {
  const columns: Column<SiteRow>[] = [
    { key: "name", label: "Site", sort: byText((r) => r.name), render: (r) => r.name },
    {
      key: "client",
      label: "Client",
      sort: byText((r) => r.client_name),
      render: (r) => r.client_name ?? "—",
    },
    {
      key: "district",
      label: "District",
      sort: byText((r) => r.district),
      render: (r) => r.district ?? "—",
    },
    {
      key: "coords",
      label: "Coordinates",
      mono: true,
      render: (r) => `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`,
    },
    {
      key: "fence",
      label: "Fence",
      mono: true,
      sort: byNum((r) => r.geofence_radius_m),
      render: (r) => `${r.geofence_radius_m} m`,
    },
    {
      key: "state",
      label: "State",
      sort: byNum((r) => (r.active ? 1 : 0)),
      render: (r) => (
        <span className={`cbadge ${r.active ? "cbadge--on" : "cbadge--off"}`}>
          {r.active ? "active" : "inactive"}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getKey={(r) => r.id}
      persistKey="nbss.table.sites"
      initialSort="name"
      initialDir="asc"
      searchPlaceholder="Search by site, client or district…"
      searchFields={(r) => [r.name, r.client_name, r.district]}
      dateField={(r) => r.created_at}
      empty={{
        title: "No sites registered.",
        body: "A site needs a location and a radius before anyone can check in there.",
      }}
    />
  );
}

/* -------------------------------------------------------------- attendance */

export type AttendanceRow = {
  id: string;
  check_in_at: string | null;
  check_out_at: string | null;
  worked_minutes: number | null;
  overtime_minutes: number | null;
  status: string;
  check_in_distance_m: number | null;
  guard_name: string | null;
  guard_code: string | null;
  site_name: string | null;
};

export function AttendanceTable({ rows, showGuard }: { rows: AttendanceRow[]; showGuard: boolean }) {
  const columns: Column<AttendanceRow>[] = [
    ...(showGuard
      ? [
          {
            key: "guard",
            label: "Guard",
            sort: byText((r: AttendanceRow) => r.guard_name),
            render: (r: AttendanceRow) => r.guard_name ?? "—",
          },
        ]
      : []),
    { key: "site", label: "Site", sort: byText((r) => r.site_name), render: (r) => r.site_name ?? "—" },
    {
      key: "in",
      label: "In",
      mono: true,
      sort: byDate((r) => r.check_in_at),
      defaultDir: "desc",
      render: (r) => dateTime(r.check_in_at),
    },
    {
      key: "out",
      label: "Out",
      mono: true,
      sort: byDate((r) => r.check_out_at),
      defaultDir: "desc",
      render: (r) => dateTime(r.check_out_at),
    },
    {
      key: "worked",
      label: "Worked",
      mono: true,
      sort: byNum((r) => r.worked_minutes),
      defaultDir: "desc",
      render: (r) => hours(r.worked_minutes),
    },
    {
      key: "overtime",
      label: "Overtime",
      mono: true,
      sort: byNum((r) => r.overtime_minutes),
      defaultDir: "desc",
      render: (r) => hours(r.overtime_minutes),
    },
    {
      key: "distance",
      label: "Distance",
      mono: true,
      sort: byNum((r) => r.check_in_distance_m),
      defaultDir: "desc",
      render: (r) =>
        r.check_in_distance_m === null ? "—" : `${Math.round(r.check_in_distance_m)} m`,
    },
    {
      key: "state",
      label: "State",
      sort: byText((r) => r.status),
      render: (r) => (
        <span className={`cbadge ${stateClass(r.status, !!r.check_out_at)}`}>{r.status}</span>
      ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getKey={(r) => r.id}
      persistKey={`nbss.table.attendance.${showGuard ? "all" : "mine"}`}
      initialSort="in"
      initialDir="desc"
      searchPlaceholder={showGuard ? "Search by guard, code or site…" : "Search by site…"}
      searchFields={(r) => [r.guard_name, r.guard_code, r.site_name, r.status]}
      dateField={(r) => r.check_in_at}
      empty={{
        title: "No attendance recorded yet.",
        body: "Punches appear here as soon as check-in is live.",
      }}
    />
  );
}

/* --------------------------------------------------------------- audit log */

export type AuditRow = {
  id: number;
  actor_code: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  ip: string | null;
  created_at: string;
};

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const columns: Column<AuditRow>[] = [
    {
      key: "when",
      label: "When",
      mono: true,
      sort: byDate((r) => r.created_at),
      defaultDir: "desc",
      render: (r) => dateTime(r.created_at),
    },
    { key: "who", label: "Who", mono: true, sort: byText((r) => r.actor_code), render: (r) => r.actor_code ?? "—" },
    { key: "action", label: "Action", sort: byText((r) => r.action), render: (r) => r.action },
    { key: "entity", label: "Entity", sort: byText((r) => r.entity), render: (r) => r.entity ?? "—" },
    { key: "ip", label: "From", mono: true, render: (r) => r.ip ?? "—" },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getKey={(r) => String(r.id)}
      persistKey="nbss.table.audit"
      initialSort="when"
      initialDir="desc"
      searchPlaceholder="Search by person, action or address…"
      searchFields={(r) => [r.actor_code, r.action, r.entity, r.entity_id, r.ip]}
      dateField={(r) => r.created_at}
      empty={{
        title: "Nothing logged yet.",
        body: "Sign-ins, attendance corrections and roster changes are recorded here.",
      }}
    />
  );
}
