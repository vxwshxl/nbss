"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { createSite } from "@/app/console/sites/actions";
import { emptySiteForm } from "@/app/console/sites/site-form-state";
import { FenceMap, type Fence } from "@/components/console/FenceMap";
import { Icon } from "@/components/Icon";

import "leaflet/dist/leaflet.css";

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn--solid" type="submit" disabled={pending || disabled}>
      {pending ? "Saving…" : "Register site"}
    </button>
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
 */
export function SiteForm() {
  const [state, action] = useActionState(createSite, emptySiteForm);
  const [open, setOpen] = useState(false);
  const [fence, setFence] = useState<Fence>({ mode: "radius", lat: 0, lng: 0, radius: 150 });

  const placed = fence.mode === "radius" ? !!(fence.lat || fence.lng) : fence.ring.length >= 3;

  if (!open) {
    return (
      <div className="cpanel__body">
        {state.ok && state.created && (
          <p className="cokay" role="status">
            <Icon name="check" />
            <span>{state.created} is registered. Guards can now check in there.</span>
          </p>
        )}
        <button className="btn btn--solid btn--sm" type="button" onClick={() => setOpen(true)}>
          Register a site
        </button>
      </div>
    );
  }

  return (
    <form className="cform" action={action}>
      {state.error && (
        <p className="cerror cform__wide" role="alert">
          <Icon name="close" />
          <span>{state.error}</span>
        </p>
      )}

      <label className="cfield cform__wide">
        <span className="cfield__l">Site name</span>
        <input
          className="cfield__i"
          name="name"
          defaultValue={state.values?.name}
          placeholder="Kokrajhar Government College — main gate"
          required
        />
      </label>

      <label className="cfield">
        <span className="cfield__l">Client</span>
        <input className="cfield__i" name="client_name" defaultValue={state.values?.client_name} />
      </label>

      <label className="cfield">
        <span className="cfield__l">District</span>
        <input className="cfield__i" name="district" defaultValue={state.values?.district} />
      </label>

      <label className="cfield cform__wide">
        <span className="cfield__l">Address</span>
        <input className="cfield__i" name="address" defaultValue={state.values?.address} />
      </label>

      <div className="cform__wide">
        <span className="ui-label" style={{ display: "block", marginBottom: 8 }}>
          Boundary<span className="ui-req"> *</span>
        </span>
        <FenceMap value={fence} onChange={setFence} />
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
        value={fence.mode === "polygon" && fence.ring.length >= 3 ? JSON.stringify(fence.ring) : ""}
      />

      <label className="cfield">
        <span className="cfield__l">Required accuracy (m)</span>
        <input
          className="cfield__i"
          name="max_accuracy_m"
          type="number"
          min={10}
          max={1000}
          defaultValue={state.values?.max_accuracy_m ?? "100"}
        />
        <span className="cfield__hint">Loosen this for a rural site with weak GPS.</span>
      </label>

      <label className="cfield">
        <span className="cfield__l">Shift start</span>
        <input className="cfield__i" name="shift_start" type="time" defaultValue={state.values?.shift_start} />
      </label>

      <label className="cfield">
        <span className="cfield__l">Shift end</span>
        <input className="cfield__i" name="shift_end" type="time" defaultValue={state.values?.shift_end} />
      </label>

      <label className="cfield">
        <span className="cfield__l">Grace (min)</span>
        <input
          className="cfield__i"
          name="grace_minutes"
          type="number"
          min={0}
          max={120}
          defaultValue={state.values?.grace_minutes ?? "10"}
        />
        <span className="cfield__hint">After this, a punch is marked late.</span>
      </label>

      <label className="cfield">
        <span className="cfield__l">Standard shift (min)</span>
        <input
          className="cfield__i"
          name="standard_shift_minutes"
          type="number"
          min={60}
          max={1440}
          defaultValue={state.values?.standard_shift_minutes ?? "480"}
        />
        <span className="cfield__hint">Anything beyond this counts as overtime.</span>
      </label>

      <div className="cform__foot">
        {!placed && (
          <span className="ui-hint">
            {fence.mode === "radius"
              ? "Click the map to place this site."
              : "Drop at least three points to close the area."}
          </span>
        )}
        <Submit disabled={!placed} />
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
