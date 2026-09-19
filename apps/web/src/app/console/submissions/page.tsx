import type { Metadata } from "next";
import { Briefcase, Inbox, Mail, MessageSquareQuote } from "lucide-react";

import { PageHeader } from "@/components/console/page-header";
import { StatCard } from "@/components/console/stat-card";
import { SubmissionsWorkspace } from "@/components/console/submissions-workspace";
import { requireRole } from "@/lib/auth";
import { countSubmissions, listSubmissions } from "@/lib/store";

export const metadata: Metadata = { title: "Enquiries" };
export const dynamic = "force-dynamic";

/**
 * The public forms' inbox.
 *
 * Still reading `data/submissions.json`: the `submissions` table exists in
 * Postgres but the three public forms have not been repointed at it yet, and
 * moving the reader before the writer would make today's enquiries vanish from
 * this page. Both halves change together in the next piece of work.
 *
 * Everything is fetched unfiltered and the kind filter lives in the client.
 * The whole inbox is a few hundred rows of text at most, and a desk switching
 * between "all" and "applications" thirty times an hour should not be waiting
 * on a round trip to do it.
 */
export default async function SubmissionsPage() {
  await requireRole("admin", "supervisor");

  const [submissions, counts] = await Promise.all([
    listSubmissions(),
    countSubmissions(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Desk" title="Enquiries" />

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Unactioned"
          value={String(counts.new)}
          hint={counts.new ? "Nobody has picked these up" : "The desk is clear"}
          icon={Inbox}
          tone={counts.new ? "amber" : "emerald"}
        />
        <StatCard
          label="Quote requests"
          value={String(counts.quote)}
          hint="From the quote form"
          icon={MessageSquareQuote}
          tone="emerald"
        />
        <StatCard
          label="Enquiries"
          value={String(counts.enquiry)}
          hint="From the contact form"
          icon={Mail}
          tone="sky"
        />
        <StatCard
          label="Applications"
          value={String(counts.application)}
          hint="From the careers pages"
          icon={Briefcase}
          tone="violet"
        />
      </div>

      <SubmissionsWorkspace rows={submissions} />

      <p className="text-xs text-muted-foreground">
        Still stored in <code className="font-mono">data/submissions.json</code>. On a
        serverless host that file is wiped on every deploy — moving these into
        Postgres is the next piece of work.
      </p>
    </div>
  );
}
