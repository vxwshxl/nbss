"use client";

import { useState, useTransition } from "react";

import { setSiteActive } from "@/app/console/sites/actions";
import { DataTable, type Column } from "@/components/console/DataTable";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { byNum, byText } from "@/lib/hooks/useTableControls";

export type SiteRow = {
  id: string;
  name: string;
  client_name: string | null;
  address: string | null;
  district: string | null;
  lat: number;
  lng: number;
  geofence_radius_m: number;
  max_accuracy_m: number;
  polygon: unknown;
  shift_start: string | null;
  shift_end: string | null;
  grace_minutes: number;
  standard_shift_minutes: number;
  active: boolean;
  created_at: string;
};

function ringLength(polygon: unknown): number {
  return Array.isArray(polygon) ? polygon.length : 0;
}

function clock(value: string | null): string {
  if (!value) return "—";
  const [h, m] = value.split(":");
  const hour = Number(h);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour < 12 ? "am" : "pm";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${m ?? "00"} ${suffix}`;
}

function shiftHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function SitesWorkspace({ rows, canManage }: { rows: SiteRow[]; canManage: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [detail, setDetail] = useState<SiteRow | null>(null);
  const [confirming, setConfirming] = useState(false);

  const toggle = (site: SiteRow, active: boolean) =>
    start(async () => {
      try {
        await setSiteActive(site.id, active);
        setConfirming(false);
        setDetail(null);
        toast.ok(active ? "Site back in service" : "Site taken out of service", site.name);
      } catch (e) {
        toast.error("Could not change the site", e instanceof Error ? e.message : undefined);
      }
    });

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
      key: "fence",
      label: "Boundary",
      mono: true,
      sort: byNum((r) => (ringLength(r.polygon) ? 1 : 0)),
      render: (r) =>
        ringLength(r.polygon) >= 3 ? `Area · ${ringLength(r.polygon)} points` : `${r.geofence_radius_m} m radius`,
    },
    {
      key: "shift",
      label: "Shift",
      mono: true,
      render: (r) => (r.shift_start ? `${clock(r.shift_start)}–${clock(r.shift_end)}` : "—"),
    },
    {
      key: "state",
      label: "State",
      sort: byNum((r) => (r.active ? 1 : 0)),
      render: (r) => (
        <span className={`cbadge ${r.active ? "cbadge--on" : "cbadge--off"}`}>
          {r.active ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        getKey={(r) => r.id}
        onRowClick={setDetail}
        persistKey="nbss.table.sites"
        initialSort="name"
        initialDir="asc"
        searchPlaceholder="Search by site, client or district…"
        searchFields={(r) => [r.name, r.client_name, r.district, r.address]}
        dateField={(r) => r.created_at}
        empty={{
          title: "No sites registered.",
          body: "A site needs a boundary before anyone can check in there.",
        }}
      />

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        wide
        title={detail?.name ?? ""}
        description={detail?.client_name ?? undefined}
        footer={
          detail && canManage ? (
            <button
              className={`btn btn--sm ${detail.active ? "btn--danger" : "btn--solid"}`}
              type="button"
              disabled={pending}
              onClick={() => (detail.active ? setConfirming(true) : toggle(detail, true))}
            >
              {detail.active ? "Take out of service" : "Put back in service"}
            </button>
          ) : null
        }
      >
        {detail && (
          <>
            <dl className="ui-dl">
              <dt>Address</dt>
              <dd>{detail.address ?? "—"}</dd>

              <dt>District</dt>
              <dd>{detail.district ?? "—"}</dd>

              <dt>Centre</dt>
              <dd className="mono">
                {detail.lat.toFixed(6)}, {detail.lng.toFixed(6)}
              </dd>

              <dt>Boundary</dt>
              <dd>
                {ringLength(detail.polygon) >= 3
                  ? `Drawn area with ${ringLength(detail.polygon)} points`
                  : `Circle, ${detail.geofence_radius_m} m radius`}
              </dd>

              <dt>Required accuracy</dt>
              <dd className="mono">±{detail.max_accuracy_m} m</dd>

              <dt>Shift</dt>
              <dd className="mono">
                {detail.shift_start ? `${clock(detail.shift_start)} – ${clock(detail.shift_end)}` : "Not set"}
              </dd>

              <dt>Grace</dt>
              <dd className="mono">{detail.grace_minutes} min</dd>

              <dt>Standard shift</dt>
              <dd className="mono">{shiftHours(detail.standard_shift_minutes)}</dd>

              <dt>State</dt>
              <dd>
                <span className={`cbadge ${detail.active ? "cbadge--on" : "cbadge--off"}`}>
                  {detail.active ? "Active" : "Inactive"}
                </span>
              </dd>
            </dl>

            <p className="ui-hint">
              A guard checking in here must be inside this boundary with a fix no looser than
              ±{detail.max_accuracy_m} m. Anything beyond {shiftHours(detail.standard_shift_minutes)} counts
              as overtime.
            </p>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => detail && toggle(detail, false)}
        pending={pending}
        danger
        title="Take this site out of service?"
        confirmLabel="Take out of service"
        body={
          detail
            ? `Nobody will be able to check in at ${detail.name}. Every punch already recorded there is kept, and it can be put back in service at any time.`
            : ""
        }
      />
    </>
  );
}
