"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, FileText, HardHat, Loader2, Lock, Printer, Settings2, ShieldCheck, Sparkles, UserCog, Users } from "lucide-react";
import { toast } from "sonner";

import { saveFeeSettings, setFeeSkipped, startFeePayment, verifyFeePayment } from "@/app/console/software-fee/actions";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type FeeLine = { label: string; tag?: string | null; qty: number; rate_paise: number; amount_paise: number };
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
  lines?: FeeLine[] | null;
  accounts?: Partial<Record<AccountKind, number>> | null;
  locked_at?: string | null;
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
  account_billing_from?: string | null;
};
export type AccountKind = "admin" | "supervisor" | "guard" | "housekeeping" | "field_officer";
export type BilledAccount = {
  id: string;
  name: string;
  code: string;
  kind: AccountKind;
  phone: string | null;
  since: string | null;
  lastSeen: string | null;
};

/** The kinds of account billed, in the order the cards show them. */
const KINDS: { kind: AccountKind; label: string; one: string; icon: typeof Users; tint: string }[] = [
  { kind: "admin", label: "NBSS Admins", one: "Admin", icon: UserCog, tint: "text-violet-600 bg-violet-100" },
  { kind: "supervisor", label: "Supervisors", one: "Supervisor", icon: BadgeCheck, tint: "text-sky-600 bg-sky-100" },
  { kind: "guard", label: "Guards", one: "Guard", icon: ShieldCheck, tint: "text-emerald-700 bg-emerald-100" },
  { kind: "housekeeping", label: "Housekeepers", one: "Housekeeper", icon: Sparkles, tint: "text-amber-700 bg-amber-100" },
  { kind: "field_officer", label: "Field officers", one: "Field officer", icon: HardHat, tint: "text-rose-600 bg-rose-100" },
];
const kindLabel = (k: AccountKind) => KINDS.find((x) => x.kind === k)?.one ?? k;

const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const month = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const day = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00Z` : d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: d.length === 10 ? "UTC" : "Asia/Kolkata" });

/** The lines an invoice is made of: its frozen lines, or the old one-line per-guard form. */
function linesOf(inv: FeeInvoice): FeeLine[] {
  if (inv.lines && inv.lines.length) return inv.lines;
  if (!inv.amount_paise) return [];
  return [{ label: "NBSS software · per active account", qty: inv.guards, rate_paise: inv.per_guard_paise, amount_paise: inv.amount_paise }];
}
const isAccountsLine = (l: FeeLine) => l.label.startsWith("NBSS software");

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

type Row = { period: string; inv: FeeInvoice | null };
type State = "paid" | "unpaid" | "skipped" | "upcoming" | "nothing";

function stateOf(r: Row): State {
  if (!r.inv) return "upcoming";
  if (r.inv.status !== "unpaid") return r.inv.status;
  return r.inv.total_paise > 0 ? "unpaid" : "nothing";
}

function StatusPill({ state }: { state: State }) {
  const map: Record<State, [string, string]> = {
    paid: ["Paid", "bg-emerald-100 text-emerald-700"],
    unpaid: ["Unpaid", "bg-amber-100 text-amber-800"],
    skipped: ["Waived", "bg-slate-100 text-slate-600"],
    upcoming: ["Upcoming", "bg-muted text-muted-foreground"],
    nothing: ["Nothing due", "bg-emerald-50 text-emerald-700"],
  };
  const [label, cls] = map[state];
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", cls)}>{label}</span>;
}

/** The Indian financial year a month belongs to, as "2026–27". */
function fy(period: string) {
  const [y, m] = period.split("-").map(Number) as [number, number];
  const start = m >= 4 ? y : y - 1;
  return `${start}–${String((start + 1) % 100).padStart(2, "0")}`;
}

/** Every month from the first invoice to the end of the current financial year. */
function schedule(invoices: FeeInvoice[]): { fy: string; rows: Row[] }[] {
  if (!invoices.length) return [];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [ty, tm] = today.split("-").map(Number) as [number, number];
  const endYear = tm >= 4 ? ty + 1 : ty; // March of this financial year
  const first = invoices.map((i) => i.period).sort()[0]!;
  let [y, m] = first.split("-").map(Number) as [number, number];
  const byPeriod = new Map(invoices.map((i) => [i.period.slice(0, 7), i]));
  const sections = new Map<string, Row[]>();
  while (y < endYear || (y === endYear && m <= 3)) {
    const period = `${y}-${String(m).padStart(2, "0")}-01`;
    const key = fy(period);
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key)!.push({ period, inv: byPeriod.get(period.slice(0, 7)) ?? null });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return [...sections.entries()].map(([k, rows]) => ({ fy: k, rows })).reverse();
}

/**
 * The software fee as the year's months (as SchoolERP lays it out): each month's
 * amount with its working underneath, its status, and what can be done with it.
 * Only the oldest unpaid month can be paid; months to come are locked and show no
 * amount yet. Underneath, every account being billed, by kind.
 */
export function FeeWorkspace({
  invoices,
  settings,
  accounts,
  canEdit,
  online,
}: {
  invoices: FeeInvoice[];
  settings: FeeSettings | null;
  accounts: BilledAccount[];
  canEdit: boolean;
  online: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<FeeInvoice | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [skipping, setSkipping] = useState<string | null>(null);
  const sections = useMemo(() => schedule(invoices), [invoices]);
  // The one month that can be paid now: the oldest unpaid one with something due.
  const payableId = useMemo(
    () => [...invoices].sort((a, b) => a.period.localeCompare(b.period)).find((i) => i.status === "unpaid" && i.total_paise >= 100)?.id ?? null,
    [invoices],
  );
  const thisMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);

  async function skip(inv: FeeInvoice, on: boolean) {
    setSkipping(inv.id);
    const r = await setFeeSkipped(inv.id, on);
    setSkipping(null);
    if (r.ok) {
      toast.success(on ? `${month(inv.period)} waived: nothing due.` : `${month(inv.period)} is due again.`);
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

  // Invoices to print: drawn into a sheet attached to <body> that only print shows.
  const [printing, setPrinting] = useState<FeeInvoice[] | null>(null);
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

  const rate = settings?.per_guard_paise ?? 3000;
  const gst = Number(settings?.gst_percent ?? 0);

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.fy} className="overflow-hidden rounded-3xl border border-app-line bg-card shadow-e1">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-ink px-5 py-4 text-ink-fg sm:px-6">
            <h2 className="font-semibold">Financial year {section.fy}</h2>
            <span className="text-xs text-ink-fg/70">Due on the {settings?.due_day ?? 15}th of each month</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-app-line bg-muted/50 text-left text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                  <th className="px-5 py-3">Month</th>
                  <th className="px-5 py-3">Last date</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-line-soft">
                {section.rows.map((row) => {
                  const st = stateOf(row);
                  const inv = row.inv;
                  const lines = inv ? linesOf(inv) : [];
                  const live = !!inv && inv.status === "unpaid" && !inv.locked_at && row.period.slice(0, 7) === thisMonth;
                  const oneTime = lines.length > 0 && lines.every((l) => l.tag === "One-time");
                  return (
                    <tr
                      key={row.period}
                      onClick={() => inv && setOpen(inv)}
                      className={cn(inv && "cursor-pointer hover:bg-muted/40", st === "unpaid" && "bg-amber-50/40")}
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-semibold">{month(row.period)}</span>
                        {oneTime && <Tag>One-time</Tag>}
                        {live && <Tag tone="live">Live</Tag>}
                        {inv?.locked_at && inv.status === "unpaid" && <Tag tone="lock">Locked</Tag>}
                        {inv && <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{inv.number}</span>}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums">{inv ? day(inv.due_on) : day(`${row.period.slice(0, 8)}${String(settings?.due_day ?? 15).padStart(2, "0")}`)}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums">
                        {!inv ? (
                          <span className="text-muted-foreground/60">—</span>
                        ) : (
                          <>
                            <span className="font-semibold">{inr(inv.total_paise)}</span>
                            {lines.map((l, i) => (
                              <span key={i} className="mt-0.5 block text-[11px] text-muted-foreground">
                                {isAccountsLine(l) ? `${l.qty} accounts × ${inr(l.rate_paise)}` : `${i ? "+ " : ""}${l.label} ${inr(l.amount_paise)}`}
                              </span>
                            ))}
                            {inv.gst_paise > 0 && (
                              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                + GST {Number(inv.gst_percent)}% {inr(inv.gst_paise)}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill state={st} />
                        {inv?.status === "paid" && inv.paid_at && <span className="ml-2 text-xs text-muted-foreground">{day(inv.paid_at)}</span>}
                      </td>
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                          {!inv ? (
                            <Lock className="size-4 text-muted-foreground/40" aria-label="Not open yet" />
                          ) : (
                            <>
                              <Button size="sm" variant="ghost" className="size-8 p-0" aria-label={`Open the ${month(row.period)} invoice`} onClick={() => setOpen(inv)}>
                                <FileText className="size-4" />
                              </Button>
                              {settings && (
                                <Button size="sm" variant="ghost" className="size-8 p-0" aria-label={`Print the ${month(row.period)} invoice`} onClick={() => setPrinting([inv])}>
                                  <Printer className="size-4" />
                                </Button>
                              )}
                              {canEdit && inv.status !== "paid" && (
                                <Button size="sm" variant="outline" disabled={skipping === inv.id} onClick={() => void skip(inv, inv.status !== "skipped")}>
                                  {inv.status === "skipped" ? "Un-waive" : "Waive"}
                                </Button>
                              )}
                              {inv.id === payableId &&
                                (online ? (
                                  <Button size="sm" onClick={() => void pay(inv)} disabled={paying === inv.id}>
                                    {paying === inv.id && <Loader2 className="animate-spin" />}
                                    Pay now
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Online payment not set up</span>
                                ))}
                              {inv.status === "unpaid" && inv.total_paise >= 100 && inv.id !== payableId && (
                                <span className="text-xs text-muted-foreground">Pay the earlier month first</span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="text-xs leading-relaxed text-muted-foreground">
        From {settings?.account_billing_from ? month(settings.account_billing_from) : "December 2026"} the fee is {inr(rate)} a month for every account that is
        switched on (NBSS admins, supervisors, guards, housekeepers and field officers), whether it was used or not
        {gst > 0 ? `, plus ${gst}% GST` : ""}. Clients and developers are never billed, and an account an administrator switches off stops
        counting. While a month runs its amount follows today&apos;s accounts (<b>Live</b>); when the month ends, or is paid, its count and
        lines are <b>locked</b> and never change. Months to come show no amount yet. November 2026 carries one charge only: App publish on
        Google Play Store, ₹1,000 once plus GST. Only the oldest unpaid month can be paid.
      </p>

      <Accounts accounts={accounts} rate={rate} />

      {canEdit && settings && <RateForm settings={settings} />}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-3xl">
          {open && settings && (
            <Invoice
              inv={open}
              s={settings}
              paying={paying === open.id}
              online={online && open.id === payableId}
              onPay={() => void pay(open)}
              onPrint={() => setPrinting([open])}
            />
          )}
        </DialogContent>
      </Dialog>

      {printing &&
        settings &&
        createPortal(
          <div id="fee-print-root">
            {printing.map((inv) => (
              <div key={inv.id} className="fee-print-page">
                <Invoice inv={inv} s={settings} paying={false} online={false} onPay={() => undefined} onPrint={() => undefined} inDialog={false} />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: "live" | "lock" }) {
  return (
    <span
      className={cn(
        "ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 align-middle text-[10px] font-bold tracking-wide uppercase",
        tone === "live" ? "bg-sky-100 text-sky-700" : tone === "lock" ? "bg-slate-100 text-slate-600" : "bg-muted text-muted-foreground",
      )}
    >
      {tone === "live" && <span className="size-1.5 animate-pulse rounded-full bg-sky-500" />}
      {tone === "lock" && <Lock className="size-2.5" />}
      {children}
    </span>
  );
}

/** Who is billed: a card per kind (a filter), and every account in a table. */
function Accounts({ accounts, rate }: { accounts: BilledAccount[]; rate: number }) {
  const [kind, setKind] = useState<AccountKind | "all">("all");
  const counts = useMemo(() => {
    const c = new Map<AccountKind, number>();
    for (const a of accounts) c.set(a.kind, (c.get(a.kind) ?? 0) + 1);
    return c;
  }, [accounts]);
  const shown = kind === "all" ? accounts : accounts.filter((a) => a.kind === kind);

  const columns: Column<BilledAccount>[] = [
    {
      header: "Name",
      cell: (a) => (
        <span>
          <span className="font-semibold" data-row-primary>
            {a.name}
          </span>
          <span className="block font-mono text-[11px] text-muted-foreground">{a.code}</span>
        </span>
      ),
      sortValue: (a) => a.name,
      searchValue: (a) => `${a.name} ${a.code}`,
      printCell: (a) => `${a.name} (${a.code})`,
    },
    { header: "Account", cell: (a) => kindLabel(a.kind), sortValue: (a) => kindLabel(a.kind), searchValue: (a) => kindLabel(a.kind) },
    { header: "Mobile", cell: (a) => <span className="tabular-nums">{a.phone ?? "—"}</span>, sortValue: (a) => a.phone ?? "", searchValue: (a) => a.phone ?? "" },
    { header: "Active since", cell: (a) => (a.since ? day(a.since) : "—"), sortValue: (a) => a.since ?? "" },
    { header: "Last seen", cell: (a) => (a.lastSeen ? day(a.lastSeen) : "Never"), sortValue: (a) => a.lastSeen ?? "" },
    {
      header: "Per month",
      cell: () => <span className="tabular-nums">{inr(rate)}</span>,
      printCell: () => inr(rate),
      total: (rows) => inr(rows.length * rate),
    },
  ];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Accounts being billed</h2>
        <p className="text-sm text-muted-foreground">
          Every account switched on today, {accounts.length} in all = {inr(accounts.length * rate)} a month before GST. Clients and developers are not
          billed. Tap a card to see only that kind.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KindCard label="All accounts" count={accounts.length} amount={accounts.length * rate} icon={Users} tint="text-foreground bg-muted" active={kind === "all"} onClick={() => setKind("all")} />
        {KINDS.map((k) => (
          <KindCard
            key={k.kind}
            label={k.label}
            count={counts.get(k.kind) ?? 0}
            amount={(counts.get(k.kind) ?? 0) * rate}
            icon={k.icon}
            tint={k.tint}
            active={kind === k.kind}
            onClick={() => setKind(kind === k.kind ? "all" : k.kind)}
          />
        ))}
      </div>
      <DataTable
        title={kind === "all" ? "All billed accounts" : KINDS.find((k) => k.kind === kind)?.label}
        columns={columns}
        data={shown}
        getRowKey={(a) => a.id}
        printTitle="Accounts billed for the NBSS software fee"
        searchPlaceholder="Search anything: name, code, mobile, kind…"
        emptyMessage="No accounts of this kind are switched on."
        initialPageSize={20}
      />
    </section>
  );
}

function KindCard({
  label,
  count,
  amount,
  icon: Icon,
  tint,
  active,
  onClick,
}: {
  label: string;
  count: number;
  amount: number;
  icon: typeof Users;
  tint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "press rounded-2xl border bg-card p-4 text-left shadow-e1 transition-colors",
        active ? "border-primary ring-2 ring-primary/25" : "border-app-line hover:border-primary/40",
      )}
    >
      <span className={cn("grid size-9 place-items-center rounded-xl", tint)}>
        <Icon className="size-4.5" />
      </span>
      <p className="mt-3 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-extrabold tabular-nums">{count}</p>
      <p className="text-xs text-muted-foreground tabular-nums">{inr(amount)} / month</p>
    </button>
  );
}

function Invoice({ inv, s, paying, online, onPay, onPrint, inDialog = true }: { inv: FeeInvoice; s: FeeSettings; paying: boolean; online: boolean; onPay: () => void; onPrint: () => void; inDialog?: boolean }) {
  const paid = inv.status === "paid";
  const skipped = inv.status === "skipped";
  const lines = linesOf(inv);
  const acc = inv.accounts ?? null;
  return (
    <div id="fee-invoice" className="overflow-hidden rounded-2xl">
      {/* The band: who is billing, what this is, and whether it is settled. */}
      <div className="relative bg-gradient-to-br from-[#006b4a] via-[#009164] to-[#14b8a6] px-6 py-6 pr-16 text-white sm:px-8 sm:pr-16">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-white/75 uppercase">Tax invoice</p>
            {inDialog ? (
              <DialogTitle className="mt-1 text-2xl font-extrabold tracking-tight text-white">{s.seller_name}</DialogTitle>
            ) : (
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white">{s.seller_name}</h2>
            )}
            {s.seller_address && <p className="mt-0.5 text-sm text-white/80">{s.seller_address}</p>}
          </div>
          <span
            className={cn(
              "rounded-xl border-2 px-4 py-1.5 text-sm font-extrabold tracking-widest uppercase",
              paid ? "border-white bg-white text-emerald-700" : skipped ? "border-white/60 bg-white/20 text-white" : "border-amber-200 bg-amber-300 text-amber-950",
            )}
          >
            {paid ? "Paid" : skipped ? "Waived" : "Unpaid"}
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
                <th className="px-4 py-2.5 text-right font-semibold">Qty</th>
                <th className="px-4 py-2.5 text-right font-semibold">Rate</th>
                <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr className="border-t border-app-line-soft">
                  <td colSpan={4} className="px-4 py-3 text-muted-foreground">
                    Nothing billed for {month(inv.period)}.
                  </td>
                </tr>
              )}
              {lines.map((l, i) => (
                <tr key={i} className="border-t border-app-line-soft">
                  <td className="px-4 py-3">
                    <p className="font-semibold">
                      {l.label}
                      {l.tag && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">{l.tag}</span>}
                    </p>
                    {isAccountsLine(l) && acc ? (
                      <p className="text-xs text-muted-foreground">
                        {KINDS.filter((k) => acc[k.kind]).map((k) => `${acc[k.kind]} ${k.label.toLowerCase()}`).join(" · ")} · {month(inv.period)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{month(inv.period)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.qty}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{inr(l.rate_paise)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{inr(l.amount_paise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className={cn("rounded-xl px-4 py-3 text-sm font-medium", paid ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")}>
            {paid
              ? `Paid ${inv.paid_at ? day(inv.paid_at) : ""} online${inv.razorpay_payment_id ? ` · ${inv.razorpay_payment_id}` : ""}`
              : skipped
                ? `Waived · ${inv.skip_note ?? "Free month"} · nothing due`
                : `Unpaid · due on ${day(inv.due_on)}${inv.locked_at ? " · amount locked" : " · amount live until the month ends"}`}
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
      <p className="mt-1 text-xs text-muted-foreground">Applies to the month still running (if unpaid) and every month after. Locked and paid months keep their figures.</p>
      <form
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveFeeSettings({ perAccountRupees: Number(rate), gstPercent: Number(gst) });
            if (r.ok) {
              toast.success("Fee updated.");
              router.refresh();
            } else toast.error(r.error ?? "Could not save.");
          });
        }}
      >
        <label className="grid gap-1 text-sm">
          <span className="font-medium">₹ per account / month</span>
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
