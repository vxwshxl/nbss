import type { Metadata } from "next";

import { Icon } from "@/components/Icon";
import { KindChips, SubmissionsList } from "@/components/console/SubmissionsList";
import { requireRole } from "@/lib/auth";
import { countSubmissions, listSubmissions, type Kind } from "@/lib/store";

export const metadata: Metadata = { title: "Submissions" };
export const dynamic = "force-dynamic";

const KINDS: Kind[] = ["quote", "enquiry", "application"];

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

      <KindChips filter={filter} />

      <SubmissionsList rows={submissions} filter={filter} />

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
