"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, CalendarDays, ClipboardList, Mail, MapPin, Phone, ShieldUser, X } from "lucide-react";
import { toast } from "sonner";

import { updateBooking } from "@/app/console/bookings/actions";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui/panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { BOOKING_STATUS_LABEL, SHIFT_PATTERNS, serviceName, type BookingStatus } from "@/lib/bookings";
import { cn } from "@/lib/utils";

export type BookingInboxRow = {
  id: string;
  reference: string;
  client_id: string | null;
  contact_name: string;
  organisation: string | null;
  email: string | null;
  phone: string;
  service_type: string;
  site_type: string | null;
  district: string | null;
  address: string | null;
  guards_required: number | null;
  shift_pattern: string | null;
  start_date: string | null;
  duration_months: number | null;
  notes: string | null;
  status: BookingStatus;
  quoted_amount_paise: number | null;
  quote_note: string | null;
  site_id: string | null;
  source: string;
  created_at: string;
};

type Site = { id: string; name: string; district: string | null; client_id: string | null };

const TABS: { value: "open" | "all" | BookingStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "new", label: "New" },
  { value: "quoted", label: "Quoted" },
  { value: "converted", label: "Deployed" },
  { value: "all", label: "All" },
];

const OPEN = new Set<BookingStatus>(["new", "reviewing", "quoted", "accepted"]);

function when(iso: string, time = false): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: time ? undefined : "numeric",
    hour: time ? "numeric" : undefined,
    minute: time ? "2-digit" : undefined,
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function Fact({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
        <dd className="mt-0.5 text-sm break-words">{value || "—"}</dd>
      </div>
    </div>
  );
}

export function BookingsWorkspace({
  rows,
  sites,
  canDeploy,
}: {
  rows: BookingInboxRow[];
  sites: Site[];
  canDeploy: boolean;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("open");
  // `?open=<id>` opens a booking directly — how a site links to its booking.
  const params = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  const [mode, setMode] = useState<"idle" | "quote" | "deploy">("idle");
  const [siteId, setSiteId] = useState("");
  const [pending, start] = useTransition();

  const visible =
    tab === "all" ? rows : tab === "open" ? rows.filter((r) => OPEN.has(r.status)) : rows.filter((r) => r.status === tab);
  const open = rows.find((r) => r.id === openId) ?? null;

  function move(row: BookingInboxRow, status: BookingStatus, extra: Parameters<typeof updateBooking>[1] = { status }) {
    start(async () => {
      const res = await updateBooking(row.id, { ...extra, status });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${row.reference} updated`);
      setMode("idle");
    });
  }

  const columns: Column<BookingInboxRow>[] = [
    {
      header: "Request",
      cell: (r) => (
        <span className="block min-w-0">
          <span className="block font-medium">{r.organisation || r.contact_name}</span>
          <span className="block font-mono text-xs text-muted-foreground">{r.reference}</span>
        </span>
      ),
      sortValue: (r) => r.reference,
      searchValue: (r) => `${r.reference} ${r.contact_name} ${r.organisation ?? ""} ${r.phone} ${r.email ?? ""}`,
      printCell: (r) => `${r.reference} · ${r.organisation || r.contact_name}`,
    },
    {
      header: "Service",
      cell: (r) => (
        <span className="block max-w-[16rem]">
          <span className="block truncate text-sm">{serviceName(r.service_type)}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {[r.site_type, r.district].filter(Boolean).join(" · ")}
          </span>
        </span>
      ),
      searchValue: (r) => `${serviceName(r.service_type)} ${r.district ?? ""} ${r.site_type ?? ""}`,
      printCell: (r) => serviceName(r.service_type),
    },
    {
      header: "Guards",
      cell: (r) => <span className="tabular-nums">{r.guards_required ?? "—"}</span>,
      sortValue: (r) => r.guards_required ?? 0,
      printCell: (r) => String(r.guards_required ?? "—"),
    },
    {
      header: "Received",
      cell: (r) => <span className="tabular-nums">{when(r.created_at)}</span>,
      sortValue: (r) => r.created_at,
      printCell: (r) => when(r.created_at),
    },
    {
      header: "Status",
      className: "text-right",
      headClassName: "text-right",
      cell: (r) => <StatusPill status={r.status} label={BOOKING_STATUS_LABEL[r.status]} />,
      sortValue: (r) => r.status,
      printCell: (r) => r.status,
    },
  ];

  return (
    <>
      <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {TABS.map((t) => {
          const count =
            t.value === "all"
              ? rows.length
              : t.value === "open"
                ? rows.filter((r) => OPEN.has(r.status)).length
                : rows.filter((r) => r.status === t.value).length;
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              aria-pressed={active}
              className={cn(
                "press flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-transparent bg-brand-gradient-strong text-white shadow-sm"
                  : "border-app-line bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-white/20" : "bg-muted")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <Panel tone="emerald" title={`${visible.length} ${visible.length === 1 ? "request" : "requests"}`} icon={ClipboardList} bodyClassName="p-3 sm:p-4">
        <DataTable
          columns={columns}
          data={visible}
          getRowKey={(r) => r.id}
          interactiveRows
          rowPreview={false}
          onRowClick={(r) => {
            setMode("idle");
            setSiteId(r.site_id ?? "");
            setOpenId(r.id);
          }}
          printTitle="Bookings"
          searchPlaceholder="Search by reference, client, phone…"
          emptyMessage="No booking requests here yet. Clients book from their console after signing in."
        />
      </Panel>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
          <DialogClose
            aria-label="Close"
            className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/30"
          >
            <X className="size-4" />
          </DialogClose>
          <DialogTitle className="sr-only">Booking</DialogTitle>
          {open && (
            <div>
              <div className="relative overflow-hidden bg-brand-gradient-strong px-6 pt-6 pb-5 text-white">
                <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-white/10" />
                <div className="relative pr-8">
                  <p className="font-mono text-xs text-white/80">{open.reference}</p>
                  <p className="mt-1 text-xl font-bold">{open.organisation || open.contact_name}</p>
                  <p className="mt-0.5 text-sm text-white/85">
                    {serviceName(open.service_type)} · received {when(open.created_at, true)}
                  </p>
                </div>
              </div>

              <div className="space-y-6 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={open.status} label={BOOKING_STATUS_LABEL[open.status]} />
                  {open.quoted_amount_paise != null && (
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800">
                      Quoted ₹{(open.quoted_amount_paise / 100).toLocaleString("en-IN")} / month
                    </span>
                  )}
                </div>

                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <Fact icon={ShieldUser} label="Contact" value={open.contact_name} />
                  <Fact icon={Phone} label="Mobile" value={<a className="font-mono text-primary-ink" href={`tel:${open.phone}`}>{open.phone}</a>} />
                  <Fact icon={Mail} label="Email" value={open.email} />
                  <Fact icon={Building2} label="Site" value={[open.site_type, open.guards_required ? `${open.guards_required} guards` : null].filter(Boolean).join(" · ")} />
                  <Fact icon={MapPin} label="Where" value={[open.address, open.district].filter(Boolean).join(", ")} />
                  <Fact
                    icon={CalendarDays}
                    label="When"
                    value={[
                      SHIFT_PATTERNS.find((s) => s.value === open.shift_pattern)?.label,
                      open.start_date ? `from ${when(open.start_date)}` : null,
                      open.duration_months ? `${open.duration_months} months` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                </dl>

                {open.notes && (
                  <p className="rounded-xl bg-muted/60 px-3.5 py-3 text-sm whitespace-pre-wrap">{open.notes}</p>
                )}

                {mode === "quote" && (
                  <form
                    className="grid gap-3 rounded-xl border border-app-line-soft p-4 sm:grid-cols-[10rem_1fr]"
                    action={(f) =>
                      move(open, "quoted", {
                        status: "quoted",
                        quoteRupees: String(f.get("amount") ?? ""),
                        quoteNote: String(f.get("note") ?? ""),
                      })
                    }
                  >
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="amount">Per month (₹)</Label>
                      <Input id="amount" name="amount" inputMode="numeric" placeholder="84,000" autoFocus />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="note">Note to the client</Label>
                      <Input id="note" name="note" placeholder="4 guards, 24×7, incl. ESI & EPF" />
                    </div>
                    <div className="flex justify-end gap-2 sm:col-span-2">
                      <Button type="button" variant="outline" onClick={() => setMode("idle")}>Cancel</Button>
                      <Button type="submit" disabled={pending}>Send quotation</Button>
                    </div>
                  </form>
                )}

                {mode === "deploy" && (
                  <div className="grid gap-3 rounded-xl border border-app-line-soft p-4">
                    <Label htmlFor="deploy-site">Deployed to which site?</Label>
                    <Select value={siteId} onValueChange={setSiteId}>
                      <SelectTrigger id="deploy-site" className="w-full">
                        <SelectValue placeholder="Choose a site…" />
                      </SelectTrigger>
                      <SelectContent>
                        {sites.map((s) => (
                          <SelectItem key={s.id} value={s.id} description={s.district ?? undefined}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      The site is handed to this client, so their My site page starts showing the guards on duty.
                    </p>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setMode("idle")}>Cancel</Button>
                      <Button disabled={pending || !siteId} onClick={() => move(open, "converted", { status: "converted", siteId })}>
                        Mark deployed
                      </Button>
                    </div>
                  </div>
                )}

                {mode === "idle" && OPEN.has(open.status) && (
                  <div className="flex flex-wrap gap-2 border-t border-border pt-5">
                    {open.status === "new" && (
                      <Button variant="outline" size="sm" disabled={pending} onClick={() => move(open, "reviewing")}>
                        Arrange site survey
                      </Button>
                    )}
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => setMode("quote")}>
                      {open.status === "quoted" ? "Revise quotation" : "Send quotation"}
                    </Button>
                    {open.status !== "accepted" && (
                      <Button variant="outline" size="sm" disabled={pending} onClick={() => move(open, "accepted")}>
                        Accept
                      </Button>
                    )}
                    {canDeploy && (
                      <Button size="sm" disabled={pending} onClick={() => setMode("deploy")}>
                        Mark guards deployed
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={pending}
                      onClick={() => move(open, "declined")}
                    >
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
