"use client";

import Link from "next/link";

import { Pagination } from "@/components/console/DataTable";
import { Icon } from "@/components/Icon";
import { StatusButtons } from "@/components/StatusButtons";
import { useTableControls } from "@/lib/hooks/useTableControls";
import type { Submission, Kind } from "@/lib/store";

const IST = "Asia/Kolkata";

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

/**
 * The submissions inbox.
 *
 * A card list rather than a table, because a submission is mostly a paragraph
 * of free text and a handful of optional fields — a row of columns would be
 * three-quarters empty on every enquiry. It carries the same search, date
 * range and pagination as the tables, so the controls behave identically
 * wherever you are in the console.
 */
export function SubmissionsList({
  rows,
  filter,
}: {
  rows: Submission[];
  filter?: Kind;
}) {
  const t = useTableControls(rows, {
    persistKey: `nbss.list.submissions.${filter ?? "all"}`,
    initialPerPage: 20,
    searchFields: (s) => [
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
    ],
    dateField: (s) => s.createdAt,
    sorters: { newest: (a, b) => a.createdAt.localeCompare(b.createdAt) },
    initialSort: "newest",
    initialDir: "desc",
  });

  if (rows.length === 0) {
    return (
      <div className="cpanel">
        <p className="cempty">
          <strong>Nothing here yet.</strong>
          Submit the contact, quote or application form and it will appear.
        </p>
      </div>
    );
  }

  const start = (t.page - 1) * t.perPage + 1;
  const end = Math.min(t.total, t.page * t.perPage);

  return (
    <div className="cpanel cpanel--table">
      <div className="ctools">
        <div className="ctools__search">
          <Icon name="search" />
          <input
            className="ctools__input"
            type="search"
            value={t.query}
            onChange={(e) => t.setQuery(e.target.value)}
            placeholder="Search by name, phone, reference or message…"
            aria-label="Search submissions"
          />
        </div>

        <div className="ctools__dates" role="group" aria-label="Filter by date received">
          <input
            className="ctools__date"
            type="date"
            value={t.from}
            onChange={(e) => t.setFrom(e.target.value)}
            aria-label="From date"
            max={t.to || undefined}
          />
          <span className="ctools__arrow" aria-hidden="true">→</span>
          <input
            className="ctools__date"
            type="date"
            value={t.to}
            onChange={(e) => t.setTo(e.target.value)}
            aria-label="To date"
            min={t.from || undefined}
          />
          {t.hasDateFilter && (
            <button className="btn btn--ghost btn--sm" type="button" onClick={t.clearDates}>
              Clear
            </button>
          )}
        </div>

        <button
          className="btn btn--ghost btn--sm"
          type="button"
          onClick={() => t.toggleSort("newest", "desc")}
        >
          {t.dir === "desc" ? "Newest first" : "Oldest first"}
        </button>
      </div>

      {t.total === 0 ? (
        <p className="cempty">
          <strong>Nothing matches those filters.</strong>
          Try a different search, or clear the date range.
        </p>
      ) : (
        <div className="subs subs--inset">
          {t.rows.map((s) => (
            <article className="sub" key={s.id}>
              <header className="sub__head">
                <span className="sub__ref">{s.id}</span>
                <span className={`sub__kind sub__kind--${s.kind}`}>{s.kind}</span>
                <span className="sub__when">{formatDate(s.createdAt)}</span>
                <span className="sub__status">
                  <span className={`badge badge--${s.status}`}>{s.status}</span>
                </span>
              </header>

              <div className="sub__body">
                <dl className="sub__dl">
                  <div><dt>Name</dt><dd>{s.name}</dd></div>
                  <div>
                    <dt>Phone</dt>
                    <dd><a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}>{s.phone}</a></dd>
                  </div>
                  {s.email && (
                    <div><dt>Email</dt><dd><a href={`mailto:${s.email}`}>{s.email}</a></dd></div>
                  )}
                  {s.company && <div><dt>Organisation</dt><dd>{s.company}</dd></div>}
                  {s.subject && <div><dt>Subject</dt><dd>{s.subject}</dd></div>}
                  {s.service && <div><dt>Service</dt><dd>{s.service}</dd></div>}
                  {s.siteType && <div><dt>Site</dt><dd>{s.siteType}</dd></div>}
                  {s.district && <div><dt>District</dt><dd>{s.district}</dd></div>}
                  {s.headcount && <div><dt>Headcount</dt><dd>{s.headcount}</dd></div>}
                  {s.startWhen && <div><dt>Start</dt><dd>{s.startWhen}</dd></div>}
                  {s.vacancyTitle && <div><dt>Applied for</dt><dd>{s.vacancyTitle}</dd></div>}
                  {s.age && <div><dt>Age</dt><dd>{s.age}</dd></div>}
                  {s.education && <div><dt>Education</dt><dd>{s.education}</dd></div>}
                </dl>

                {s.message && <p className="sub__msg">{s.message}</p>}
                {s.experience && <p className="sub__msg">{s.experience}</p>}
              </div>

              <footer className="sub__foot">
                <span className="sub__ip">{s.remoteIp ?? "—"}</span>
                <StatusButtons id={s.id} current={s.status} />
              </footer>
            </article>
          ))}
        </div>
      )}

      <Pagination
        page={t.page}
        totalPages={t.totalPages}
        perPage={t.perPage}
        total={t.total}
        start={start}
        end={end}
        onPage={t.setPage}
        onPerPage={t.setPerPage}
      />
    </div>
  );
}

/** Kept here so the page's chips and this list agree on their hrefs. */
export function KindChips({ filter }: { filter?: Kind }) {
  const chips: { label: string; kind?: Kind }[] = [
    { label: "All" },
    { label: "Quotes", kind: "quote" },
    { label: "Enquiries", kind: "enquiry" },
    { label: "Applications", kind: "application" },
  ];

  return (
    <div className="chips">
      {chips.map((c) => (
        <Link
          key={c.label}
          className={`chip${filter === c.kind ? " is-on" : ""}`}
          href={c.kind ? `/console/submissions?kind=${c.kind}` : "/console/submissions"}
        >
          {c.label}
        </Link>
      ))}
    </div>
  );
}
