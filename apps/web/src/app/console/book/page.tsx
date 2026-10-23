import type { Metadata } from "next";

import { BookWorkspace, type BookingRow } from "@/components/console/book-workspace";
import { PageHeader } from "@/components/console/page-header";
import { requireRoleSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Book guards" };
export const dynamic = "force-dynamic";

/**
 * Where every "Book guards" button on the website ends up. The client asks
 * here, and follows the request here — reference, status and the desk's note —
 * as it moves from received to guards on the gate.
 */
export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const [session, params] = await Promise.all([requireRoleSession("client"), searchParams]);
  const supabase = await supabaseServer();

  const [{ data: rows }, { data: auth }] = await Promise.all([
    supabase
      .from("service_requests")
      .select(
        "id, reference, service_type, site_type, district, address, guards_required, shift_pattern, start_date, duration_months, days_required, shift_types, notes, status, quote_note, quoted_amount_paise, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);

  const meta = (auth.user?.user_metadata ?? {}) as { organisation?: string };
  const local = (session.profile.email ?? "").split("@")[0];
  const named = session.profile.full_name !== local;
  const first = rows?.length === 0;

  return (
    <div className="space-y-6">
      {first ? (
        <div className="mb-6">
          <p className="text-lg text-muted-foreground">Hello{named ? "," : ""}</p>
          <h1 className="display-section text-[clamp(2rem,4vw,3rem)]">
            {named ? session.profile.full_name : "Welcome to NBSS"}
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Book guards for your site. It takes about two minutes, and the deployment desk calls you back to arrange the site visit.
          </p>
        </div>
      ) : (
        <PageHeader eyebrow="Book guards" title="Request security for your site" />
      )}
      <BookWorkspace
        rows={(rows ?? []) as BookingRow[]}
        defaults={{
          contactName: session.profile.full_name === local ? "" : session.profile.full_name,
          phone: session.profile.phone ?? "",
          organisation: meta.organisation ?? "",
          service: params.service ?? "",
        }}
      />
    </div>
  );
}
