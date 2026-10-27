"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, MapPinPlus, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import { createSite, updateSite } from "@/app/console/sites/actions";
import { emptySiteForm, type SiteFormState } from "@/app/console/sites/site-form-state";
import { FenceMap, type Fence } from "@/components/console/fence-map";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";


function Submit({ disabled, editing }: { disabled: boolean; editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {editing ? <Save data-icon="inline-start" /> : <MapPinPlus data-icon="inline-start" />}
      {pending ? "Saving…" : editing ? "Save changes" : "Register site"}
    </Button>
  );
}

/** A saved site, as the edit form starts from it. */
export type EditableSite = {
  id: string;
  name: string;
  client_name: string | null;
  address: string | null;
  district: string | null;
  lat: number;
  lng: number;
  geofence_radius_m: number;
  ring: [number, number][] | null;
  max_accuracy_m: number;
  grace_minutes: number;
  standard_shift_minutes: number;
  shift_start: string | null;
  shift_end: string | null;
};

function stateOf(site: EditableSite): SiteFormState {
  return {
    ok: false,
    values: {
      name: site.name,
      client_name: site.client_name ?? "",
      address: site.address ?? "",
      district: site.district ?? "",
      lat: String(site.lat),
      lng: String(site.lng),
      geofence_radius_m: String(site.geofence_radius_m),
      max_accuracy_m: String(site.max_accuracy_m),
      grace_minutes: String(site.grace_minutes),
      standard_shift_minutes: String(site.standard_shift_minutes),
      // "09:55:00" from Postgres; the picker works in "09:55".
      shift_start: site.shift_start?.slice(0, 5) ?? "",
      shift_end: site.shift_end?.slice(0, 5) ?? "",
    },
  };
}

function fenceOf(site: EditableSite | undefined): Fence {
  if (!site) return { mode: "radius", lat: 0, lng: 0, radius: 150 };
  return site.ring && site.ring.length >= 3
    ? { mode: "polygon", lat: site.lat, lng: site.lng, ring: site.ring }
    : { mode: "radius", lat: site.lat, lng: site.lng, radius: site.geofence_radius_m };
}

/** A labelled field, since this form has eleven of them and they are all alike. */
function Field({
  name,
  label,
  hint,
  children,
  className,
}: {
  name: string;
  label: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={name} className="mb-2">
        {label}
      </Label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Registering a site.
 *
 * The boundary is drawn rather than typed. Coordinates entered by hand are the
 * easiest thing on this form to get quietly wrong — a transposed digit puts a
 * fence in the wrong district and every check-in against it is meaningless —
 * and nobody can proofread a decimal against a place they know. On a map the
 * mistake is visible immediately.
 *
 * A dialog rather than a panel that expands in place: the map wants real size,
 * and an inline form that pushes the site table two screens down is a form that
 * makes you lose your place every time you open it.
 *
 * Given a `site`, the same form edits it: opened by the caller (the site's
 * popup), starting from what is saved, and closing through `onClose`.
 */
export function SiteForm({ site, onClose }: { site?: EditableSite; onClose?: () => void } = {}) {
  const editing = !!site;
  const [state, action] = useActionState(editing ? updateSite : createSite, site ? stateOf(site) : emptySiteForm);
  const [open, setOpenState] = useState(editing);
  const setOpen = (v: boolean) => {
    setOpenState(v);
    if (!v) onClose?.();
  };
  const [fence, setFence] = useState<Fence>(() => fenceOf(site));

  // A save closes the dialog and says so. Before, the form emptied itself and
  // stayed open, which read as "nothing happened" and invited a duplicate.
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.ok && state.created) {
      setOpenState(false);
      setFence(fenceOf(undefined));
    }
  }
  useEffect(() => {
    if (!state.ok || !state.created) return;
    toast.success(editing ? "Site saved" : "Site registered", { description: state.created });
    if (editing) onClose?.();
  }, [state, editing, onClose]);

  const placed =
    fence.mode === "radius" ? !!(fence.lat || fence.lng) : fence.ring.length >= 3;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!editing && (
        <DialogTrigger asChild>
          <Button>
            <Plus data-icon="inline-start" />
            Register a site
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-h-[94dvh] overflow-y-auto p-6 sm:max-w-[min(72rem,calc(100%-3rem))] sm:p-7">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${site.name}` : "Register a site"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Move or redraw the boundary, or change the details and shift rules. Punches already recorded keep their verdict; the new fence judges the next ones."
              : "Place the boundary on the map, then describe the site and how attendance inside it is judged."}
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          {site && <input type="hidden" name="id" value={site.id} />}
          {state.error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive lg:col-span-2"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <div className="grid content-start gap-4 sm:grid-cols-2 lg:order-1">
          <Field name="name" label="Site name" className="sm:col-span-2">
            <Input
              id="name"
              name="name"
              defaultValue={state.values?.name}
              placeholder="Kokrajhar Government College, main gate"
              required
            />
          </Field>

          <Field name="client_name" label="Client">
            <Input
              id="client_name"
              name="client_name"
              defaultValue={state.values?.client_name}
            />
          </Field>

          <Field name="district" label="District">
            <Input id="district" name="district" defaultValue={state.values?.district} />
          </Field>

          <Field name="address" label="Address" className="sm:col-span-2">
            <Input id="address" name="address" defaultValue={state.values?.address} />
          </Field>


          {/* The map is the interface; these carry its result to the server. */}
          <input type="hidden" name="lat" value={fence.lat || ""} />
          <input type="hidden" name="lng" value={fence.lng || ""} />
          <input
            type="hidden"
            name="geofence_radius_m"
            value={fence.mode === "radius" ? fence.radius : 150}
          />
          <input
            type="hidden"
            name="polygon"
            value={
              fence.mode === "polygon" && fence.ring.length >= 3
                ? JSON.stringify(fence.ring)
                : ""
            }
          />

          <Field
            name="max_accuracy_m"
            label="Required accuracy (m)"
            hint="Loosen this for a rural site with weak GPS."
          >
            <Input
              id="max_accuracy_m"
              name="max_accuracy_m"
              type="number"
              min={10}
              max={1000}
              defaultValue={state.values?.max_accuracy_m ?? "100"}
            />
          </Field>

          <Field
            name="grace_minutes"
            label="Grace (min)"
            hint="After this, a punch is marked late."
          >
            <Input
              id="grace_minutes"
              name="grace_minutes"
              type="number"
              min={0}
              max={120}
              defaultValue={state.values?.grace_minutes ?? "10"}
            />
          </Field>

          <Field name="shift_start" label="Shift start">
            <TimePicker
              id="shift_start"
              name="shift_start"
              defaultValue={state.values?.shift_start}
              placeholder="Not fixed"
            />
          </Field>

          <Field name="shift_end" label="Shift end">
            <TimePicker
              id="shift_end"
              name="shift_end"
              defaultValue={state.values?.shift_end}
              placeholder="Not fixed"
            />
          </Field>

          <Field
            name="standard_shift_minutes"
            label="Standard shift (min)"
            hint="Anything beyond this counts as overtime."
            className="sm:col-span-2"
          >
            <Input
              id="standard_shift_minutes"
              name="standard_shift_minutes"
              type="number"
              min={60}
              max={1440}
              defaultValue={state.values?.standard_shift_minutes ?? "480"}
            />
          </Field>

          </div>

          <div className="lg:order-2">
            <Label className="mb-2">
              Boundary <span className="text-destructive">*</span>
            </Label>
            <FenceMap value={fence} onChange={setFence} />
            {!placed && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {fence.mode === "radius"
                  ? "Click the map to place this site."
                  : "Drop at least three points to close the area."}
              </p>
            )}
          </div>

          <DialogFooter className="lg:order-3 lg:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Submit disabled={!placed} editing={editing} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
