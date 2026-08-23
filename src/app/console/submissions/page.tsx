import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/Icon";
import { StatusButtons } from "@/components/StatusButtons";
import { site, tel } from "@/content/site";
import { requireRole } from "@/lib/auth";
import { countSubmissions, listSubmissions, type Kind } from "@/lib/store";

export const metadata: Metadata = { title: "Submissions" };
export const dynamic = "force-dynamic";

const KINDS: Kind[] = ["quote", "enquiry", "application"];

function formatDate(iso: string): string {
  return `${new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: site.timeZone,
  })} IST`;
}

/**
 * The public forms' inbox, moved inside the console.
 *
 * Still reading data/submissions.json: the `submissions` table exists in
 * Postgres but the three public forms have not been repointed at it yet, and
 * moving the reader before the writer would make today's enquiries vanish from
 * this page. Both halves change together in the next piece of work.
 */
export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  await requireRole("admin", "supervisor");

  const { kind } = await searchParams;
  const filter = KINDS.includes(kind as Kind) ? (kind as Kind) : undefined;

  const [submissions, counts] = await Promise.all([
    listSubmissions(filter),
    countSubmissions(),
  ]);

  return (
    <div className="cwrap">
      <div className="chead">
        <div>
          <h1 className="chead__h">Submissions</h1>
          <p className="chead__lede">Everything that came off the public forms, newest first.</p>
        </div>
      </div>

      <div className="cstats">
        <div className="cstat">
          <span className="cstat__v">{counts.total}</span>
          <span className="cstat__l">total</span>
        </div>
        <div className={`cstat${counts.new ? " cstat--ok" : ""}`}>
          <span className="cstat__v">{counts.new}</span>
          <span className="cstat__l">new</span>
        </div>
        <div className="cstat">
          <span className="cstat__v">{counts.quote}</span>
          <span className="cstat__l">quotes</span>
        </div>
        <div className="cstat">
          <span className="cstat__v">{counts.enquiry}</span>
          <span className="cstat__l">enquiries</span>
        </div>
        <div className="cstat">
          <span className="cstat__v">{counts.application}</span>
          <span className="cstat__l">applications</span>
        </div>
      </div>

      <div className="chips">
        <Link className={`chip${!filter ? " is-on" : ""}`} href="/console/submissions">All</Link>
        <Link className={`chip${filter === "quote" ? " is-on" : ""}`} href="/console/submissions?kind=quote">Quotes</Link>
        <Link className={`chip${filter === "enquiry" ? " is-on" : ""}`} href="/console/submissions?kind=enquiry">Enquiries</Link>
        <Link className={`chip${filter === "application" ? " is-on" : ""}`} href="/console/submissions?kind=application">Applications</Link>
      </div>

      {submissions.length === 0 ? (
        <div className="cpanel">
          <p className="cempty">
            <strong>Nothing here yet.</strong>
            Submit the contact, quote or application form and it will appear.
          </p>
        </div>
      ) : (
        <div className="subs">
          {submissions.map((s) => (
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
                    <dd><a href={`tel:${tel(s.phone)}`}>{s.phone}</a></dd>
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

      <p className="admin-note">
        <Icon name="shield-alt" />
        <span>
          Still stored in <code>data/submissions.json</code>. On a serverless host that file is
          wiped on every deploy — moving these into Postgres is the next piece of work.
        </span>
      </p>
    </div>
  );
}
