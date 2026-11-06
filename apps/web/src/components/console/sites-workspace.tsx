"use client";

import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { BellOff, Eye, MapPinPlus, MapPinned, Pencil, PowerOff, Power, Radio, Search, Shapes, Siren, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";

import { deleteLocationPin, deleteSite, setSiteActive, setSiteSiren, setSiteSos } from "@/app/console/sites/actions";
import { SiteForm, type PinStart } from "@/components/console/site-form";
import { SiteMap, type MapFieldPin, type MapSite } from "@/components/console/site-map";
import { SitePreviewDialog } from "@/components/console/site-preview";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";

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
  /** Whether anyone working here has the SOS button (0052). */
  sos_enabled: boolean;
  /** Whether an SOS here sounds a siren on phones, or only vibrates (0057). */
  sos_siren: boolean;
  created_at: string;
  /** Guards checked in here right now. */
  onDuty: number;
  /** Guards who have a shift here, on duty or not. */
  assigned: number;
};

type Filter = "all" | "staffed" | "empty" | "out";
const FILTERS: { key: Filter; label: string; test: (r: SiteRow) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "staffed", label: "Staffed", test: (r) => r.active && r.onDuty > 0 },
  { key: "empty", label: "Empty", test: (r) => r.active && r.onDuty === 0 },
  { key: "out", label: "Out of service", test: (r) => !r.active },
];

function clock(value: string | null): string {
  if (!value) return "-";
  const [h, m] = value.split(":");
  const hour = Number(h);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour < 12 ? "am" : "pm";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${m ?? "00"} ${suffix}`;
}

/**
 * Sites, laid out as Route history is: every site on the left (search, and
 * staffed / empty / out of service), the map in the middle, and the picked site's
 * details and controls on the right. Picking a site, from the list or from the
 * map's own "All sites" list, flies the map to its fence. Locations sent from the
 * field sit under the list and on the map, to register sites at.
 *
 * `?site=<id>` opens a site's full popup (`SitePreviewDialog`) directly.
 */
export function SitesWorkspace({
  rows,
  pins = [],
  canManage,
  canReview = false,
}: {
  rows: SiteRow[];
  /** Locations sent from the field, to register sites at. */
  pins?: MapFieldPin[];
  canManage: boolean;
  canReview?: boolean;
}) {
  const [pending, start] = useTransition();
  const params = useSearchParams();
  const [detailId, setDetailId] = useState<string | null>(params.get("site"));
  // Looked up by id so the open popup follows live updates to its row.
  const detail = rows.find((r) => r.id === detailId) ?? null;
  const setDetail = (r: SiteRow | null) => setDetailId(r?.id ?? null);
  // The site asked about taking out of service.
  const [confirming, setConfirming] = useState<SiteRow | null>(null);
  // The site being edited in the register form, and the one asked about deleting.
  const [editing, setEditing] = useState<SiteRow | null>(null);
  const [deleting, setDeleting] = useState<SiteRow | null>(null);
  // The site picked from the map's own list ("All sites" is null), and the field pin being looked at.
  const [mapPick, setMapPick] = useState<string | null>(params.get("site"));
  const picked = rows.find((r) => r.id === mapPick) ?? null;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pinPick, setPinPick] = useState<string | null>(null);
  const [registering, setRegistering] = useState<PinStart | null>(null);
  const [pinDeleting, setPinDeleting] = useState<MapFieldPin | null>(null);

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
        setConfirming(null);
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

  function toggleSos(site: SiteRow, enabled: boolean) {
    start(async () => {
      try {
        await setSiteSos(site.id, enabled);
        setDetail(null);
        toast.success(enabled ? "SOS switched on" : "SOS switched off", { description: site.name });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not change SOS for the site.");
      }
    });
  }

  function toggleSiren(site: SiteRow, enabled: boolean) {
    start(async () => {
      try {
        await setSiteSiren(site.id, enabled);
        setDetail(null);
        toast.success(enabled ? "Siren switched on" : "Siren switched off: SOS only vibrates", { description: site.name });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not change the siren for the site.");
      }
    });
  }

  function removePin(pin: MapFieldPin) {
    start(async () => {
      const r = await deleteLocationPin(pin.id);
      setPinDeleting(null);
      if (!r.ok) return void toast.error("Pin not deleted", { description: r.error });
      if (pinPick === pin.id) setPinPick(null);
      toast.success("Pin deleted", { description: pin.note ?? `Sent by ${pin.senderName}` });
    });
  }

  function remove(site: SiteRow) {
    start(async () => {
      const r = await deleteSite(site.id);
      setDeleting(null);
      if (!r.ok) return void toast.error("Site not deleted", { description: r.error });
      setDetail(null);
      if (mapPick === site.id) setMapPick(null);
      toast.success("Site deleted", { description: site.name });
    });
  }

  const q = query.trim().toLowerCase();
  const matches = (r: SiteRow) => !q || `${r.name} ${r.client_name ?? ""} ${r.district ?? ""} ${r.address ?? ""}`.toLowerCase().includes(q);
  const counts: Record<Filter, number> = {
    all: rows.length,
    staffed: rows.filter((r) => r.active && r.onDuty > 0).length,
    empty: rows.filter((r) => r.active && r.onDuty === 0).length,
    out: rows.filter((r) => !r.active).length,
  };
  const listed = rows.filter((r) => matches(r) && FILTERS.find((f) => f.key === filter)!.test(r));
  const pinsListed = pins.filter((p) => !q || `${p.note ?? ""} ${p.senderName} ${p.siteName ?? ""}`.toLowerCase().includes(q));

  /** The buttons for a site, in the details column and in its full popup. */
  const actionsFor = (site: SiteRow, fromDialog: boolean) => (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setEditing(site);
          if (fromDialog) setDetail(null);
        }}
      >
        <Pencil data-icon="inline-start" />
        Edit site
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => toggleSos(site, !site.sos_enabled)}>
        {site.sos_enabled ? <BellOff data-icon="inline-start" /> : <Siren data-icon="inline-start" />}
        {site.sos_enabled ? "Switch SOS off" : "Switch SOS on"}
      </Button>
      {site.sos_enabled && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => toggleSiren(site, !site.sos_siren)}>
          {site.sos_siren ? <VolumeX data-icon="inline-start" /> : <Volume2 data-icon="inline-start" />}
          {site.sos_siren ? "Siren off (vibrate only)" : "Siren on"}
        </Button>
      )}
      <Button size="sm" variant={site.active ? "destructive" : "default"} disabled={pending} onClick={() => (site.active ? setConfirming(site) : toggle(site, true))}>
        {site.active ? <PowerOff data-icon="inline-start" /> : <Power data-icon="inline-start" />}
        {site.active ? "Take out of service" : "Put back in service"}
      </Button>
      {/* Only an empty site can go for good; the action refuses one with history. */}
      {site.onDuty === 0 && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setDeleting(site)} className="text-destructive hover:text-destructive">
          <Trash2 data-icon="inline-start" />
          Delete
        </Button>
      )}
    </>
  );

  return (
    // Route history's shape: every site on the left, the map in the middle, the picked
    // site on the right. On a phone the map comes first, then the site, then the list.
    <div className={cn("grid gap-4", picked ? "xl:grid-cols-[320px_minmax(0,1fr)_340px]" : "xl:grid-cols-[320px_minmax(0,1fr)]")}>
      {/* Sites, and the locations sent from the field */}
      <aside className="order-3 flex max-h-[75vh] min-h-0 flex-col overflow-hidden rounded-2xl border border-app-line bg-card xl:order-1 xl:h-[calc(100dvh-190px)] xl:max-h-none">
        <div className="space-y-3 border-b border-app-line-soft p-3">
          <label className="flex h-10 items-center gap-2 rounded-full bg-muted/70 px-3.5 ring-1 ring-border/60 focus-within:ring-2 focus-within:ring-ring/50">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${rows.length} sites by name, client or district`}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold ring-1",
                  filter === f.key ? "bg-foreground text-background ring-foreground" : "ring-border hover:bg-muted",
                )}
              >
                {f.label} <span className="tabular-nums opacity-70">{counts[f.key]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">No sites registered. A site needs a boundary before anyone can check in there.</p>
          )}
          {rows.length > 0 && listed.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No site matches.</p>}
          <ul className="divide-y divide-app-line-soft">
            {listed.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPinPick(null);
                    setMapPick(mapPick === r.id ? null : r.id);
                    // The list sits under the map on narrow screens: bring the map back into view.
                    if (mapPick !== r.id && window.matchMedia("(max-width: 1279px)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={cn("flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/60", mapPick === r.id && "bg-sky-50 ring-1 ring-sky-500/30 ring-inset dark:bg-sky-500/10", !r.active && "opacity-60")}
                >
                  <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", !r.active ? "bg-muted-foreground/40" : r.onDuty > 0 ? "bg-primary" : "bg-muted-foreground")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{r.name}</span>
                      {r.onDuty > 0 ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary tabular-nums">
                          <Radio className="size-3.5" strokeWidth={2.2} />
                          {r.onDuty}
                        </span>
                      ) : !r.active ? (
                        <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">Out of service</span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      {r.ring ? <Shapes className="size-3 shrink-0" /> : <MapPinned className="size-3 shrink-0" />}
                      <span className="truncate">
                        {[r.client_name, r.district, r.ring ? `Area · ${r.ring.length} points` : `${r.geofence_radius_m} m`].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {pinsListed.length > 0 && (
            <div className="border-t border-app-line p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <MapPinPlus className="size-4" /> Sent from the field · {pinsListed.length}
              </p>
              <ul className="space-y-1.5">
                {pinsListed.map((p) => (
                  <li key={p.id} className={cn("flex items-center gap-2 rounded-xl bg-amber-500/5 px-2.5 py-2 text-sm", pinPick === p.id && "ring-1 ring-amber-500/40")}>
                    <button
                      type="button"
                      onClick={() => {
                        setMapPick(null);
                        setPinPick(p.id);
                        if (window.matchMedia("(max-width: 1279px)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate font-medium">{p.note || "No note"}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.senderName} ·{" "}
                        {new Date(p.capturedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })} · ±
                        {Math.round(p.accuracy)} m{p.siteName ? ` · ${p.siteName}` : ""}
                      </span>
                    </button>
                    {canManage && !p.siteName && (
                      <button
                        type="button"
                        onClick={() => setRegistering({ id: p.id, lat: p.lat, lng: p.lng, note: p.note })}
                        aria-label="Register a site here"
                        title="Register a site here"
                        className="grid size-8 shrink-0 place-items-center rounded-full text-primary ring-1 ring-border hover:bg-muted"
                      >
                        <MapPinPlus className="size-3.5" />
                      </button>
                    )}
                    {canReview && (
                      <button
                        type="button"
                        onClick={() => setPinDeleting(p)}
                        aria-label="Delete pin"
                        title="Delete pin"
                        className="grid size-8 shrink-0 place-items-center rounded-full text-destructive ring-1 ring-border hover:bg-muted"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>

      {/* The map */}
      <div className="order-1 h-[62vh] min-h-[420px] xl:order-2 xl:h-[calc(100dvh-190px)]">
        <SiteMap
          sites={mapSites}
          height="100%"
          className="h-full"
          search
          selected={mapPick}
          onSelect={(id) => {
            setPinPick(null);
            setMapPick(id);
          }}
          pins={pins}
          selectedPin={pinPick}
          onRegisterPin={canManage ? (p) => setRegistering({ id: p.id, lat: p.lat, lng: p.lng, note: p.note }) : undefined}
          onDeletePin={canReview ? setPinDeleting : undefined}
        />
      </div>

      {/* The picked site */}
      {picked && (
        <aside className="order-2 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-app-line bg-card xl:order-3 xl:h-[calc(100dvh-190px)]">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="p-4 pb-3">
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => setDetail(picked)} className="block min-w-0 flex-1 text-left text-base font-semibold hover:underline">
                  {picked.name}
                </button>
                <button type="button" onClick={() => setMapPick(null)} aria-label="Back to every site" className="grid size-7 shrink-0 place-items-center rounded-full hover:bg-muted">
                  <X className="size-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{[picked.client_name ?? "No client recorded", picked.district].filter(Boolean).join(" · ")}</p>
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                <StatusPill status={picked.active ? "active" : "inactive"} label={picked.active ? "In service" : "Out of service"} />
                {picked.sos_enabled && <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-700">SOS {picked.sos_siren ? "· siren" : "· vibrate"}</span>}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-app-line-soft px-4 py-3">
              <div className="rounded-xl bg-emerald-500/10 p-3">
                <p className="text-xs text-muted-foreground">On duty now</p>
                <p className="text-lg font-semibold tabular-nums">{picked.onDuty}</p>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs text-muted-foreground">Assigned</p>
                <p className="text-lg font-semibold tabular-nums">{picked.assigned}</p>
              </div>
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 border-t border-app-line-soft px-4 py-3 text-sm">
              <dt className="text-muted-foreground">Address</dt>
              <dd className="truncate">{picked.address ?? "-"}</dd>
              <dt className="text-muted-foreground">Boundary</dt>
              <dd>{picked.ring ? `Area · ${picked.ring.length} points` : `${picked.geofence_radius_m} m radius`}</dd>
              <dt className="text-muted-foreground">Shift</dt>
              <dd className="tabular-nums">{picked.shift_start ? `${clock(picked.shift_start)}–${clock(picked.shift_end)}` : "Not fixed"}</dd>
              <dt className="text-muted-foreground">Grace</dt>
              <dd className="tabular-nums">{picked.grace_minutes} min</dd>
              <dt className="text-muted-foreground">Standard shift</dt>
              <dd className="tabular-nums">{picked.standard_shift_minutes} min</dd>
              <dt className="text-muted-foreground">GPS needed</dt>
              <dd className="tabular-nums">±{picked.max_accuracy_m} m</dd>
            </dl>
            <div className="space-y-2 border-t border-app-line-soft px-4 py-3">
              <Button size="sm" className="w-full" onClick={() => setDetail(picked)}>
                <Eye data-icon="inline-start" />
                Roster, guards on duty and SOS
              </Button>
              {canManage && <div className="flex flex-wrap gap-2">{actionsFor(picked, false)}</div>}
            </div>
          </div>
        </aside>
      )}

      <SitePreviewDialog
        site={detail}
        onClose={() => setDetail(null)}
        canReview={canReview}
        actions={canManage && detail ? actionsFor(detail, true) : null}
      />

      {editing && <SiteForm key={editing.id} site={editing} onClose={() => setEditing(null)} />}
      {registering && <SiteForm key={registering.id} fromPin={registering} onClose={() => setRegistering(null)} />}

      <ConfirmDialog
        open={!!pinDeleting}
        onOpenChange={(v) => !v && setPinDeleting(null)}
        onConfirm={() => {
          if (pinDeleting) removePin(pinDeleting);
        }}
        destructive
        title="Delete this pin?"
        confirmLabel="Delete pin"
        description={
          pinDeleting
            ? `The location ${pinDeleting.senderName} sent${pinDeleting.note ? ` (“${pinDeleting.note}”)` : ""} is removed.${pinDeleting.siteName ? ` ${pinDeleting.siteName}, registered from it, stays.` : ""}`
            : ""
        }
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove(deleting);
        }}
        destructive
        title="Delete this site for good?"
        confirmLabel="Delete site"
        description={
          deleting
            ? `${deleting.name} and its fence, roster postings and future shifts are removed, and it cannot be undone. A site where anyone has ever checked in or raised an SOS cannot be deleted: take it out of service instead, which keeps its records.`
            : ""
        }
      />

      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(v) => !v && setConfirming(null)}
        onConfirm={() => {
          if (confirming) toggle(confirming, false);
        }}
        destructive
        title="Take this site out of service?"
        confirmLabel="Take out of service"
        description={
          confirming
            ? `Nobody will be able to check in at ${confirming.name}. Every punch already recorded there is kept, and it can be put back in service at any time.`
            : ""
        }
      />
    </div>
  );
}
