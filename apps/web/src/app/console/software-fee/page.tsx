import type { Metadata } from "next";
import { CalendarClock, CircleCheckBig, IndianRupee, Users } from "lucide-react";

import { PageHeader } from "@/components/console/page-header";
import { FeeWorkspace, type BilledAccount, type FeeInvoice, type FeeSettings } from "@/components/console/fee-workspace";
import { StatCard } from "@/components/console/stat-card";
import { requireRoleSession } from "@/lib/auth";
import { razorpayConfigured } from "@/lib/billing/razorpay";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Software fee" };
export const dynamic = "force-dynamic";

const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * What NBSS pays BODOOKHRANG TECH PVT. LTD. for this software, laid out as the
 * year's months (as SchoolERP shows its fee): from December 2026, ₹30 a month for
 * every account that is switched on, except clients and developers. A month counts
 * live while it runs and is locked when it ends or is paid. The accounts being
 * billed are listed underneath, by kind, so the count is never a mystery.
 */
export default async function SoftwareFeePage() {
  const session = await requireRoleSession("admin");
  const supabase = await supabaseServer();
  await supabase.rpc("software_fee_sync");
  // Which side this is (Test or Live): row level security already shows only it.
  const { data: test } = await supabase.rpc("data_test_view");
  const [{ data: settings }, { data: invoices }, { data: people }] = await Promise.all([
    supabase.from("software_fee_settings").select("*").eq("id", true).maybeSingle(),
    supabase.from("software_fee_invoices").select("*").order("period", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name, employee_code, role, trade, phone, joined_at, created_at, last_seen_at")
      .eq("active", true)
      .eq("is_test", !!test)
      .not("role", "in", "(developer,client)")
      .order("full_name"),
  ]);

  const rows = (invoices ?? []) as unknown as FeeInvoice[];
  const s = settings as unknown as FeeSettings | null;
  const accounts: BilledAccount[] = (people ?? []).map((p) => ({
    id: p.id,
    name: p.full_name,
    code: p.employee_code,
    kind: p.role === "guard" && p.trade === "housekeeping" ? "housekeeping" : (p.role as BilledAccount["kind"]),
    phone: p.phone,
    since: p.joined_at ?? p.created_at,
    lastSeen: p.last_seen_at,
  }));

  const unpaid = rows.filter((r) => r.status === "unpaid" && r.total_paise > 0);
  const due = unpaid.reduce((n, r) => n + r.total_paise, 0);
  const paid = rows.filter((r) => r.status === "paid");
  const rate = s?.per_guard_paise ?? 3000;
  const startsLabel = s?.account_billing_from
    ? new Date(`${s.account_billing_from}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })
    : "December 2026";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Billing" title="Software fee" />
      <p className="-mt-3 text-sm text-muted-foreground">
        Billed monthly by <span className="font-semibold text-foreground">{s?.seller_name ?? "Bodookhrang Tech Private Limited"}</span>
        {s?.seller_gstin ? ` (GSTIN ${s.seller_gstin})` : ""} for the NBSS console and app: {inr(rate)} a month for every active account
        from {startsLabel}. Each month is due on the {s?.due_day ?? 15}th.
      </p>
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active accounts" value={String(accounts.length)} hint="Admins, supervisors, guards and housekeepers" icon={Users} tone="sky" />
        <StatCard
          label="Per account"
          value={inr(rate)}
          hint={`a month${s && Number(s.gst_percent) > 0 ? ` + ${s.gst_percent}% GST` : ""}`}
          icon={IndianRupee}
          tone="violet"
        />
        <StatCard label="Due now" value={inr(due)} hint={due ? `${unpaid.length} month(s) unpaid` : "Nothing outstanding"} icon={CalendarClock} tone={due ? "amber" : "emerald"} />
        <StatCard label="Paid so far" value={inr(paid.reduce((n, r) => n + r.total_paise, 0))} hint={`${paid.length} month(s) settled`} icon={CircleCheckBig} tone="emerald" />
      </div>
      <FeeWorkspace
        invoices={rows}
        settings={s}
        accounts={accounts}
        // A developer viewing as an admin sees what an admin sees: pay and invoices only.
        canEdit={session.realProfile.role === "developer" && !session.impersonating}
        online={razorpayConfigured()}
      />
    </div>
  );
}
