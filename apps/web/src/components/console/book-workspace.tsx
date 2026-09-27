"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { CalendarPlus, CheckCircle2, ClipboardList, Loader2, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { submitBooking, withdrawBooking } from "@/app/console/book/actions";
import { emptyBookingState } from "@/app/console/book/state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui/panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";
import { districtOptions } from "@/content/site";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_NOTE,
  SERVICE_OPTIONS,
  SHIFT_PATTERNS,
  serviceName,
  withdrawable,
  type BookingStatus,
} from "@/lib/bookings";

export type BookingRow = {
  id: string;
  reference: string;
  service_type: string;
  site_type: string | null;
  district: string | null;
  guards_required: number | null;
  shift_pattern: string | null;
  start_date: string | null;
  status: BookingStatus;
  quote_note: string | null;
  quoted_amount_paise: number | null;
  created_at: string;
};

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="h-11 rounded-xl px-5 text-[15px] font-semibold">
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
      {pending ? "Sending…" : "Send request"}
    </Button>
  );
}

/** A labelled Radix select that also posts its value with the form. */
function Choice({
  id,
  label,
  placeholder,
  options,
  defaultValue = "",
  required,
}: {
  id: string;
  label: string;
  placeholder: string;
  options: readonly { value: string; label: string }[];
  defaultValue?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id={id} className="h-10 w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={id} value={value} />
    </div>
  );
}

export function BookWorkspace({
  rows,
  defaults,
}: {
  rows: BookingRow[];
  defaults: { contactName: string; phone: string; organisation: string; service: string };
}) {
  const [state, action] = useActionState(submitBooking, emptyBookingState);
  const [formKey, setFormKey] = useState(0);
  const [pending, start] = useTransition();

  // A fresh, empty form once a request has gone through — keyed rather than
  // reset by hand, so every Radix select goes back to its placeholder too.
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.ok) setFormKey((k) => k + 1);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
      <Panel tone="emerald" title="New request" icon={CalendarPlus} bodyClassName="p-4 sm:p-6">
        {state.ok && state.reference && (
          <div
            role="status"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-accent px-3.5 py-3 text-sm text-accent-foreground"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>
              Request <span className="font-mono font-semibold">{state.reference}</span> sent. The
              deployment desk will call you to arrange a site visit.
            </span>
          </div>
        )}
        {state.error && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
          >
            {state.error}
          </p>
        )}

        <form key={formKey} action={action} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Choice
              id="service"
              label="Which service?"
              placeholder="Choose a service…"
              options={SERVICE_OPTIONS}
              defaultValue={defaults.service}
              required
            />
          </div>
          <Choice id="district" label="District" placeholder="Choose…" options={districtOptions.map((d) => ({ value: d, label: d }))} required />
          <div className="flex flex-col gap-2">
            <Label htmlFor="site_type">
              Site <span className="text-destructive">*</span>
            </Label>
            <Input id="site_type" name="site_type" placeholder="Rice mill, 4 acres" className="h-10" />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" placeholder="Street, landmark, town" className="h-10" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="guards_required">Guards needed</Label>
            <Input id="guards_required" name="guards_required" type="number" min={1} max={2000} placeholder="Not sure? Leave blank" className="h-10" />
          </div>
          <Choice id="shift_pattern" label="Shift" placeholder="Choose…" options={SHIFT_PATTERNS} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="start_date">Start from</Label>
            <Input id="start_date" name="start_date" type="date" min={today} className="h-10" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="duration_months">For how long (months)</Label>
            <Input id="duration_months" name="duration_months" type="number" min={1} max={120} placeholder="e.g. 12" className="h-10" />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="notes">Anything else?</Label>
            <Textarea id="notes" name="notes" rows={3} placeholder="Shift timings, armed requirement, existing agency, tender reference…" />
          </div>

          <div className="border-t border-app-line-soft pt-4 sm:col-span-2">
            <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Who we should call</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="contact_name">Name</Label>
                <Input id="contact_name" name="contact_name" defaultValue={defaults.contactName} className="h-10" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Mobile</Label>
                <Input id="phone" name="phone" inputMode="tel" defaultValue={defaults.phone} placeholder="98640 12345" className="h-10" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="organisation">Organisation</Label>
                <Input id="organisation" name="organisation" defaultValue={defaults.organisation} className="h-10" />
              </div>
            </div>
          </div>

          <div className="flex justify-end sm:col-span-2">
            <Submit />
          </div>
        </form>
      </Panel>

      <Panel tone="sky" title={`My requests · ${rows.length}`} icon={ClipboardList} bodyClassName="p-3 sm:p-4">
        {rows.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">
            Nothing yet. Your requests appear here with their status as the desk works on them.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {rows.map((r) => (
              <li key={r.id} className="rounded-xl border border-app-line-soft p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">{r.reference}</p>
                    <p className="mt-0.5 truncate text-sm font-semibold">{serviceName(r.service_type)}</p>
                    <p className="text-xs text-muted-foreground">
                      {[r.site_type, r.district, r.guards_required ? `${r.guards_required} guards` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <StatusPill status={r.status} label={BOOKING_STATUS_LABEL[r.status]} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{BOOKING_STATUS_NOTE[r.status]}</p>
                {r.status === "quoted" && r.quoted_amount_paise != null && (
                  <p className="mt-2 rounded-lg bg-violet-50 px-2.5 py-1.5 text-sm text-violet-800">
                    Quoted <span className="font-semibold">{rupees(r.quoted_amount_paise)}</span> / month
                    {r.quote_note ? ` — ${r.quote_note}` : ""}
                  </p>
                )}
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Sent {when(r.created_at)}</span>
                  {withdrawable(r.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await withdrawBooking(r.id);
                          if (res.ok) toast.success(`${r.reference} withdrawn`);
                          else toast.error(res.error ?? "Could not withdraw.");
                        })
                      }
                      className="text-muted-foreground"
                    >
                      <Undo2 data-icon="inline-start" />
                      Withdraw
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
