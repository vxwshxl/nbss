"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Clock, Eye, LogOut, MapPin, MonitorSmartphone, NotebookPen, Search, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { addHandoverNote, deleteHandoverNote } from "@/app/console/handover/actions";
import { PeriodCount as Count, PeriodSwitch } from "@/components/console/period-switch";
import { PhoneLink } from "@/components/console/preview-kit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dropdown } from "@/components/ui/dropdown";
import { Textarea } from "@/components/ui/textarea";
import { periodPhrase, type Period } from "@/lib/period";
import { initials } from "@/lib/ui/initials";
import { cn } from "@/lib/utils";

export type HandoverNote = {
  id: string;
  siteId: string;
  siteName: string;
  district: string | null;
  author: string;
  authorRole: string;
  authorCode: string | null;
  authorPhone: string | null;
  avatarUrl: string | null;
  body: string;
  createdAt: string;
  /** Written by the guard as they checked out, rather than from the console. */
  atCheckOut: boolean;
  shiftIn: string | null;
  shiftOut: string | null;
  /** Among the notes the app shows the next guard on this site right now. */
  inApp: boolean;
};

/** A note the app shows the next guard on its site right now. */
export type AppNote = { id: string; siteId: string; body: string; author: string; createdAt: string };

const IST = "Asia/Kolkata";
const MAX = 2000;

const ROLE: Record<string, { label: string; chip: string; avatar: string }> = {
  guard: { label: "Guard", chip: "bg-emerald-500/10 text-emerald-800", avatar: "bg-emerald-600/12 text-emerald-700" },
  supervisor: { label: "Supervisor", chip: "bg-sky-500/10 text-sky-800", avatar: "bg-sky-600/12 text-sky-700" },
  admin: { label: "Admin", chip: "bg-violet-500/10 text-violet-800", avatar: "bg-violet-600/12 text-violet-700" },
  developer: { label: "Developer", chip: "bg-slate-500/10 text-slate-700", avatar: "bg-slate-600/12 text-slate-700" },
};

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST });
}
function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });
}
function dayLabel(key: string, today: string): string {
  const label = new Date(`${key}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: IST });
  if (key === today) return `Today · ${label}`;
  return label;
}

/**
 * Handover notes: what one shift leaves for the next. Guards write them as they
 * check out ("gate 2 lock broken, use the chain"); the desk can add its own. The
 * next guard on the site sees the latest ones in the app when they check in.
 */
export function HandoverWorkspace({
  notes,
  appNotes,
  sites,
  period,
  at,
  today,
  canEdit,
  oneSite,
  capped,
}: {
  notes: HandoverNote[];
  appNotes: AppNote[];
  sites: { id: string; name: string }[];
  period: Period;
  at: string;
  today: string;
  canEdit: boolean;
  oneSite: boolean;
  capped: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = notes.filter(
    (n) => (!filter || n.siteId === filter) && (!q || `${n.body} ${n.author} ${n.authorCode ?? ""} ${n.siteName}`.toLowerCase().includes(q)),
  );

  const groups: { key: string; notes: HandoverNote[] }[] = [];
  for (const n of shown) {
    const k = dayKey(n.createdAt);
    const last = groups.at(-1);
    if (last?.key === k) last.notes.push(n);
    else groups.push({ key: k, notes: [n] });
  }

  const fromGuards = shown.filter((n) => n.atCheckOut).length;
  const fromDesk = shown.length - fromGuards;
  const siteCount = new Set(shown.map((n) => n.siteId)).size;
  const inApp = shown.filter((n) => n.inApp).length;

  return (
    <div className="space-y-4">
      <PeriodSwitch period={period} at={at} today={today}>
        <label className="flex h-9 w-full items-center gap-2 rounded-full bg-muted/60 px-3 ring-1 ring-border/60 focus-within:ring-emerald-600 md:w-56">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        {!oneSite && (
          <Dropdown
            value={filter}
            onValueChange={setFilter}
            options={[{ value: "", label: "All sites" }, ...sites.map((s) => ({ value: s.id, label: s.name }))]}
            searchPlaceholder="Find a site"
            className="h-9 w-full rounded-full md:w-48"
          />
        )}
      </PeriodSwitch>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Count icon={NotebookPen} label="Notes" value={shown.length} tone="text-foreground" />
        <Count icon={LogOut} label="Left at check-out" value={fromGuards} tone="text-emerald-700" />
        <Count icon={MonitorSmartphone} label="From the desk" value={fromDesk} tone="text-sky-700" />
        <Count icon={oneSite ? Eye : Building2} label={oneSite ? "In the app now" : "Sites"} value={oneSite ? inApp : siteCount} tone="text-amber-700" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-2xl border border-app-line bg-card shadow-e1">
          {capped && <p className="border-b border-app-line-soft bg-amber-500/10 px-4 py-2 text-xs text-amber-800">More notes than one page loads; the latest 2,000 are shown.</p>}
          {shown.length === 0 ? (
            <div className="grid place-items-center gap-2 px-4 py-16 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
                <NotebookPen className="size-5" />
              </span>
              <p className="font-semibold">{q || filter ? "No notes match" : `No handover notes ${periodPhrase(period, at, today)}`}</p>
              <p className="max-w-sm text-sm text-muted-foreground">Guards leave one when they check out, and the desk can write one on the right.</p>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.key}>
                {period !== "day" && (
                  <h3 className="sticky top-0 z-[1] flex items-center justify-between border-b border-app-line-soft bg-muted/80 px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase backdrop-blur">
                    <span>{dayLabel(g.key, today)}</span>
                    <span className="tabular-nums">
                      {g.notes.length} note{g.notes.length === 1 ? "" : "s"}
                    </span>
                  </h3>
                )}
                <ol className="divide-y divide-app-line-soft">
                  {g.notes.map((n) => (
                    <NoteItem key={n.id} n={n} canEdit={canEdit} oneSite={oneSite} />
                  ))}
                </ol>
              </div>
            ))
          )}
        </section>

        <Composer sites={sites} initialSite={oneSite ? (sites[0]?.id ?? "") : filter} notes={appNotes} canEdit={canEdit} key={oneSite ? "one" : filter} />
      </div>
    </div>
  );
}

function NoteItem({ n, canEdit, oneSite }: { n: HandoverNote; canEdit: boolean; oneSite: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const role = ROLE[n.authorRole] ?? ROLE.guard!;
  return (
    <li className={cn("group flex gap-3 px-4 py-4 transition-colors hover:bg-muted/30", pending && "opacity-50")}>
      <Avatar className="size-10">
        {n.avatarUrl && <AvatarImage src={n.avatarUrl} alt="" />}
        <AvatarFallback className={cn("text-xs font-semibold", role.avatar)}>{initials(n.author)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-semibold">{n.author}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", role.chip)}>{role.label}</span>
              {n.inApp && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-800" title="The next guard on this site sees it at check-in">
                  <Eye className="size-3" /> In the app now
                </span>
              )}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              {n.authorCode && <span className="font-mono">{n.authorCode}</span>}
              {n.authorPhone && <PhoneLink phone={n.authorPhone} className="text-xs" />}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-right text-xs text-muted-foreground tabular-nums">
              <span className="block font-semibold text-foreground">{clock(n.createdAt)}</span>
              {new Date(n.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST })}
            </span>
            {canEdit && (
              <ConfirmDialog
                trigger={
                  <Button size="icon-sm" variant="ghost" aria-label="Delete note" disabled={pending} className="text-muted-foreground hover:text-rose-700">
                    <Trash2 />
                  </Button>
                }
                title="Delete this note?"
                description={`It leaves this log${n.inApp ? " and the next guard's app" : ""}. This cannot be undone.`}
                confirmLabel="Delete note"
                destructive
                onConfirm={() =>
                  start(async () => {
                    const r = await deleteHandoverNote(n.id);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Note deleted.");
                    router.refresh();
                  })
                }
              />
            )}
          </div>
        </div>

        <p className="rounded-xl border-l-4 border-amber-400 bg-amber-50/60 px-3 py-2 text-[15px] leading-relaxed whitespace-pre-wrap dark:bg-amber-500/5">{n.body}</p>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {!oneSite && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5 text-emerald-700" />
              <span className="font-medium text-foreground">{n.siteName}</span>
              {n.district && <span>· {n.district}</span>}
            </span>
          )}
          {n.atCheckOut ? (
            <span className="inline-flex items-center gap-1">
              <LogOut className="size-3.5" /> Left at check-out
              {n.shiftIn && (
                <span>
                  · on duty {clock(n.shiftIn)} – {n.shiftOut ? clock(n.shiftOut) : "now"}
                </span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <MonitorSmartphone className="size-3.5" /> Written from the console
            </span>
          )}
        </p>
      </div>
    </li>
  );
}

function Composer({ sites, initialSite, notes, canEdit }: { sites: { id: string; name: string }[]; initialSite: string; notes: AppNote[]; canEdit: boolean }) {
  const router = useRouter();
  const [site, setSite] = useState(initialSite);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const live = notes.filter((n) => n.siteId === site);

  return (
    <aside className="h-fit space-y-3 rounded-2xl border border-app-line bg-card p-4 shadow-e1 lg:sticky lg:top-20">
      <div>
        <h2 className="font-semibold">Leave a note for the next guard</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">They see a site&apos;s last 3 notes from the past 3 days when they check in.</p>
      </div>
      <Dropdown
        value={site}
        onValueChange={setSite}
        placeholder="Choose a site…"
        options={sites.map((s) => ({ value: s.id, label: s.name }))}
        searchPlaceholder="Find a site"
        className="h-10 rounded-xl"
      />
      <div className="space-y-1">
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value.slice(0, MAX))} rows={5} placeholder="e.g. Visitors for the wedding arrive from 5 pm. Keep gate 1 open." />
        <p className={cn("text-right text-[11px] tabular-nums", draft.length > MAX - 100 ? "text-amber-700" : "text-muted-foreground")}>
          {draft.length.toLocaleString("en-IN")} / {MAX.toLocaleString("en-IN")}
        </p>
      </div>
      <Button
        className="w-full"
        disabled={!canEdit || !site || !draft.trim() || pending}
        onClick={() =>
          start(async () => {
            const r = await addHandoverNote(site, draft);
            if (r.ok) {
              setDraft("");
              toast.success("Note left. The next guard sees it when they check in.");
              router.refresh();
            } else toast.error(r.error);
          })
        }
      >
        <Send data-icon="inline-start" /> {pending ? "Leaving note…" : "Leave note"}
      </Button>
      {!canEdit && <p className="text-xs text-muted-foreground">Stop viewing as someone else to write a note.</p>}

      {site && (
        <div className="space-y-2 border-t border-app-line-soft pt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Users className="size-3.5" /> The app shows here now
          </p>
          {live.length === 0 ? (
            <p className="text-xs text-muted-foreground">No notes for this site in the last 3 days.</p>
          ) : (
            <ul className="space-y-1.5">
              {live.map((n) => (
                <li key={n.id} className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
                  <span className="line-clamp-2">{n.body}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-3" /> {n.author} · {dayKey(n.createdAt) === dayKey(new Date().toISOString()) ? "" : `${new Date(n.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: IST })}, `}
                    {clock(n.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
