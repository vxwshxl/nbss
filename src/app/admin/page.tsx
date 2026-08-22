import type { Metadata } from "next";
import Link from "next/link";

import { signOut } from "@/app/actions";
import { AronaiBand, Icon } from "@/components/Icon";
import { StatusButtons } from "@/components/StatusButtons";
import { site, tel } from "@/content/site";
import { countSubmissions, listSubmissions, type Kind } from "@/lib/store";

export const metadata: Metadata = {
  title: "Operations — submissions",
  robots: { index: false, follow: false },
};

/** Reads a file on every request, so it must never be cached or prerendered. */
export const dynamic = "force-dynamic";

const KINDS: Kind[] = ["quote", "enquiry", "application"];

/**
 * Submissions are stored as UTC ISO strings, and this page renders on the
 * server — which on the host is a UTC box, not a desk in Kokrajhar. Without an
 * explicit zone the operations desk would read every enquiry as arriving five
 * and a half hours before it did. The zone is pinned to IST and printed, so
 * the timestamp says what it means.
 */
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

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const filter = KINDS.includes(kind as Kind) ? (kind as Kind) : undefined;

  const [submissions, counts] = await Promise.all([
    listSubmissions(filter),
    countSubmissions(),
  ]);

  return (
    <>
      <section className="phead phead--admin">
        <div className="wrap phead__in">
          <p className="eyebrow">
            <span className="eyebrow__num">OPS</span>
            <span className="eyebrow__rule" />
            Internal — not indexed
          </p>
          <h1 className="phead__h">Submissions</h1>
          <p className="phead__lede">
            Everything that came off the public forms, newest first.
          </p>
          {/* A plain form, so signing out needs no client bundle of its own. */}
          <form className="phead__cta" action={signOut}>
            <button className="btn btn--ghost btn--sm" type="submit">
              Sign out
            </button>
          </form>
        </div>
        <AronaiBand />
      </section>

      <section className="section">
        <div className="wrap">
          <div className="admin-stats">
            <div className="astat">
              <span className="astat__v">{counts.total}</span>
              <span className="astat__l">total</span>
            </div>
            <div className="astat astat--hot">
              <span className="astat__v">{counts.new}</span>
              <span className="astat__l">new</span>
            </div>
            <div className="astat">
              <span className="astat__v">{counts.quote}</span>
              <span className="astat__l">quotes</span>
            </div>
            <div className="astat">
              <span className="astat__v">{counts.enquiry}</span>
              <span className="astat__l">enquiries</span>
            </div>
            <div className="astat">
              <span className="astat__v">{counts.application}</span>
              <span className="astat__l">applications</span>
            </div>
          </div>

          <div className="chips">
            <Link className={`chip${!filter ? " is-on" : ""}`} href="/admin">All</Link>
            <Link className={`chip${filter === "quote" ? " is-on" : ""}`} href="/admin?kind=quote">Quotes</Link>
            <Link className={`chip${filter === "enquiry" ? " is-on" : ""}`} href="/admin?kind=enquiry">Enquiries</Link>
            <Link className={`chip${filter === "application" ? " is-on" : ""}`} href="/admin?kind=application">Applications</Link>
          </div>

          {submissions.length === 0 ? (
            <p className="empty">
              Nothing here yet. Submit the contact, quote or application form and it will appear.
            </p>
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
                        <div>
                          <dt>Email</dt>
                          <dd><a href={`mailto:${s.email}`}>{s.email}</a></dd>
                        </div>
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
              Submissions are stored in <code>data/submissions.json</code>. Back it up like any
              other business record — it holds names and phone numbers.
            </span>
          </p>
        </div>
      </section>
    </>
  );
}
