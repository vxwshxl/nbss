"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { createSite } from "@/app/console/sites/actions";
import { emptySiteForm } from "@/app/console/sites/site-form-state";
import { Icon } from "@/components/Icon";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn--solid" type="submit" disabled={pending}>
      {pending ? "Saving…" : "Register site"}
    </button>
  );
}

/**
 * Registering a site.
 *
 * The coordinates are the whole point of the record, so there are two ways in:
 * paste them from Google Maps, which is what an operator sitting at a desk
 * will do, or "use my location", which is what somebody standing at the gate
 * will do. A drawn map comes with the tile proxy in the next piece of work;
 * until then these two cover both people who actually create sites.
 */
export function SiteForm() {
  const [state, action] = useActionState(createSite, emptySiteForm);
  const [coords, setCoords] = useState({
    lat: state.values?.lat ?? "",
    lng: state.values?.lng ?? "",
  });
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const useMyLocation = () => {
    setLocateError(null);
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        });
        setLocating(false);
      },
      () => {
        setLocateError("Could not read your location. Enter the coordinates by hand.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  /**
   * Accepts what people actually have on the clipboard: "26.4015, 90.2717",
   * or a Google Maps URL with an @lat,lng in it. Anything else is left alone
   * so a half-typed value is never silently discarded.
   */
  const onPaste = (text: string) => {
    const fromUrl = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const bare = text.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
    const hit = fromUrl ?? bare;
    if (hit) setCoords({ lat: hit[1]!, lng: hit[2]! });
  };

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

      <label className="cfield">
        <span className="cfield__l">Latitude</span>
        <input
          className="cfield__i"
          name="lat"
          value={coords.lat}
          onChange={(e) => setCoords((c) => ({ ...c, lat: e.target.value }))}
          onPaste={(e) => onPaste(e.clipboardData.getData("text"))}
          placeholder="26.401500"
          inputMode="decimal"
          required
        />
      </label>

      <label className="cfield">
        <span className="cfield__l">Longitude</span>
        <input
          className="cfield__i"
          name="lng"
          value={coords.lng}
          onChange={(e) => setCoords((c) => ({ ...c, lng: e.target.value }))}
          onPaste={(e) => onPaste(e.clipboardData.getData("text"))}
          placeholder="90.271700"
          inputMode="decimal"
          required
        />
      </label>

      <div className="cfield cform__wide">
        <span className="cfield__hint">
          Paste a Google Maps link or a &ldquo;lat, lng&rdquo; pair into either box and both fill
          in.{" "}
          <button className="btn btn--ghost btn--sm" type="button" onClick={useMyLocation} disabled={locating}>
            {locating ? "Locating…" : "Use my location"}
          </button>
        </span>
        {locateError && <span className="cfield__hint">{locateError}</span>}
      </div>

      <label className="cfield">
        <span className="cfield__l">Fence radius (m)</span>
        <input
          className="cfield__i"
          name="geofence_radius_m"
          type="number"
          min={25}
          max={5000}
          defaultValue={state.values?.geofence_radius_m ?? "150"}
        />
        <span className="cfield__hint">How close a guard must be to punch in.</span>
      </label>

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
        <Submit />
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
