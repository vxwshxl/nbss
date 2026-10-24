"use client";

import { useTransition } from "react";
import { AlertTriangle, BatteryCharging, Check, MapPin, MapPinOff, Smartphone, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { removeDevice, reviewFlaggedPunch, setDeviceStatus } from "@/app/console/devices/actions";
import { istDateTime } from "@/components/console/preview-kit";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";

export type DeviceRow = {
  id: string;
  guardName: string;
  guardCode: string;
  phone: string;
  system: string;
  appVersion: string | null;
  status: "approved" | "pending" | "blocked";
  battery: number | null;
  charging: boolean | null;
  permission: string | null;
  gps: boolean | null;
  /** Android battery optimisation on: the OS may stop tracking when the app is closed. */
  batteryOptimized: boolean | null;
  lastSeenAt: string;
  firstSeenAt: string;
  /** Other guards who have signed in on this same phone. */
  sharedWith: string[];
};

export type FlaggedPunch = {
  id: string;
  guardName: string;
  siteName: string;
  checkInAt: string;
  flag: string;
  phone: string | null;
  /** Who else uses this phone (by its unique device id), for "another guard's phone". */
  owners: string[];
};

const FLAG_TEXT: Record<string, string> = {
  shared_device: "Another guard's phone",
  new_device: "Phone not yet approved",
  unknown_device: "No phone id",
};

/**
 * Guards' phones. A guard's first phone is approved by itself; anything after
 * that — a second phone, or a phone someone else already uses — waits here, and
 * check-ins from it are held below until a supervisor looks.
 */
export function DevicesWorkspace({ devices, flagged }: { devices: DeviceRow[]; flagged: FlaggedPunch[] }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(done);
      else toast.error(r.error ?? "That did not work.");
    });

  const columns: Column<DeviceRow>[] = [
    {
      header: "Guard",
      cell: (r) => (
        <span className="block">
          <span className="block font-medium">{r.guardName}</span>
          <span className="block font-mono text-xs text-muted-foreground">{r.guardCode}</span>
        </span>
      ),
      sortValue: (r) => r.guardName,
      searchValue: (r) => `${r.guardName} ${r.guardCode} ${r.phone}`,
      printCell: (r) => `${r.guardName} (${r.guardCode})`,
    },
    {
      header: "Phone",
      cell: (r) => (
        <span className="block">
          <span className="flex items-center gap-1.5 font-medium">
            <Smartphone className="size-3.5 text-muted-foreground" /> {r.phone}
          </span>
          <span className="block text-xs text-muted-foreground">
            {r.system}
            {r.appVersion ? ` · app ${r.appVersion}` : ""}
          </span>
          {r.sharedWith.length > 0 && (
            <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-700">
              <AlertTriangle className="size-3" /> Also used by {r.sharedWith.join(", ")}
            </span>
          )}
        </span>
      ),
      sortValue: (r) => r.phone,
      printCell: (r) => `${r.phone} (${r.system})`,
    },
    {
      header: "Location",
      cell: (r) => (
        <span className={cn("inline-flex items-center gap-1 text-sm", r.permission === "always" && r.gps !== false ? "text-emerald-700" : "text-amber-700")}>
          {r.permission === "always" && r.gps !== false ? <MapPin className="size-3.5" /> : <MapPinOff className="size-3.5" />}
          {r.gps === false ? "GPS off" : r.permission === "always" ? "All the time" : r.permission === "foreground" ? "Only while open" : r.permission === "denied" ? "Denied" : "Unknown"}
        </span>
      ),
      sortValue: (r) => r.permission ?? "",
      printCell: (r) => r.permission ?? "-",
    },
    {
      header: "Battery saver",
      cell: (r) =>
        r.batteryOptimized === true ? (
          <span className="text-sm font-medium text-amber-700">On · may stop tracking</span>
        ) : r.batteryOptimized === false ? (
          <span className="text-sm text-emerald-700">Unrestricted</span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
      sortValue: (r) => (r.batteryOptimized ? 0 : 1),
      printCell: (r) => (r.batteryOptimized === true ? "On" : r.batteryOptimized === false ? "Unrestricted" : "-"),
    },
    {
      header: "Battery",
      className: "tabular-nums",
      cell: (r) =>
        r.battery == null ? (
          "-"
        ) : (
          <span className={cn("inline-flex items-center gap-1", r.battery <= 20 && !r.charging && "font-semibold text-rose-600")}>
            {r.charging && <BatteryCharging className="size-3.5" />}
            {r.battery}%
          </span>
        ),
      sortValue: (r) => r.battery ?? -1,
      printCell: (r) => (r.battery == null ? "-" : `${r.battery}%`),
    },
    {
      header: "Last seen",
      cell: (r) => <span className="tabular-nums">{istDateTime(r.lastSeenAt)}</span>,
      sortValue: (r) => r.lastSeenAt,
      printCell: (r) => istDateTime(r.lastSeenAt),
    },
    {
      header: "State",
      cell: (r) => <StatusPill status={r.status} />,
      sortValue: (r) => ({ pending: 0, blocked: 1, approved: 2 })[r.status],
      printCell: (r) => r.status,
    },
    {
      header: "",
      noPrint: true,
      className: "text-right",
      cell: (r) => (
        <span className="inline-flex gap-1.5">
          {r.status !== "approved" && (
            <Button size="sm" disabled={pending} onClick={() => run(() => setDeviceStatus(r.id, "approved"), "Phone approved")}>
              <Check data-icon="inline-start" /> Approve
            </Button>
          )}
          {r.status !== "blocked" && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setDeviceStatus(r.id, "blocked"), "Phone blocked")}>
              <X data-icon="inline-start" /> Block
            </Button>
          )}
          <ConfirmDialog
            trigger={
              <Button size="icon-sm" variant="ghost" aria-label="Forget this phone" disabled={pending}>
                <Trash2 />
              </Button>
            }
            title="Forget this phone?"
            description={`${r.guardName}'s ${r.phone} registers again, as new, the next time they sign in on it.`}
            confirmLabel="Forget phone"
            destructive
            successMessage="Phone forgotten"
            onConfirm={async () => {
              const res = await removeDevice(r.id);
              if (!res.ok) throw new Error(res.error ?? "That did not work.");
            }}
          />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {flagged.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-amber-300/60 bg-amber-50/60 dark:bg-amber-500/5">
          <header className="flex items-center gap-2 border-b border-amber-300/50 px-4 py-3">
            <AlertTriangle className="size-4 text-amber-700" />
            <h2 className="font-semibold">Check-ins held because of the phone · {flagged.length}</h2>
          </header>
          <ul className="divide-y divide-amber-300/40">
            {flagged.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {f.guardName} <span className="font-normal text-muted-foreground">at {f.siteName}</span>
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {istDateTime(f.checkInAt)} ·{" "}
                    {f.flag === "shared_device" && f.owners.length ? (
                      <span className="font-semibold text-amber-800">
                        {f.owners.length === 1 ? `${f.owners[0]}'s phone` : `phone used by ${f.owners.join(", ")}`}
                      </span>
                    ) : (
                      (FLAG_TEXT[f.flag] ?? f.flag)
                    )}
                    {f.phone ? ` · ${f.phone}` : ""}
                  </span>
                </span>
                <Button size="sm" disabled={pending} onClick={() => run(() => reviewFlaggedPunch(f.id, true), "Check-in accepted")}>
                  <Check data-icon="inline-start" /> Accept
                </Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => reviewFlaggedPunch(f.id, false), "Check-in rejected")}>
                  <X data-icon="inline-start" /> Reject
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DataTable
        title={`${devices.length} phone${devices.length === 1 ? "" : "s"}`}
        columns={columns}
        data={devices}
        getRowKey={(r) => r.id}
        printTitle="Guard devices"
        searchPlaceholder="Search by guard, code or phone…"
        emptyMessage="No phones yet. A guard's phone appears here the first time they sign in to the app."
        rowClassName={(r) => (r.status === "pending" ? "bg-amber-50/70 dark:bg-amber-500/10" : undefined)}
      />
    </div>
  );
}
