"use client";

import { useMemo, useState, useTransition } from "react";
import { Building2, MapPinned, PowerOff, Power, Radio, Shapes } from "lucide-react";
import { toast } from "sonner";

import { setSiteActive } from "@/app/console/sites/actions";
import { SiteMap, type MapSite } from "@/components/console/site-map";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Panel } from "@/components/ui/panel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";

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
  /** Already narrowed to a `[lng, lat][]` ring by the page, or null. */
  ring: [number, number][] | null;
  shift_start: string | null;
  shift_end: string | null;
  grace_minutes: number;
  standard_shift_minutes: number;
  active: boolean;
  created_at: string;
  /** Guards checked in here right now. */
  onDuty: number;
  /** Guards who have a shift here, on duty or not. */
  assigned: number;
};

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

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-app-line-soft py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}

/**
 * Sites, as a map first and a table second.
 *
 * The order is the argument. A list of nine site names sorted alphabetically
 * tells a supervisor nothing they could act on; the same nine drawn across the
 * BTR, with the staffed ones lit and the empty ones grey, answers "where is
 * nobody standing right now" in one look. The table is underneath for the
 * things a map genuinely cannot show — grace windows, required accuracy, the
 * shift clock.
 *
 * Selecting a row focuses the map on that fence as well as opening its panel,
 * so the two halves of the screen stay talking to each other.
 */
export function SitesWorkspace({
  rows,
  canManage,
}: {
  rows: SiteRow[];
  canManage: boolean;
}) {
  const [pending, start] = useTransition();
  const [detail, setDetail] = useState<SiteRow | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Only live sites are drawn. A decommissioned fence on the map is a fence
  // somebody will try to send a guard to.
  const mapSites: MapSite[] = useMemo(
    () =>
      rows
        .filter((r) => r.active)
        .map((r) => ({
          id: r.id,
          name: r.name,
          client_name: r.client_name,
          district: r.district,
          lat: r.lat,
          lng: r.lng,
          geofence_radius_m: r.geofence_radius_m,
          ring: r.ring,
          onDuty: r.onDuty,
          assigned: r.assigned,
        })),
    [rows],
  );

  function toggle(site: SiteRow, active: boolean) {
    start(async () => {
      try {
        await setSiteActive(site.id, active);
        setConfirming(false);
        setDetail(null);
        toast.success(
          active ? "Site back in service" : "Site taken out of service",
          { description: site.name },
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not change the site.");
      }
    });
  }

  const columns: Column<SiteRow>[] = [
    {
      header: "Site",
      cell: (r) => (
        <span className="block">
          <span className="block font-medium">{r.name}</span>
          {r.client_name && (
            <span className="block text-xs text-muted-foreground">{r.client_name}</span>
          )}
        </span>
      ),
      sortValue: (r) => r.name,
      searchValue: (r) => `${r.name} ${r.client_name ?? ""} ${r.address ?? ""}`,
      printCell: (r) => r.name,
    },
    {
      header: "District",
      cell: (r) => r.district ?? "—",
      sortValue: (r) => r.district ?? "",
      searchValue: (r) => r.district ?? "",
    },
    {
      header: "Boundary",
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5 text-sm">
          {r.ring ? (
            <>
              <Shapes className="size-3.5 text-muted-foreground" strokeWidth={1.9} />
              Area · {r.ring.length} points
            </>
          ) : (
            <>
              <MapPinned className="size-3.5 text-muted-foreground" strokeWidth={1.9} />
              {r.geofence_radius_m} m radius
            </>
          )}
        </span>
      ),
      sortValue: (r) => (r.ring ? 1 : 0),
      printCell: (r) =>
        r.ring ? `Area · ${r.ring.length} points` : `${r.geofence_radius_m} m radius`,
    },
    {
      header: "Shift",
      cell: (r) => (
        <span className="tabular-nums">
          {r.shift_start ? `${clock(r.shift_start)}–${clock(r.shift_end)}` : "—"}
        </span>
      ),
      printCell: (r) =>
        r.shift_start ? `${clock(r.shift_start)}–${clock(r.shift_end)}` : "—",
    },
    {
      header: "On duty",
      className: "text-right",
      headClassName: "text-right",
      cell: (r) =>
        r.onDuty > 0 ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-primary tabular-nums">
            <Radio className="size-3.5" strokeWidth={2.2} />
            {r.onDuty}
          </span>
        ) : (
          <span className="tabular-nums text-muted-foreground">0</span>
        ),
      sortValue: (r) => r.onDuty,
      printCell: (r) => String(r.onDuty),
    },
    {
      header: "State",
      className: "text-right",
      headClassName: "text-right",
      cell: (r) => <StatusPill status={r.active ? "active" : "inactive"} />,
      sortValue: (r) => (r.active ? 1 : 0),
      printCell: (r) => (r.active ? "Active" : "Inactive"),
    },
  ];

  return (
    <div className="space-y-6">
      <Panel
        tone="sky"
        title="Deployment map"
        icon={MapPinned}
        bodyClassName="p-0 sm:p-0"
        action={
          <span className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-primary" /> staffed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-muted-foreground" /> empty
            </span>
          </span>
        }
      >
        {mapSites.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <MapPinned className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm font-medium">No sites in service.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              A site needs a boundary drawn around it before anyone can check in there.
            </p>
          </div>
        ) : (
          <SiteMap
            sites={mapSites}
            focus={detail?.active ? detail.id : undefined}
            height={400}
            className="rounded-none border-0"
          />
        )}
      </Panel>

      <Panel
        tone="slate"
        title={`${rows.length} ${rows.length === 1 ? "site" : "sites"}`}
        icon={Building2}
        bodyClassName="p-3 sm:p-4"
      >
        <DataTable
          columns={columns}
          data={rows}
          getRowKey={(r) => r.id}
          interactiveRows
          rowPreview={false}
          onRowClick={setDetail}
          printTitle="Sites"
          searchPlaceholder="Search by site, client or district…"
          emptyMessage="No sites registered. A site needs a boundary before anyone can check in there."
          rowClassName={(r) => (r.active ? undefined : "opacity-60")}
        />
      </Panel>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {detail.name}
                  <StatusPill status={detail.active ? "active" : "inactive"} />
                </SheetTitle>
                <SheetDescription>
                  {detail.client_name ?? "No client recorded"}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
                {detail.active && (
                  <SiteMap sites={mapSites} focus={detail.id} height={200} />
                )}

                <section>
                  <h3 className="mb-1 text-sm font-semibold">Where</h3>
                  <Fact label="Address" value={detail.address ?? "—"} />
                  <Fact label="District" value={detail.district ?? "—"} />
                  <Fact
                    label="Centre"
                    value={
                      <span className="font-mono tabular-nums">
                        {detail.lat.toFixed(6)}, {detail.lng.toFixed(6)}
                      </span>
                    }
                  />
                  <Fact
                    label="Boundary"
                    value={
                      detail.ring
                        ? `Drawn area, ${detail.ring.length} points`
                        : `Circle, ${detail.geofence_radius_m} m radius`
                    }
                  />
                  <Fact
                    label="Required accuracy"
                    value={<span className="font-mono">±{detail.max_accuracy_m} m</span>}
                  />
                </section>

                <section>
                  <h3 className="mb-1 text-sm font-semibold">The shift</h3>
                  <Fact
                    label="Window"
                    value={
                      detail.shift_start
                        ? `${clock(detail.shift_start)} – ${clock(detail.shift_end)}`
                        : "Not set"
                    }
                  />
                  <Fact label="Grace" value={`${detail.grace_minutes} min`} />
                  <Fact
                    label="Standard shift"
                    value={shiftHours(detail.standard_shift_minutes)}
                  />
                  <Fact label="On duty now" value={String(detail.onDuty)} />
                </section>

                <p className="text-xs text-muted-foreground">
                  A guard checking in here must be inside this boundary with a fix no
                  looser than ±{detail.max_accuracy_m} m. Anything beyond{" "}
                  {shiftHours(detail.standard_shift_minutes)} counts as overtime.
                </p>
              </div>

              {canManage && (
                <SheetFooter>
                  <Button
                    variant={detail.active ? "destructive" : "default"}
                    disabled={pending}
                    onClick={() =>
                      detail.active ? setConfirming(true) : toggle(detail, true)
                    }
                  >
                    {detail.active ? (
                      <>
                        <PowerOff data-icon="inline-start" />
                        Take out of service
                      </>
                    ) : (
                      <>
                        <Power data-icon="inline-start" />
                        Put back in service
                      </>
                    )}
                  </Button>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={() => {
          if (detail) toggle(detail, false);
        }}
        destructive
        title="Take this site out of service?"
        confirmLabel="Take out of service"
        description={
          detail
            ? `Nobody will be able to check in at ${detail.name}. Every punch already recorded there is kept, and it can be put back in service at any time.`
            : ""
        }
      />
    </div>
  );
}
