"use client";

import { useState } from "react";
import { BadgeCheck, Building2, Clock, Phone, Radio } from "lucide-react";

import {
  FLUSH_TABLE,
  Field,
  FieldGrid,
  HeroPill,
  PreviewActions,
  PreviewBody,
  PreviewDialog,
  PreviewHero,
  rowProps,
} from "@/components/console/preview-kit";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { initials } from "@/lib/ui/initials";

export type ClientDutyRow = {
  id: string;
  guardName: string;
  siteName: string;
  /** Pre-formatted on the server. */
  since: string;
  forHowLong: string;
};

/**
 * The client's "on duty now". A row opens the guard's card — name, post, since
 * when — and the one action a client has, which is ringing the desk. No guard
 * phone numbers or coordinates: those stay with the agency (0004).
 */
export function ClientDutyTable({
  rows,
  deskPhone,
}: {
  rows: ClientDutyRow[];
  deskPhone: string;
}) {
  const [open, setOpen] = useState<ClientDutyRow | null>(null);
  return (
    <>
      <div className="overflow-x-auto">
        <Table className={FLUSH_TABLE}>
          <TableHeader>
            <TableRow>
              <TableHead>Guard</TableHead>
              <TableHead>Site</TableHead>
              <TableHead className="text-right">On duty since</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} {...rowProps(() => setOpen(row))}>
                <TableCell>
                  <span className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                      {initials(row.guardName)}
                    </span>
                    <span className="font-medium">{row.guardName}</span>
                  </span>
                </TableCell>
                <TableCell>{row.siteName}</TableCell>
                <TableCell className="text-right tabular-nums">{row.since}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PreviewDialog open={!!open} onClose={() => setOpen(null)} label="Guard on duty">
        {open && (
          <>
            <PreviewHero
              avatar={open.guardName}
              title={open.guardName}
              meta={<span>{open.siteName}</span>}
              badge={<HeroPill>● On duty now</HeroPill>}
            />
            <PreviewBody>
              <FieldGrid>
                <Field icon={Clock} label="Checked in" value={open.since} />
                <Field icon={Radio} label="On duty for" value={open.forHowLong} />
                <Field icon={Building2} label="Post" value={open.siteName} />
                <Field icon={BadgeCheck} label="Verified" value="Inside your site's boundary at check-in" />
              </FieldGrid>
              <p className="text-sm text-muted-foreground">
                Something not right with this posting? The deployment desk is staffed around the clock.
              </p>
            </PreviewBody>
            <PreviewActions>
              <Button asChild size="sm">
                <a href={`tel:${deskPhone.replace(/[^\d+]/g, "")}`}>
                  <Phone data-icon="inline-start" />
                  Call the desk · {deskPhone}
                </a>
              </Button>
            </PreviewActions>
          </>
        )}
      </PreviewDialog>
    </>
  );
}
