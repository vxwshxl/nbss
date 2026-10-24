"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Printer, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { saveFeeSettings, startFeePayment, verifyFeePayment } from "@/app/console/software-fee/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type FeeInvoice = {
  id: string;
  number: string;
  period: string;
  guards: number;
  per_guard_paise: number;
  amount_paise: number;
  gst_percent: number;
  gst_paise: number;
  total_paise: number;
  status: "paid" | "unpaid";
  is_test?: boolean;
  due_on: string;
  paid_at: string | null;
  razorpay_payment_id: string | null;
};
export type FeeSettings = {
  per_guard_paise: number;
  gst_percent: number;
  due_day: number;
  seller_name: string;
  seller_gstin: string | null;
  seller_address: string | null;
  seller_cin?: string | null;
  buyer_name: string;
  buyer_gstin: string | null;
};

const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const month = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const day = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00Z` : d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: d.length === 10 ? "UTC" : "Asia/Kolkata" });

type RazorpayCtor = new (o: Record<string, unknown>) => { open: () => void };
declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}
function loadCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function StatusStamp({ status, big }: { status: "paid" | "unpaid"; big?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold tracking-wide uppercase",
        big ? "border-2 px-4 py-1.5 text-sm" : "px-2.5 py-0.5 text-[11px]",
        status === "paid" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-amber-500 bg-amber-50 text-amber-700",
      )}
    >
      {status === "paid" ? "Paid" : "Unpaid"}
    </span>
  );
}

/**
 * The software fee's months, newest first. A row opens its invoice; an unpaid month can
 * be paid through Razorpay from the row or the invoice. A developer sees the rate form.
 */
export function FeeWorkspace({ invoices, settings, canEdit, online, test = false }: { invoices: FeeInvoice[]; settings: FeeSettings | null; canEdit: boolean; online: boolean; test?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<FeeInvoice | null>(null);
  const [paying, setPaying] = useState<string | null>(null);

  async function pay(inv: FeeInvoice) {
    setPaying(inv.id);
    try {
      const order = await startFeePayment(inv.id);
      if (!order.ok) return void toast.error(order.error);
      if (!(await loadCheckout()) || !window.Razorpay) return void toast.error("Could not load the payment window.");
      new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: "INR",
        order_id: order.orderId,
        name: settings?.seller_name ?? "Bodookhrang Tech Private Limited",
        description: `NBSS software fee · ${month(inv.period)} · ${order.number}`,
        prefill: order.prefill,
        theme: { color: "#009164" },
        handler: async (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const v = await verifyFeePayment({ invoiceId: inv.id, orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
          if (v.ok) toast.success("Payment received. Thank you.");
          else toast.error(v.error ?? "Payment could not be confirmed.");
          setOpen(null);
          router.refresh();
        },
      }).open();
    } finally {
      setPaying(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-app-line bg-card shadow-e1">
        <div className="flex items-center justify-between gap-3 border-b border-app-line-soft bg-gradient-to-r from-emerald-50 to-sky-50 px-5 py-3.5">
          <h2 className="flex items-center gap-2 font-semibold">
            Monthly invoices
            {test && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold text-amber-950">TEST</span>}
          </h2>
          <span className="text-xs text-muted-foreground">Tap a month for its invoice</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground uppercase">
              <tr className="border-b border-app-line-soft">
                <th className="px-5 py-2.5 font-semibold">Month</th>
                <th className="px-3 py-2.5 font-semibold">Invoice</th>
                <th className="px-3 py-2.5 text-right font-semibold">Guards</th>
                <th className="px-3 py-2.5 text-right font-semibold">Rate</th>
                <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-app-line-soft">
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                    No invoices yet.
                  </td>
                </tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id} onClick={() => setOpen(inv)} className={cn("cursor-pointer transition-colors hover:bg-muted/50", inv.status === "unpaid" && "bg-amber-50/40")}>
                  <td className="px-5 py-3 font-semibold">{month(inv.period)}</td>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{inv.number}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{inv.guards}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{inv.per_guard_paise ? inr(inv.per_guard_paise) : "-"}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{inr(inv.total_paise)}</td>
                  <td className="px-3 py-3">
                    <StatusStamp status={inv.status} />
                    <span className="ml-2 text-xs text-muted-foreground">{inv.status === "paid" && inv.paid_at ? day(inv.paid_at) : `due ${day(inv.due_on)}`}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {inv.status === "unpaid" && inv.total_paise >= 100 && !online && (
                      <span className="text-xs text-muted-foreground">Online payment not set up</span>
                    )}
                    {inv.status === "unpaid" && online && inv.total_paise >= 100 && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          void pay(inv);
                        }}
                        disabled={paying === inv.id}
                      >
                        {paying === inv.id && <Loader2 className="animate-spin" />}
                        {test ? "Pay (test)" : "Pay now"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canEdit && settings && <RateForm settings={settings} />}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-xl">
          {open && settings && <Invoice inv={open} s={settings} paying={paying === open.id} online={online} onPay={() => void pay(open)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Invoice({ inv, s, paying, online, onPay }: { inv: FeeInvoice; s: FeeSettings; paying: boolean; online: boolean; onPay: () => void }) {
  return (
    <div id="fee-invoice" className="space-y-5">
      <div className="flex items-start justify-between gap-4 pr-8">
        <div>
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
            Tax invoice
            {inv.is_test && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold text-amber-950">TEST</span>}
          </DialogTitle>
          <p className="font-mono text-xs text-muted-foreground">{inv.number}</p>
        </div>
        <StatusStamp status={inv.status} big />
      </div>

      <div className="grid gap-4 rounded-xl bg-muted/50 p-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">From</p>
          <p className="font-semibold">{s.seller_name}</p>
          {s.seller_address && <p className="text-xs text-muted-foreground">{s.seller_address}</p>}
          {s.seller_gstin && <p className="text-xs text-muted-foreground">GSTIN {s.seller_gstin}</p>}
          {s.seller_cin && <p className="text-xs text-muted-foreground">CIN {s.seller_cin}</p>}
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">Billed to</p>
          <p className="font-semibold">{s.buyer_name}</p>
          {s.buyer_gstin && <p className="text-xs text-muted-foreground">GSTIN {s.buyer_gstin}</p>}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Period</dt>
        <dd className="text-right font-medium">{month(inv.period)}</dd>
        <dt className="text-muted-foreground">Due on</dt>
        <dd className="text-right font-medium">{day(inv.due_on)}</dd>
      </dl>

      <table className="w-full text-sm">
        <tbody className="divide-y divide-app-line-soft">
          <tr>
            <td className="py-2">
              NBSS software · {inv.guards} active guard{inv.guards === 1 ? "" : "s"} × {inr(inv.per_guard_paise)}
            </td>
            <td className="py-2 text-right tabular-nums">{inr(inv.amount_paise)}</td>
          </tr>
          {Number(inv.gst_percent) > 0 && (
            <tr>
              <td className="py-2">GST {inv.gst_percent}%</td>
              <td className="py-2 text-right tabular-nums">{inr(inv.gst_paise)}</td>
            </tr>
          )}
          <tr className="text-base font-bold">
            <td className="py-2.5">Total</td>
            <td className="py-2.5 text-right tabular-nums">{inr(inv.total_paise)}</td>
          </tr>
        </tbody>
      </table>

      {inv.status === "paid" ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Paid {inv.paid_at ? day(inv.paid_at) : ""} online{inv.razorpay_payment_id ? ` · Razorpay ${inv.razorpay_payment_id}` : ""}.
        </p>
      ) : (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Unpaid. Due on {day(inv.due_on)}.</p>
      )}

      <div className="flex flex-wrap justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer data-icon="inline-start" /> Print
        </Button>
        {inv.status === "unpaid" && online && inv.total_paise >= 100 && (
          <Button onClick={onPay} disabled={paying}>
            {paying && <Loader2 className="animate-spin" />}
            Pay {inr(inv.total_paise)}
          </Button>
        )}
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        {s.seller_name}
        {s.seller_gstin ? ` · GSTIN ${s.seller_gstin}` : ""}
        {s.seller_cin ? ` · CIN ${s.seller_cin}` : ""} · software for National Bodo Security Service. Computer-generated invoice.
      </p>
    </div>
  );
}

function RateForm({ settings }: { settings: FeeSettings }) {
  const router = useRouter();
  const [rate, setRate] = useState(String(settings.per_guard_paise / 100));
  const [gst, setGst] = useState(String(settings.gst_percent));
  const [pending, start] = useTransition();
  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Settings2 className="size-4 text-violet-600" /> Fee settings
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">Developer only</span>
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">Applies to this month (if unpaid) and every month after. Paid months keep their figures.</p>
      <form
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveFeeSettings({ perGuardRupees: Number(rate), gstPercent: Number(gst) });
            if (r.ok) {
              toast.success("Fee updated.");
              router.refresh();
            } else toast.error(r.error ?? "Could not save.");
          });
        }}
      >
        <label className="grid gap-1 text-sm">
          <span className="font-medium">₹ per guard / month</span>
          <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className="h-10 w-36 rounded-xl border border-border bg-card px-3 tabular-nums" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">GST %</span>
          <input value={gst} onChange={(e) => setGst(e.target.value)} inputMode="decimal" className="h-10 w-24 rounded-xl border border-border bg-card px-3 tabular-nums" />
        </label>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Save
        </Button>
      </form>
    </section>
  );
}
