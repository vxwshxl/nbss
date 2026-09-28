"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Phone, ShieldAlert, UserRoundX } from "lucide-react";

import { SOS_KIND_LABEL, SOS_STATUS_LABEL, type SosKind, type SosStatus } from "@nbss/shared/sos";

import { AttendancePreviewDialog } from "@/components/console/attendance-preview";
import { FLUSH_TABLE, rowProps } from "@/components/console/preview-kit";
import { SosPreviewDialog } from "@/components/console/sos-preview";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { initials } from "@/lib/ui/initials";

export type OnDutyRow = {
  id: string;
  guardName: string;
  guardCode: string;
  siteName: string;
  district: string | null;
  /** Pre-formatted on the server, so the page hydrates without a clock race. */
  since: string;
  forHowLong: string;
  late: boolean;
};

/** The dashboard's "on duty now": a row opens that punch. */
export function OnDutyTable({ rows, canReview }: { rows: OnDutyRow[]; canReview: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <>
      <div className="overflow-x-auto">
        <Table className={FLUSH_TABLE}>
          <TableHeader>
            <TableRow>
              <TableHead>Guard</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Checked in</TableHead>
              <TableHead className="text-right">On duty for</TableHead>
              <TableHead className="text-right">State</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} {...rowProps(() => setOpenId(r.id))}>
                <TableCell>
                  <span className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                      {initials(r.guardName)}
                    </span>
                    <span>
                      <span className="block font-medium">{r.guardName}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{r.guardCode}</span>
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <span className="block">{r.siteName}</span>
                  {r.district && <span className="block text-xs text-muted-foreground">{r.district}</span>}
                </TableCell>
                <TableCell className="tabular-nums">{r.since}</TableCell>
                <TableCell className="text-right tabular-nums">{r.forHowLong}</TableCell>
                <TableCell className="text-right">
                  <StatusPill status={r.late ? "late" : "on_duty"} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <AttendancePreviewDialog id={openId} onClose={() => setOpenId(null)} canReview={canReview} staff />
    </>
  );
}

export type LiveSos = {
  id: string;
  status: SosStatus;
  kind: SosKind;
  guardName: string;
  guardPhone: string | null;
  siteName: string;
  raised: string;
};

/**
 * Shown only while an alert is live, above everything else on the dashboard —
 * it is the one thing on this screen that cannot wait for someone to scroll.
 */
export function LiveSosPanel({ alerts }: { alerts: LiveSos[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <section className="overflow-hidden rounded-2xl border border-rose-300 bg-rose-50 shadow-card dark:border-rose-500/40 dark:bg-rose-500/10">
      <div className="flex items-center gap-3 bg-gradient-to-r from-rose-600 to-red-700 px-6 py-3 text-white">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
          <span className="relative inline-flex size-2.5 rounded-full bg-white" />
        </span>
        <ShieldAlert className="size-5" />
        <p className="flex-1 font-semibold">
          {alerts.length} live SOS alert{alerts.length === 1 ? "" : "s"}
        </p>
        <Button asChild size="sm" variant="ghost" className="text-white hover:bg-white/15 hover:text-white">
          <Link href="/console/sos">
            SOS log
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>
      <ul className="divide-y divide-rose-200 dark:divide-rose-500/20">
        {alerts.map((a) => (
          <li
            key={a.id}
            {...rowProps(() => setOpenId(a.id))}
            className="flex cursor-pointer flex-wrap items-center gap-3 px-6 py-3 transition-colors hover:bg-rose-100/70 dark:hover:bg-rose-500/15"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-rose-950 dark:text-rose-100">
                {a.guardName} · {SOS_KIND_LABEL[a.kind]}
              </span>
              <span className="block text-sm text-rose-900/75 dark:text-rose-200/80">
                {a.siteName} · raised {a.raised}
              </span>
            </span>
            <StatusPill status={a.status === "active" ? "sos_active" : a.status} label={SOS_STATUS_LABEL[a.status]} />
            {a.guardPhone && (
              <a
                href={`tel:${a.guardPhone.replace(/[^\d+]/g, "")}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-rose-600 px-3 font-mono text-sm font-semibold text-white transition-colors hover:bg-rose-700"
              >
                <Phone className="size-3.5" />
                {a.guardPhone}
              </a>
            )}
          </li>
        ))}
      </ul>
      <SosPreviewDialog id={openId} onClose={() => setOpenId(null)} />
    </section>
  );
}

export type NotArrivedRow = {
  id: string;
  guardName: string;
  guardPhone: string | null;
  siteName: string;
  /** Pre-formatted on the server. */
  due: string;
  late: string;
};

/**
 * Rostered guards whose shift has started, past its grace period, with no
 * check-in. Shown only when there are any — each is somebody to ring now.
 */
export function NotArrivedPanel({ rows }: { rows: NotArrivedRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-amber-300 bg-amber-50/70 shadow-card dark:border-amber-500/40 dark:bg-amber-500/10">
      <div className="flex items-center gap-3 border-b border-amber-200 px-6 py-3 dark:border-amber-500/20">
        <UserRoundX className="size-5 text-amber-700" />
        <p className="flex-1 font-semibold text-amber-950 dark:text-amber-100">
          {rows.length} rostered guard{rows.length === 1 ? " has" : "s have"} not arrived
        </p>
        <Button asChild size="sm" variant="ghost">
          <Link href="/console/roster">
            Roster
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>
      <ul className="divide-y divide-amber-200/70 dark:divide-amber-500/20">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-amber-800">
              {initials(r.guardName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{r.guardName}</span>
              <span className="block text-sm text-muted-foreground">
                {r.siteName} · due {r.due} · {r.late} late
              </span>
            </span>
            {r.guardPhone && (
              <a
                href={`tel:${r.guardPhone.replace(/[^\d+]/g, "")}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 font-mono text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100"
              >
                <Phone className="size-3.5" />
                {r.guardPhone}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
