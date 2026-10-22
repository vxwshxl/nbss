"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock,
  MapPinned,
  UserRoundPlus,
  UserRoundX,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  addShift,
  approveOffRoster,
  cancelShift,
  endPosting,
  savePosting,
  setHeadcount,
} from "@/app/console/roster/actions";
import {
  FLUSH_TABLE,
  HeroPill,
  PhoneLink,
  PreviewActions,
  PreviewBody,
  PreviewDialog,
  PreviewHero,
  Section,
  Stat,
  StatGrid,
  ago,
  rowProps,
} from "@/components/console/preview-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui/panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WEEKDAYS, clock, datesLabel, dayHeading, daysLabel, istDay, windowLabel } from "@/lib/roster";
import { initials } from "@/lib/ui/initials";
import { cn } from "@/lib/utils";

export type RosterSite = {
  id: string;
  name: string;
  client: string | null;
  district: string | null;
  required: number | null;
  posted: {
    postingId: string;
    guardId: string;
    name: string;
    code: string;
    phone: string | null;
    starts: string;
    ends: string;
    days: number[];
    /** Set for a dated posting: exactly these IST dates. */
    dates: string[] | null;
    onDuty: boolean;
  }[];
  onDuty: number;
  notArrived: number;
  week: { date: string; count: number }[];
};

export type RosterShift = {
  id: string;
  siteId: string;
  guardId: string;
  guardName: string;
  guardCode: string;
  guardPhone: string | null;
  startsAt: string;
  endsAt: string;
  date: string;
  status: string;
  cover: boolean;
  notArrived: boolean;
  /** Not started yet, so it can still be cancelled. */
  upcoming: boolean;
};

export type RosterGuard = {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  /** Their weekly post, if any. */
  posting: { siteId: string; starts: string; ends: string; days: number[] } | null;
  /** How many dated posts they hold. */
  dated: number;
};

type OffRoster = {
  id: string;
  guardName: string;
  guardCode: string;
  guardPhone: string | null;
  siteName: string;
  checkInAt: string;
};

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

/** Green when the day is covered, amber when short, grey when nothing is set. */
function cellTone(count: number, required: number | null) {
  if (!required) return count ? "bg-sky-50 text-sky-800 border-sky-200" : "bg-muted/40 text-muted-foreground border-transparent";
  if (count >= required) return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (count === 0) return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-amber-50 text-amber-800 border-amber-200";
}

function Pick({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; note?: string }[];
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-10 w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} description={o.note}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type PostingDraft = {
  guardId: string;
  siteId: string;
  starts: string;
  ends: string;
  days: number[];
  /** Null for a weekly post; the chosen dates for a dated one. */
  dates: string[] | null;
  /** The dated post being edited. */
  postingId?: string;
};
type CoverDraft = { guardId: string; siteId: string; date: string; starts: string; ends: string };

export function RosterWorkspace({
  sites,
  shifts,
  guards,
  days,
  notArrived,
  offRoster,
  canEdit,
}: {
  sites: RosterSite[];
  shifts: RosterShift[];
  guards: RosterGuard[];
  days: string[];
  notArrived: RosterShift[];
  offRoster: OffRoster[];
  canEdit: boolean;
}) {
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [siteId, setSiteId] = useState<string | null>(params.get("site"));
  const [day, setDay] = useState<{ siteId: string; date: string } | null>(null);
  const [posting, setPosting] = useState<PostingDraft | null>(() => {
    const g = params.get("guard");
    const found = g ? guards.find((x) => x.id === g) : null;
    return found
      ? {
          guardId: found.id,
          siteId: found.posting?.siteId ?? "",
          starts: found.posting?.starts.slice(0, 5) ?? "20:00",
          ends: found.posting?.ends.slice(0, 5) ?? "08:00",
          days: found.posting?.days ?? [1, 2, 3, 4, 5, 6, 7],
          dates: null,
        }
      : null;
  });
  const [cover, setCover] = useState<CoverDraft | null>(null);
  const [headcount, setHeadcountDraft] = useState("");

  const site = sites.find((s) => s.id === siteId) ?? null;
  const daySite = day ? sites.find((s) => s.id === day.siteId) : null;
  const dayShifts = day ? shifts.filter((s) => s.siteId === day.siteId && s.date === day.date) : [];
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? "-";

  function openSite(id: string) {
    const s = sites.find((x) => x.id === id);
    setHeadcountDraft(s?.required ? String(s.required) : "");
    setSiteId(id);
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string; note?: string }>, success: string, after?: () => void) {
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "That did not go through.");
        return;
      }
      toast.success(res.note ?? success);
      after?.();
    });
  }

  function newPosting(preset: Partial<PostingDraft> = {}) {
    const g = preset.guardId ? guards.find((x) => x.id === preset.guardId) : null;
    setPosting({
      guardId: preset.guardId ?? "",
      siteId: preset.siteId ?? g?.posting?.siteId ?? "",
      starts: g?.posting?.starts.slice(0, 5) ?? "20:00",
      ends: g?.posting?.ends.slice(0, 5) ?? "08:00",
      days: g?.posting?.days ?? [1, 2, 3, 4, 5, 6, 7],
      dates: null,
      ...preset,
    });
  }

  const unposted = guards.filter((g) => !g.posting && !g.dated);

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        {canEdit && (
          <>
            <Button variant="outline" onClick={() => setCover({ guardId: "", siteId: "", date: istDay(0), starts: "20:00", ends: "08:00" })}>
              <CalendarPlus data-icon="inline-start" />
              Add a cover shift
            </Button>
            <Button onClick={() => newPosting()}>
              <UserRoundPlus data-icon="inline-start" />
              Post a guard
            </Button>
          </>
        )}
      </div>

      {(notArrived.length > 0 || offRoster.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {notArrived.length > 0 && (
            <Panel tone="rose" title={`Not arrived · ${notArrived.length}`} icon={UserRoundX} bodyClassName="p-0 sm:p-0">
              <ul className="divide-y divide-app-line-soft">
                {notArrived.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-6 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs font-semibold text-rose-700">
                      {initials(s.guardName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{s.guardName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {siteName(s.siteId)} · due {time(s.startsAt)} · {ago(s.startsAt).replace(" ago", " late")}
                      </span>
                    </span>
                    <PhoneLink phone={s.guardPhone} className="text-sm" />
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {offRoster.length > 0 && (
            <Panel tone="amber" title={`Off-roster check-ins · ${offRoster.length}`} icon={CircleHelp} bodyClassName="p-0 sm:p-0">
              <ul className="divide-y divide-app-line-soft">
                {offRoster.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-6 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-xs font-semibold text-amber-800">
                      {initials(a.guardName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{a.guardName}</span>
                      <span className="block text-xs text-muted-foreground">
                        At {a.siteName} since {time(a.checkInAt)}, not rostered there
                      </span>
                    </span>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/console/attendance?record=${a.id}`}>Open</Link>
                    </Button>
                    {canEdit && (
                      <Button size="sm" disabled={pending} onClick={() => run(() => approveOffRoster(a.id), `${a.guardName}'s check-in approved`)}>
                        <CheckCircle2 data-icon="inline-start" />
                        Approve
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      <Panel tone="emerald" title="Sites and the week ahead" icon={CalendarRange} bodyClassName="p-0 sm:p-0">
        <div className="overflow-x-auto">
          <Table className={FLUSH_TABLE}>
            <TableHeader>
              <TableRow>
                <TableHead>Site</TableHead>
                <TableHead>Posted guards</TableHead>
                <TableHead className="text-center">On duty now</TableHead>
                {days.map((d, i) => {
                  const h = dayHeading(d);
                  return (
                    <TableHead key={d} className="text-center">
                      <span className="block text-[11px] leading-tight">{i === 0 ? "Today" : h.weekday}</span>
                      <span className="block text-[11px] leading-tight font-normal text-muted-foreground">{h.day}</span>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((s) => (
                <TableRow key={s.id} {...rowProps(() => openSite(s.id))}>
                  <TableCell>
                    <span className="block font-medium">{s.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      Needs {s.required ?? "-"} on duty{s.district ? ` · ${s.district}` : ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    {s.posted.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Nobody posted</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="flex -space-x-2">
                          {s.posted.slice(0, 4).map((p) => (
                            <span
                              key={p.guardId}
                              title={p.name}
                              className={cn(
                                "flex size-8 items-center justify-center rounded-full border-2 border-card text-[10px] font-semibold",
                                p.onDuty ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground",
                              )}
                            >
                              {initials(p.name)}
                            </span>
                          ))}
                        </span>
                        <span className="text-sm text-muted-foreground">{s.posted.length}</span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={cn(
                        "inline-flex min-w-14 justify-center rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums",
                        s.required ? (s.onDuty >= s.required ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800") : "bg-muted text-foreground",
                      )}
                    >
                      {s.onDuty}
                      {s.required ? ` / ${s.required}` : ""}
                    </span>
                    {s.notArrived > 0 && <span className="mt-1 block text-[11px] font-medium text-rose-600">{s.notArrived} not arrived</span>}
                  </TableCell>
                  {s.week.map((w) => (
                    <TableCell key={w.date} className="px-1 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDay({ siteId: s.id, date: w.date });
                        }}
                        className={cn(
                          "inline-flex h-9 w-12 items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition hover:scale-105",
                          cellTone(w.count, s.required),
                        )}
                      >
                        {w.count}
                        {s.required ? <span className="text-[10px] font-normal opacity-70">/{s.required}</span> : null}
                      </button>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>

      {unposted.length > 0 && (
        <Panel tone="sky" title={`Guards without a post · ${unposted.length}`} icon={Users}>
          <p className="mb-3 text-sm text-muted-foreground">Free for cover shifts, or post them to a site.</p>
          <ul className="flex flex-wrap gap-2">
            {unposted.map((g) => (
              <li key={g.id} className="flex items-center gap-2 rounded-xl border border-app-line-soft py-1.5 pr-1.5 pl-3">
                <span className="text-sm font-medium">{g.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{g.code}</span>
                {canEdit && (
                  <Button size="sm" variant="outline" onClick={() => newPosting({ guardId: g.id })}>
                    Post
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* ─────────────────────────────────────────── a site's staffing */}
      <PreviewDialog open={!!site} onClose={() => setSiteId(null)} label="Site staffing" wide>
        {site && (
          <>
            <PreviewHero
              icon={Building2}
              tone={site.required && site.onDuty < site.required ? "amber" : "brand"}
              title={site.name}
              meta={<span>{site.client ?? "No client recorded"}</span>}
              badge={
                <>
                  <HeroPill>Needs {site.required ?? "-"}</HeroPill>
                  <HeroPill>{site.onDuty} on duty</HeroPill>
                  {site.notArrived > 0 && <HeroPill>{site.notArrived} not arrived</HeroPill>}
                </>
              }
            />
            <PreviewBody>
              <StatGrid>
                <Stat icon={Users} label="Needs on duty">
                  {site.required ?? "-"}
                </Stat>
                <Stat icon={UserRoundPlus} label="Posted here" tone="text-sky-700">
                  {site.posted.length}
                </Stat>
                <Stat icon={CheckCircle2} label="On duty now" tone="text-primary-ink">
                  {site.onDuty}
                </Stat>
                <Stat icon={UserRoundX} label="Not arrived" tone={site.notArrived ? "text-rose-600" : "text-foreground"}>
                  {site.notArrived}
                </Stat>
              </StatGrid>

              <Section title="Posted guards">
                {site.posted.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-app-line-soft px-4 py-5 text-center text-sm text-muted-foreground">
                    Nobody is posted here yet. Guards can still check in (first come, first served) but nothing
                    is rostered.
                  </p>
                ) : (
                  <ul className="divide-y divide-app-line-soft overflow-hidden rounded-xl border border-app-line-soft">
                    {site.posted.map((p) => (
                      <li key={p.postingId} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                          {initials(p.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            {p.name} <span className="font-mono text-xs font-normal text-muted-foreground">{p.code}</span>
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {windowLabel(p.starts, p.ends)} · {p.dates ? datesLabel(p.dates) : daysLabel(p.days)}
                          </span>
                        </span>
                        <PhoneLink phone={p.phone} className="text-xs" />
                        <StatusPill status={p.onDuty ? "on_duty" : "checked_out"} label={p.onDuty ? "On duty" : "Off duty"} />
                        {canEdit && (
                          <span className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                newPosting(
                                  p.dates
                                    ? { guardId: p.guardId, siteId: site.id, starts: p.starts.slice(0, 5), ends: p.ends.slice(0, 5), dates: p.dates, postingId: p.postingId }
                                    : { guardId: p.guardId },
                                )
                              }
                            >
                              {p.dates ? "Edit" : "Move"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground"
                              disabled={pending}
                              onClick={() => run(() => endPosting(p.postingId), `${p.name} taken off the post`)}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="The next seven days">
                <div className="grid grid-cols-7 gap-2">
                  {site.week.map((w, i) => {
                    const h = dayHeading(w.date);
                    return (
                      <button
                        key={w.date}
                        type="button"
                        onClick={() => setDay({ siteId: site.id, date: w.date })}
                        className={cn("rounded-xl border px-2 py-2.5 text-center transition hover:scale-[1.03]", cellTone(w.count, site.required))}
                      >
                        <span className="block text-[11px] font-medium">{i === 0 ? "Today" : h.weekday}</span>
                        <span className="block text-lg font-bold tabular-nums">
                          {w.count}
                          {site.required ? <span className="text-xs font-normal opacity-70">/{site.required}</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Section>

              {canEdit && (
                <Section title="Guards needed on duty at once">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={headcount}
                      onChange={(e) => setHeadcountDraft(e.target.value)}
                      className="h-10 w-28"
                      aria-label="Guards needed"
                    />
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() => run(() => setHeadcount(site.id, headcount ? Number(headcount) : null), "Headcount saved")}
                    >
                      Save
                    </Button>
                    <span className="text-xs text-muted-foreground">Usually what the client’s contract says.</span>
                  </div>
                </Section>
              )}
            </PreviewBody>
            <PreviewActions>
              <Button asChild variant="outline" size="sm" className="mr-auto">
                <Link href={`/console/sites?site=${site.id}`}>
                  <MapPinned data-icon="inline-start" />
                  Site & fence
                </Link>
              </Button>
              {canEdit && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCover({ guardId: "", siteId: site.id, date: istDay(0), starts: "20:00", ends: "08:00" })}
                  >
                    <CalendarPlus data-icon="inline-start" />
                    Add a cover shift
                  </Button>
                  <Button size="sm" onClick={() => newPosting({ siteId: site.id })}>
                    <UserRoundPlus data-icon="inline-start" />
                    Post a guard here
                  </Button>
                </>
              )}
            </PreviewActions>
          </>
        )}
      </PreviewDialog>

      {/* ─────────────────────────────────────────── one day at one site */}
      <PreviewDialog open={!!day} onClose={() => setDay(null)} label="Shifts that day">
        {day && daySite && (
          <>
            <PreviewHero
              icon={CalendarDays}
              title={daySite.name}
              meta={
                <span>
                  {dayHeading(day.date).weekday} {dayHeading(day.date).day}
                </span>
              }
              badge={
                <HeroPill>
                  {dayShifts.length} of {daySite.required ?? "-"} rostered
                </HeroPill>
              }
            />
            <PreviewBody>
              {dayShifts.length === 0 ? (
                <p className="rounded-xl border border-dashed border-app-line-soft px-4 py-6 text-center text-sm text-muted-foreground">
                  Nobody is rostered here that day.
                </p>
              ) : (
                <ul className="divide-y divide-app-line-soft overflow-hidden rounded-xl border border-app-line-soft">
                  {dayShifts.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                      <Clock className="size-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {s.guardName} {s.cover && <span className="ml-1 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">Cover</span>}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {time(s.startsAt)} – {time(s.endsAt)}
                        </span>
                      </span>
                      <PhoneLink phone={s.guardPhone} className="text-xs" />
                      {s.notArrived ? (
                        <StatusPill label="Not arrived" tone="rose" />
                      ) : (
                        <StatusPill status={s.status === "in_progress" ? "on_duty" : s.status} />
                      )}
                      {canEdit && s.upcoming && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => run(() => cancelShift(s.id), "Shift cancelled")}
                        >
                          Cancel
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </PreviewBody>
            {canEdit && (
              <PreviewActions>
                <Button
                  size="sm"
                  onClick={() => setCover({ guardId: "", siteId: day.siteId, date: day.date, starts: "20:00", ends: "08:00" })}
                >
                  <CalendarPlus data-icon="inline-start" />
                  Add a cover shift
                </Button>
              </PreviewActions>
            )}
          </>
        )}
      </PreviewDialog>

      {/* ─────────────────────────────────────────── post a guard */}
      <PreviewDialog open={!!posting} onClose={() => setPosting(null)} label="Post a guard">
        {posting && (
          <>
            <PreviewHero
              icon={UserRoundPlus}
              title={
                posting.postingId
                  ? "Edit dated post"
                  : !posting.dates && guards.find((g) => g.id === posting.guardId)?.posting
                    ? "Move a guard"
                    : "Post a guard"
              }
              meta={
                <span>
                  {posting.dates
                    ? "A shift is written for each date you pick. The guard keeps any other posts."
                    : "Their shifts for the week are written from this, every week."}
                </span>
              }
            />
            <PreviewBody>
              <div className="grid gap-4 sm:grid-cols-2">
                <Pick
                  id="posting-guard"
                  label="Guard"
                  value={posting.guardId}
                  onChange={(v) => {
                    const g = guards.find((x) => x.id === v);
                    setPosting({
                      ...posting,
                      guardId: v,
                      ...(g?.posting && !posting.siteId ? { siteId: g.posting.siteId } : {}),
                    });
                  }}
                  placeholder="Choose a guard…"
                  options={guards.map((g) => ({
                    value: g.id,
                    label: g.name,
                    note: g.posting ? `now at ${siteName(g.posting.siteId)}` : g.dated ? `${g.dated} dated` : "no post",
                  }))}
                />
                <Pick
                  id="posting-site"
                  label="Site"
                  value={posting.siteId}
                  onChange={(v) => setPosting({ ...posting, siteId: v })}
                  placeholder="Choose a site…"
                  options={sites.map((s) => ({ value: s.id, label: s.name }))}
                />
                <div className="flex flex-col gap-2">
                  <Label htmlFor="posting-starts">From</Label>
                  <Input
                    id="posting-starts"
                    type="time"
                    value={posting.starts}
                    onChange={(e) => setPosting({ ...posting, starts: e.target.value })}
                    className="h-10"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="posting-ends">To</Label>
                  <Input
                    id="posting-ends"
                    type="time"
                    value={posting.ends}
                    onChange={(e) => setPosting({ ...posting, ends: e.target.value })}
                    className="h-10"
                  />
                </div>
                {!posting.postingId && (
                  <div className="sm:col-span-2">
                    <Segmented
                      label="Repeat"
                      value={posting.dates ? "dates" : "weekly"}
                      onChange={(v) => setPosting({ ...posting, dates: v === "dates" ? [] : null })}
                      options={[
                        { value: "weekly", label: "Every week" },
                        { value: "dates", label: "On dates" },
                      ]}
                    />
                  </div>
                )}
                {posting.dates ? (
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label>Dates</Label>
                    <DatesPicker value={posting.dates} onChange={(dates) => setPosting({ ...posting, dates })} />
                    <p className="text-xs text-muted-foreground">
                      {posting.starts && posting.ends
                        ? `${clock(`${posting.starts}:00`)} to ${clock(`${posting.ends}:00`)}${posting.ends <= posting.starts ? ", ending the next morning" : ""} · ${datesLabel(posting.dates)}`
                        : "Set the times."}
                    </p>
                  </div>
                ) : (
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label>Days</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((d) => {
                      const on = posting.days.includes(d.value);
                      return (
                        <button
                          key={d.value}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            setPosting({
                              ...posting,
                              days: on ? posting.days.filter((x) => x !== d.value) : [...posting.days, d.value],
                            })
                          }
                          className={cn(
                            "h-9 w-12 rounded-lg border text-sm font-medium transition",
                            on ? "border-primary/40 bg-accent text-accent-foreground" : "border-app-line-soft text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {d.short}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {posting.starts && posting.ends
                      ? `${clock(`${posting.starts}:00`)} to ${clock(`${posting.ends}:00`)}${posting.ends <= posting.starts ? ", ending the next morning" : ""} · ${daysLabel(posting.days)}`
                      : "Set the times."}
                  </p>
                </div>
                )}
              </div>
            </PreviewBody>
            <PreviewActions>
              <Button variant="outline" size="sm" onClick={() => setPosting(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={pending || !posting.guardId || !posting.siteId || posting.dates?.length === 0}
                onClick={() => run(() => savePosting(posting), "Posted", () => setPosting(null))}
              >
                <CheckCircle2 data-icon="inline-start" />
                Save post
              </Button>
            </PreviewActions>
          </>
        )}
      </PreviewDialog>

      {/* ─────────────────────────────────────────── a cover shift */}
      <PreviewDialog open={!!cover} onClose={() => setCover(null)} label="Add a cover shift">
        {cover && (
          <>
            <PreviewHero icon={CalendarPlus} title="Add a cover shift" meta={<span>A one-off: someone off sick, an event, an extra night.</span>} />
            <PreviewBody>
              <div className="grid gap-4 sm:grid-cols-2">
                <Pick
                  id="cover-guard"
                  label="Guard"
                  value={cover.guardId}
                  onChange={(v) => setCover({ ...cover, guardId: v })}
                  placeholder="Choose a guard…"
                  options={guards.map((g) => ({
                    value: g.id,
                    label: g.name,
                    note: g.posting ? `posted at ${siteName(g.posting.siteId)}` : "free",
                  }))}
                />
                <Pick
                  id="cover-site"
                  label="Site"
                  value={cover.siteId}
                  onChange={(v) => setCover({ ...cover, siteId: v })}
                  placeholder="Choose a site…"
                  options={sites.map((s) => ({ value: s.id, label: s.name }))}
                />
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cover-date">Date</Label>
                  <Input id="cover-date" type="date" value={cover.date} onChange={(e) => setCover({ ...cover, date: e.target.value })} className="h-10" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cover-starts">From</Label>
                    <Input id="cover-starts" type="time" value={cover.starts} onChange={(e) => setCover({ ...cover, starts: e.target.value })} className="h-10" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cover-ends">To</Label>
                    <Input id="cover-ends" type="time" value={cover.ends} onChange={(e) => setCover({ ...cover, ends: e.target.value })} className="h-10" />
                  </div>
                </div>
              </div>
            </PreviewBody>
            <PreviewActions>
              <Button variant="outline" size="sm" onClick={() => setCover(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={pending || !cover.guardId || !cover.siteId}
                onClick={() => run(() => addShift(cover), "Cover shift added", () => setCover(null))}
              >
                <CalendarPlus data-icon="inline-start" />
                Add shift
              </Button>
            </PreviewActions>
          </>
        )}
      </PreviewDialog>
    </>
  );
}


/** Two or three choices side by side, one on. */
function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border-2 border-border bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-8 rounded-lg px-3.5 text-sm font-semibold transition",
            value === o.value ? "bg-elevated text-foreground shadow-e1" : "text-secondary-fg hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A month calendar where each tap adds or removes a date. Shift-tap fills every
 * date between the last one tapped and this one, for a run of nights.
 */
function DatesPicker({ value, onChange }: { value: string[]; onChange: (dates: string[]) => void }) {
  const today = istDay(0);
  const [month, setMonth] = useState(() => (value[0] ?? today).slice(0, 7));
  const [anchor, setAnchor] = useState<string | null>(null);
  const picked = new Set(value);

  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array<null>(lead).fill(null), ...Array.from({ length }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const title = first.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  function toggle(date: string, range: boolean) {
    if (range && anchor) {
      const [a, b] = [anchor, date].sort() as [string, string];
      const next = new Set(picked);
      for (let d = new Date(`${a}T00:00:00Z`); d.toISOString().slice(0, 10) <= b; d.setUTCDate(d.getUTCDate() + 1)) {
        const iso = d.toISOString().slice(0, 10);
        if (iso >= today) next.add(iso);
      }
      onChange([...next].sort());
    } else {
      onChange(picked.has(date) ? value.filter((d) => d !== date) : [...value, date].sort());
    }
    setAnchor(date);
  }

  return (
    <div className="rounded-2xl border-2 border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} disabled={month <= today.slice(0, 7)} className="grid size-8 place-items-center rounded-lg hover:bg-muted disabled:opacity-30" aria-label="Previous month">
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-sm font-semibold">{title}</p>
        <button type="button" onClick={() => shift(1)} className="grid size-8 place-items-center rounded-lg hover:bg-muted" aria-label="Next month">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d.value} className="py-1 text-[11px] font-semibold text-muted-foreground">
            {d.short}
          </span>
        ))}
        {cells.map((date, i) =>
          date ? (
            <button
              key={date}
              type="button"
              disabled={date < today}
              aria-pressed={picked.has(date)}
              onClick={(e) => toggle(date, e.shiftKey)}
              className={cn(
                "h-9 rounded-lg text-sm font-medium tabular-nums transition disabled:opacity-30",
                picked.has(date) ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                date === today && !picked.has(date) && "ring-2 ring-primary/40 ring-inset",
              )}
            >
              {Number(date.slice(8))}
            </button>
          ) : (
            <span key={`pad-${i}`} />
          ),
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Shift-click to fill a run of dates.</span>
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="font-semibold text-foreground hover:underline">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
