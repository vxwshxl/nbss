"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, MapPinPlus, Plus } from "lucide-react";

import { createSite } from "@/app/console/sites/actions";
import { emptySiteForm } from "@/app/console/sites/site-form-state";
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

import "leaflet/dist/leaflet.css";

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      <MapPinPlus data-icon="inline-start" />
      {pending ? "Saving…" : "Register site"}
    </Button>
  );
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
 */
export function SiteForm() {
  const [state, action] = useActionState(createSite, emptySiteForm);
  const [open, setOpen] = useState(false);
  const [fence, setFence] = useState<Fence>({
    mode: "radius",
    lat: 0,
    lng: 0,
    radius: 150,
  });

  const placed =
    fence.mode === "radius" ? !!(fence.lat || fence.lng) : fence.ring.length >= 3;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          Register a site
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register a site</DialogTitle>
          <DialogDescription>
            Place the boundary on the map first — everything below describes how
            attendance inside it is judged.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="grid gap-4 sm:grid-cols-2">
          {state.error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive sm:col-span-2"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <Field name="name" label="Site name" className="sm:col-span-2">
            <Input
              id="name"
              name="name"
              defaultValue={state.values?.name}
              placeholder="Kokrajhar Government College — main gate"
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

          <div className="sm:col-span-2">
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
            <Input
              id="shift_start"
              name="shift_start"
              type="time"
              defaultValue={state.values?.shift_start}
            />
          </Field>

          <Field name="shift_end" label="Shift end">
            <Input
              id="shift_end"
              name="shift_end"
              type="time"
              defaultValue={state.values?.shift_end}
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

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Submit disabled={!placed} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
