import type { Metadata } from "next";
import { CalendarClock, CheckCircle2, ClipboardList, MessageSquareQuote } from "lucide-react";

import { BookingsWorkspace, type BookingInboxRow } from "@/components/console/bookings-workspace";
import { PageHeader } from "@/components/console/page-header";
import { StatCard } from "@/components/console/stat-card";
import { requireRoleSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

/** Every request for guards from a signed-in client, newest first. */
export default async function BookingsPage() {
  const session = await requireRoleSession("admin", "supervisor");
  const supabase = await supabaseServer();

  const [{ data }, { data: sites }] = await Promise.all([
    supabase
      .from("service_requests")
      .select(
        "id, reference, client_id, contact_name, organisation, email, phone, service_type, site_type, district, address, guards_required, shift_pattern, start_date, duration_months, notes, status, quoted_amount_paise, quote_note, site_id, source, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase.from("sites").select("id, name, district, client_id").eq("active", true).order("name"),
  ]);

  const rows = (data ?? []) as BookingInboxRow[];
  const open = rows.filter((r) => r.status === "new").length;
  const inProgress = rows.filter((r) => ["reviewing", "quoted", "accepted"].includes(r.status)).length;
  const deployed = rows.filter((r) => r.status === "converted").length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Desk" title="Bookings" />
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="New" value={String(open)} hint={open ? "Waiting for a call back" : "Nothing waiting"} icon={CalendarClock} tone={open ? "amber" : "emerald"} />
        <StatCard label="In progress" value={String(inProgress)} hint="Survey, quote or accepted" icon={MessageSquareQuote} tone="violet" />
        <StatCard label="Deployed" value={String(deployed)} hint="Guards on the client's site" icon={CheckCircle2} tone="emerald" />
        <StatCard label="All requests" value={String(rows.length)} hint="Since the first booking" icon={ClipboardList} tone="sky" />
      </div>
      <BookingsWorkspace
        rows={rows}
        sites={sites ?? []}
        canDeploy={session.profile.role === "admin" && !session.impersonating}
      />
    </div>
  );
}
