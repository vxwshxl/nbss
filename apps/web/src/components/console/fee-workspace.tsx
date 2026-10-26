"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Loader2, Printer, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { saveFeeSettings, setFeeSkipped, startFeePayment, verifyFeePayment } from "@/app/console/software-fee/actions";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
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
  status: "paid" | "unpaid" | "skipped";
  skip_note?: string | null;
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

function StatusStamp({ status, big }: { status: "paid" | "unpaid" | "skipped"; big?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold tracking-wide uppercase",
        big ? "border-2 px-4 py-1.5 text-sm" : "px-2.5 py-0.5 text-[11px]",
        status === "paid" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : status === "skipped" ? "border-slate-400 bg-slate-100 text-slate-600" : "border-amber-500 bg-amber-50 text-amber-700",
      )}
    >
      {status === "paid" ? "Paid" : status === "skipped" ? "Skipped" : "Unpaid"}
    </span>
  );
}

/**
 * The software fee's months, newest first. A row opens its invoice; an unpaid month can
 * be paid through Razorpay from the row or the invoice. A developer sees the rate form.
 */
export function FeeWorkspace({ invoices, settings, canEdit, online }: { invoices: FeeInvoice[]; settings: FeeSettings | null; canEdit: boolean; online: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<FeeInvoice | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [skipping, setSkipping] = useState<string | null>(null);

  async function skip(inv: FeeInvoice, on: boolean) {
    setSkipping(inv.id);
    const r = await setFeeSkipped(inv.id, on);
    setSkipping(null);
    if (r.ok) {
      toast.success(on ? `${month(inv.period)} skipped: nothing due.` : `${month(inv.period)} is due again.`);
      router.refresh();
    } else toast.error(r.error ?? "Could not change it.");
  }

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

  // Invoices to print: one from its row or the invoice, or every one at once. They are
  // drawn into a sheet attached to <body> that only print shows, a page each.
  const [printing, setPrinting] = useState<FeeInvoice[] | null>(null);
  const printInvoices = (list: FeeInvoice[]) => setPrinting(list);
  useEffect(() => {
    if (!printing) return;
    document.body.classList.add("printing-fees");
    const done = () => {
      document.body.classList.remove("printing-fees");
      setPrinting(null);
    };
    window.addEventListener("afterprint", done, { once: true });
    const t = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", done);
      document.body.classList.remove("printing-fees");
    };
  }, [printing]);

  const columns: Column<FeeInvoice>[] = [
    {
      header: "Month",
      cell: (r) => (
        <button type="button" data-row-primary onClick={() => setOpen(r)} className="font-semibold hover:underline">
          {month(r.period)}
        </button>
      ),
      sortValue: (r) => r.period,
      searchValue: (r) => month(r.period),
      printCell: (r) => month(r.period),
    },
    { header: "Invoice", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.number}</span>, sortValue: (r) => r.number, searchValue: (r) => r.number, printCell: (r) => r.number },
    { header: "Guards", cell: (r) => <span className="tabular-nums">{r.guards}</span>, sortValue: (r) => r.guards, total: (rows) => rows.reduce((n, r) => n + r.guards, 0) },
    { header: "Rate", cell: (r) => <span className="tabular-nums">{r.per_guard_paise ? inr(r.per_guard_paise) : "-"}</span>, sortValue: (r) => r.per_guard_paise, printCell: (r) => (r.per_guard_paise ? inr(r.per_guard_paise) : "-") },
    {
      header: "Total",
      cell: (r) => <span className="font-semibold tabular-nums">{inr(r.total_paise)}</span>,
      sortValue: (r) => r.total_paise,
      printCell: (r) => inr(r.total_paise),
      total: (rows) => inr(rows.filter((r) => r.status !== "skipped").reduce((n, r) => n + r.total_paise, 0)),
    },
    {
      header: "Status",
      cell: (r) => (
        <span className="whitespace-nowrap">
          <StatusStamp status={r.status} />
          <span className="ml-2 text-xs text-muted-foreground">{r.status === "paid" && r.paid_at ? day(r.paid_at) : r.status === "skipped" ? (r.skip_note ?? "Free month") : `due ${day(r.due_on)}`}</span>
        </span>
      ),
      sortValue: (r) => r.status,
      searchValue: (r) => r.status,
      printCell: (r) => (r.status === "paid" ? `Paid${r.paid_at ? ` ${day(r.paid_at)}` : ""}` : r.status === "skipped" ? `Skipped · ${r.skip_note ?? "Free month"}` : `Unpaid · due ${day(r.due_on)}`),
    },
    {
      header: "",
      noPrint: true,
      cell: (inv) => (
        <span className="flex items-center justify-end gap-2 whitespace-nowrap">
          {settings && (
            <Button size="sm" variant="outline" onClick={() => printInvoices([inv])} aria-label={`Print the ${month(inv.period)} invoice`}>
              <Printer data-icon="inline-start" /> Print
            </Button>
          )}
          {canEdit && inv.status !== "paid" && (
            <Button size="sm" variant="outline" disabled={skipping === inv.id} onClick={() => void skip(inv, inv.status !== "skipped")}>
              {inv.status === "skipped" ? "Un-skip" : "Skip month"}
            </Button>
          )}
          {inv.status === "unpaid" && inv.total_paise >= 100 && !online && <span className="text-xs text-muted-foreground">Online payment not set up</span>}
          {inv.status === "unpaid" && online && inv.total_paise >= 100 && (
            <Button size="sm" onClick={() => void pay(inv)} disabled={paying === inv.id}>
              {paying === inv.id && <Loader2 className="animate-spin" />}
              Pay now
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        title="Monthly invoices"
        columns={columns}
        data={invoices}
        getRowKey={(r) => r.id}
        printTitle="Software fee invoices"
        searchPlaceholder="Search month, invoice or status…"
        emptyMessage="No invoices yet."
        interactiveRows
        rowClassName={(r) => (r.status === "unpaid" ? "bg-amber-50/40" : undefined)}
        toolbar={
          invoices.length > 0 && settings ? (
            <Button variant="outline" size="sm" onClick={() => printInvoices(invoices)}>
              <Printer data-icon="inline-start" /> Print all invoices
            </Button>
          ) : null
        }
      />

      {canEdit && settings && <RateForm settings={settings} />}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-3xl">
          {open && settings && <Invoice inv={open} s={settings} paying={paying === open.id} online={online} onPay={() => void pay(open)} onPrint={() => printInvoices([open])} />}
        </DialogContent>
      </Dialog>

      {printing &&
        settings &&
        createPortal(
          <div id="fee-print-root">
            {printing.map((inv) => (
              <div key={inv.id} className="fee-print-page">
                <Invoice inv={inv} s={settings} paying={false} online={false} onPay={() => undefined} onPrint={() => undefined} />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

function Invoice({ inv, s, paying, online, onPay, onPrint }: { inv: FeeInvoice; s: FeeSettings; paying: boolean; online: boolean; onPay: () => void; onPrint: () => void }) {
  const paid = inv.status === "paid";
  const skipped = inv.status === "skipped";
  return (
    <div id="fee-invoice" className="overflow-hidden rounded-2xl">
      {/* The band: who is billing, what this is, and whether it is settled. */}
      <div className="relative bg-gradient-to-br from-[#006b4a] via-[#009164] to-[#14b8a6] px-6 py-6 pr-16 text-white sm:px-8 sm:pr-16">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-white/75 uppercase">Tax invoice</p>
            <DialogTitle className="mt-1 text-2xl font-extrabold tracking-tight text-white">{s.seller_name}</DialogTitle>
            {s.seller_address && <p className="mt-0.5 text-sm text-white/80">{s.seller_address}</p>}
          </div>
          <span
            className={cn(
              "rounded-xl border-2 px-4 py-1.5 text-sm font-extrabold tracking-widest uppercase",
              paid ? "border-white bg-white text-emerald-700" : skipped ? "border-white/60 bg-white/20 text-white" : "border-amber-200 bg-amber-300 text-amber-950",
            )}
          >
            {paid ? "Paid" : skipped ? "Skipped" : "Unpaid"}
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Meta label="Invoice no." value={inv.number} mono />
          <Meta label="Period" value={month(inv.period)} />
          <Meta label={paid ? "Paid on" : "Due on"} value={paid && inv.paid_at ? day(inv.paid_at) : day(inv.due_on)} />
        </div>
      </div>

      <div className="space-y-6 px-6 py-6 sm:px-8">
        {/* Seller and buyer, with the registrations a business needs to claim GST. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="text-[11px] font-bold tracking-widest text-emerald-700 uppercase">From</p>
            <p className="mt-1 text-base font-bold">{s.seller_name}</p>
            <div className="mt-3 grid gap-2">
              {s.seller_gstin && <Reg label="GSTIN" value={s.seller_gstin} />}
              {s.seller_cin && <Reg label="CIN" value={s.seller_cin} />}
            </div>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
            <p className="text-[11px] font-bold tracking-widest text-sky-700 uppercase">Billed to</p>
            <p className="mt-1 text-base font-bold">{s.buyer_name}</p>
            <div className="mt-3 grid gap-2">{s.buyer_gstin ? <Reg label="GSTIN" value={s.buyer_gstin} /> : <p className="text-xs text-muted-foreground">Kokrajhar, Assam</p>}</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-app-line">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-[11px] tracking-wider text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Description</th>
                <th className="px-4 py-2.5 text-right font-semibold">Guards</th>
                <th className="px-4 py-2.5 text-right font-semibold">Rate</th>
                <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-app-line-soft">
                <td className="px-4 py-3">
                  <p className="font-semibold">NBSS software</p>
                  <p className="text-xs text-muted-foreground">Console and app, per active guard · {month(inv.period)}</p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{inv.guards}</td>
                <td className="px-4 py-3 text-right tabular-nums">{inr(inv.per_guard_paise)}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{inr(inv.amount_paise)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <p
            className={cn(
              "rounded-xl px-4 py-3 text-sm font-medium",
              paid ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800",
            )}
          >
            {paid
              ? `Paid ${inv.paid_at ? day(inv.paid_at) : ""} online${inv.razorpay_payment_id ? ` · ${inv.razorpay_payment_id}` : ""}`
              : skipped
                ? `Skipped · ${inv.skip_note ?? "Free month"} · nothing due`
                : `Unpaid · due on ${day(inv.due_on)}`}
          </p>
          <dl className="w-full max-w-xs space-y-1.5 rounded-2xl bg-muted/50 p-4 text-sm sm:w-72">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{inr(inv.amount_paise)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">GST {Number(inv.gst_percent) > 0 ? `@ ${inv.gst_percent}%` : ""}</dt>
              <dd className="tabular-nums">{inr(inv.gst_paise)}</dd>
            </div>
            <div className="flex justify-between border-t border-app-line pt-2 text-lg font-extrabold">
              <dt>Total</dt>
              <dd className="tabular-nums">{inr(inv.total_paise)}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-app-line-soft pt-5 print:hidden">
          <p className="text-[11px] text-muted-foreground">Computer-generated invoice · {s.seller_name}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onPrint}>
              <Printer data-icon="inline-start" /> Print
            </Button>
            {!paid && !skipped && online && inv.total_paise >= 100 && (
              <Button onClick={onPay} disabled={paying}>
                {paying && <Loader2 className="animate-spin" />}
                Pay {inr(inv.total_paise)}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl bg-white/12 px-3 py-2 ring-1 ring-white/20">
      <p className="text-[10px] font-semibold tracking-widest text-white/70 uppercase">{label}</p>
      <p className={cn("text-sm font-bold", mono && "font-mono")}>{value}</p>
    </div>
  );
}

/** A statutory number, large and copyable at a glance. */
function Reg({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-black/5">
      <span className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">{label}</span>
      <span className="font-mono text-[15px] font-bold tracking-wide">{value}</span>
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
