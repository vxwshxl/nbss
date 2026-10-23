"use client";

import { useState, useTransition } from "react";
import { NotebookPen, Send } from "lucide-react";
import { toast } from "sonner";

import { addHandoverNote } from "@/app/console/handover/actions";
import { istDateTime } from "@/components/console/preview-kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { initials } from "@/lib/ui/initials";
import { cn } from "@/lib/utils";

export type HandoverNote = {
  id: string;
  siteId: string;
  siteName: string;
  author: string;
  authorRole: string;
  body: string;
  createdAt: string;
};

/**
 * Handover notes: what one shift leaves for the next. Guards write them as they
 * check out ("gate 2 lock broken, use the chain"); the desk can add its own. The
 * next guard on the site sees the latest ones in the app when they check in.
 */
export function HandoverWorkspace({ notes, sites }: { notes: HandoverNote[]; sites: { id: string; name: string }[] }) {
  const [site, setSite] = useState("");
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const shown = site ? notes.filter((n) => n.siteId === site) : notes;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="overflow-hidden rounded-2xl border border-app-line bg-card">
        <header className="flex flex-wrap items-center gap-3 border-b border-app-line-soft px-4 py-3">
          <NotebookPen className="size-4 text-amber-600" />
          <h2 className="flex-1 font-semibold">{shown.length} note{shown.length === 1 ? "" : "s"}, last 30 days</h2>
          <select value={site} onChange={(e) => setSite(e.target.value)} className="h-9 rounded-full bg-muted/70 px-3 text-sm ring-1 ring-border/60 outline-none" aria-label="Site">
            <option value="">All sites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </header>
        {shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No handover notes yet. Guards add one when they check out.</p>
        ) : (
          <ol className="divide-y divide-app-line-soft">
            {shown.map((n) => (
              <li key={n.id} className="flex gap-3 px-4 py-3.5">
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold", n.authorRole === "guard" ? "bg-emerald-600/12 text-emerald-700" : "bg-sky-600/12 text-sky-700")}>
                  {initials(n.author)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{n.author}</span>
                    <span className="text-muted-foreground"> · {n.siteName} · {istDateTime(n.createdAt)}</span>
                  </p>
                  <p className="mt-1 text-[15px] whitespace-pre-wrap">{n.body}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <aside className="h-fit space-y-3 rounded-2xl border border-app-line bg-card p-4">
        <h2 className="font-semibold">Leave a note for the next guard</h2>
        <select value={site} onChange={(e) => setSite(e.target.value)} className="h-10 w-full rounded-xl bg-muted/70 px-3 text-sm ring-1 ring-border/60 outline-none" aria-label="Site for the note">
          <option value="">Choose a site…</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} placeholder="e.g. Visitors for the wedding arrive from 5 pm. Keep gate 1 open." />
        <Button
          className="w-full"
          disabled={!site || !draft.trim() || pending}
          onClick={() =>
            start(async () => {
              const r = await addHandoverNote(site, draft);
              if (r.ok) {
                setDraft("");
                toast.success("Note left. The next guard sees it when they check in.");
              } else toast.error(r.error);
            })
          }
        >
          <Send data-icon="inline-start" /> Leave note
        </Button>
      </aside>
    </div>
  );
}
