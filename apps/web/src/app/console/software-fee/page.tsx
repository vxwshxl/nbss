import type { Metadata } from "next";
import { CalendarClock, CircleCheckBig, IndianRupee, Users } from "lucide-react";

import { PageHeader } from "@/components/console/page-header";
import { FeeWorkspace, type FeeInvoice, type FeeSettings } from "@/components/console/fee-workspace";
import { StatCard } from "@/components/console/stat-card";
import { requireRoleSession } from "@/lib/auth";
import { razorpayConfigured } from "@/lib/billing/razorpay";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Software fee" };
export const dynamic = "force-dynamic";

const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * What NBSS pays BODOOKHRANG TECH PVT. LTD. for this software: a monthly invoice, per
 * active guard. Every row opens its invoice (PAID or UNPAID); unpaid months can be paid
 * online through Razorpay. Admins and developers; only a developer changes the rate.
 */
export default async function SoftwareFeePage() {
  const session = await requireRoleSession("admin");
  const supabase = await supabaseServer();
  await supabase.rpc("software_fee_sync");
  const [{ data: settings }, { data: invoices }, { count: guards }] = await Promise.all([
    supabase.from("software_fee_settings").select("*").eq("id", true).maybeSingle(),
    supabase.from("software_fee_invoices").select("*").order("period", { ascending: false }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "guard").eq("active", true).eq("is_test", false),
  ]);

  const rows = (invoices ?? []) as FeeInvoice[];
  const due = rows.filter((r) => r.status === "unpaid").reduce((n, r) => n + r.total_paise, 0);
  const paid = rows.filter((r) => r.status === "paid");
  const s = settings as FeeSettings | null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Billing" title="Software fee" />
      <p className="-mt-3 text-sm text-muted-foreground">
        Billed monthly by <span className="font-semibold text-foreground">{s?.seller_name ?? "BODOOKHRANG TECH PVT. LTD."}</span> for the NBSS console and app,
        per active guard. Each month is due on the {s?.due_day ?? 15}th.
      </p>
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active guards" value={String(guards ?? 0)} hint="Billed this month (test accounts never count)" icon={Users} tone="sky" />
        <StatCard label="Per guard" value={inr(s?.per_guard_paise ?? 1500)} hint={`a month${s && Number(s.gst_percent) > 0 ? ` + ${s.gst_percent}% GST` : ""}`} icon={IndianRupee} tone="violet" />
        <StatCard label="Due now" value={inr(due)} hint={due ? `${rows.filter((r) => r.status === "unpaid").length} month(s) unpaid` : "Nothing outstanding"} icon={CalendarClock} tone={due ? "amber" : "emerald"} />
        <StatCard label="Paid so far" value={inr(paid.reduce((n, r) => n + r.total_paise, 0))} hint={`${paid.length} month(s) settled`} icon={CircleCheckBig} tone="emerald" />
      </div>
      <FeeWorkspace invoices={rows} settings={s} canEdit={session.realProfile.role === "developer"} online={razorpayConfigured()} />
    </div>
  );
}
