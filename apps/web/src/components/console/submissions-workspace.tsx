"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Briefcase,
  Inbox,
  Mail,
  MessageSquareQuote,
  Phone,
  Search,
  SearchX,
} from "lucide-react";
import { toast } from "sonner";

import { updateStatus } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Kind, Status, Submission } from "@/lib/store";

const IST = "Asia/Kolkata";

const KIND_META: Record<Kind, { label: string; icon: typeof Inbox; tone: string }> = {
  quote: {
    label: "Quote",
    icon: MessageSquareQuote,
    tone: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300",
  },
  enquiry: {
    label: "Enquiry",
    icon: Mail,
    tone: "bg-sky-600/15 text-sky-700 dark:text-sky-300",
  },
  application: {
    label: "Application",
    icon: Briefcase,
    tone: "bg-violet-600/15 text-violet-700 dark:text-violet-300",
  },
};

const STATUSES: Status[] = ["new", "contacted", "closed"];

const STATUS_LABEL: Record<Status, string> = {
  new: "New",
  contacted: "Contacted",
  closed: "Closed",
};

function formatDate(iso: string): string {
  return `${new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  })} IST`;
}

/** One optional field on a submission. Absent fields are dropped, not blanked. */
function Detail({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

/** Triage. The action revalidates on the server, so nothing is held locally. */
function Triage({ id, current }: { id: string; current: Status }) {
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-1 rounded-full bg-muted/70 p-0.5 ring-1 ring-border/60">
      {STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          disabled={pending || status === current}
          onClick={() =>
            start(async () => {
              await updateStatus(id, status);
              toast.success(`Marked ${STATUS_LABEL[status].toLowerCase()}`);
            })
          }
          className={cn(
            "press rounded-full px-2.5 py-1 text-xs font-medium outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-ring/50",
            status === current
              ? "bg-background text-foreground shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground disabled:opacity-50",
          )}
        >
          {STATUS_LABEL[status]}
        </button>
      ))}
    </div>
  );
}

/**
 * The submissions inbox.
 *
 * Cards rather than a table, and the reason is the shape of the data: a
 * submission is mostly a paragraph of free text plus a handful of fields that
 * differ per form — a quote carries a headcount and a district, an application
 * carries an age and an education. As table columns that is three-quarters
 * empty on every row. As cards, each one shows exactly the fields it has.
 *
 * The filter is a tab rail rather than a set of links, because switching
 * between "all" and "applications" is something a desk does dozens of times an
 * hour and a full page navigation for each is a page reload for each.
 */
export function SubmissionsWorkspace({ rows }: { rows: Submission[] }) {
  const [kind, setKind] = useState<Kind | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((s) => {
      if (kind !== "all" && s.kind !== kind) return false;
      if (!q) return true;
      return [
        s.id,
        s.name,
        s.phone,
        s.email,
        s.company,
        s.subject,
        s.message,
        s.service,
        s.district,
        s.vacancyTitle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, kind, query]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      quote: rows.filter((s) => s.kind === "quote").length,
      enquiry: rows.filter((s) => s.kind === "enquiry").length,
      application: rows.filter((s) => s.kind === "application").length,
    }),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={kind} onValueChange={(v) => setKind(v as Kind | "all")}>
          <TabsList>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            <TabsTrigger value="quote">Quotes ({counts.quote})</TabsTrigger>
            <TabsTrigger value="enquiry">Enquiries ({counts.enquiry})</TabsTrigger>
            <TabsTrigger value="application">
              Applications ({counts.application})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, reference…"
            aria-label="Search submissions"
            className="h-9 pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-app-line-soft bg-card px-6 py-16 text-center shadow-card">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {query.trim() ? (
              <SearchX className="size-5" strokeWidth={1.75} />
            ) : (
              <Inbox className="size-5" strokeWidth={1.75} />
            )}
          </span>
          {query.trim() ? (
            <>
              <p className="text-sm font-medium">
                No matches for &ldquo;{query.trim()}&rdquo;
              </p>
              <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                Clear search
              </Button>
            </>
          ) : (
            <p className="max-w-sm text-sm text-muted-foreground">
              Nothing here yet. Anything submitted through the contact, quote or
              application forms lands on this page.
            </p>
          )}
        </div>
      ) : (
        <div key={`${kind}-${query}`} className="stagger flex flex-col gap-3">
          {filtered.map((s) => {
            const meta = KIND_META[s.kind];
            const Icon = meta.icon;
            return (
              <article
                key={s.id}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-card shadow-card",
                  // A new submission is work nobody has touched. It is the only
                  // state that earns a tint; "contacted" and "closed" are just
                  // history and read as history.
                  s.status === "new"
                    ? "border-primary/25 ring-1 ring-primary/10"
                    : "border-app-line-soft",
                )}
              >
                <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-app-line-soft px-4 py-3">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      meta.tone,
                    )}
                  >
                    <Icon className="size-4" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{s.name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {s.id}
                    </span>
                  </span>
                  <span className="ml-auto flex items-center gap-3">
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {formatDate(s.createdAt)}
                    </span>
                    <StatusPill status={s.status} />
                  </span>
                </header>

                <div className="space-y-4 px-4 py-4">
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Detail
                      label="Phone"
                      value={
                        <a
                          href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}
                          className="font-mono text-primary hover:underline"
                        >
                          {s.phone}
                        </a>
                      }
                    />
                    <Detail
                      label="Email"
                      value={
                        s.email ? (
                          <a
                            href={`mailto:${s.email}`}
                            className="text-primary hover:underline"
                          >
                            {s.email}
                          </a>
                        ) : undefined
                      }
                    />
                    <Detail label="Organisation" value={s.company} />
                    <Detail label="Subject" value={s.subject} />
                    <Detail label="Service" value={s.service} />
                    <Detail label="Site" value={s.siteType} />
                    <Detail label="District" value={s.district} />
                    <Detail label="Headcount" value={s.headcount} />
                    <Detail label="Start" value={s.startWhen} />
                    <Detail label="Applied for" value={s.vacancyTitle} />
                    <Detail label="Age" value={s.age} />
                    <Detail label="Education" value={s.education} />
                  </dl>

                  {(s.message || s.experience) && (
                    <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm leading-relaxed whitespace-pre-line">
                      {s.message ?? s.experience}
                    </div>
                  )}
                </div>

                <footer className="flex flex-wrap items-center gap-3 border-t border-app-line-soft px-4 py-2.5">
                  <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                    <Phone className="size-3" strokeWidth={1.9} />
                    {s.remoteIp ?? "—"}
                  </span>
                  <span className="ml-auto">
                    <Triage id={s.id} current={s.status} />
                  </span>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
