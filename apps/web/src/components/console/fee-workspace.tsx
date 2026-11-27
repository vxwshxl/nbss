"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, Building2, FileText, HardHat, Landmark, Loader2, Lock, MapPin, Printer, Settings2, ShieldCheck, Sparkles, UserCog, Users } from "lucide-react";
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
        <DialogContent className="max-h-[96dvh] overflow-y-auto p-0 sm:max-w-[860px]">
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

/**
 * The tax invoice, laid out as a printed corporate invoice: the title and number with
 * the seller's mark, who it is billed to beside the total due, the lines in a ruled
 * table, then payment and the totals in an emerald block, and the seller's
 * registrations at the foot. Sized to sit on one screen without scrolling (it only
 * scrolls on a very short window), and printed as one A4 page.
 */
function Invoice({ inv, s, paying, online, onPay, onPrint, inDialog = true }: { inv: FeeInvoice; s: FeeSettings; paying: boolean; online: boolean; onPay: () => void; onPrint: () => void; inDialog?: boolean }) {
  const paid = inv.status === "paid";
  const skipped = inv.status === "skipped";
  const lines = linesOf(inv);
  const acc = inv.accounts ?? null;
  const Title = inDialog ? DialogTitle : "h2";

  return (
    <div id="fee-invoice" className="bg-white text-[13px] leading-snug text-slate-800">
      <div className="h-1.5 bg-gradient-to-r from-[#006b4a] via-[#009164] to-[#14b8a6]" />
      <div className="fee-body space-y-5 px-4 pt-5 pb-5 sm:px-9">
        {/* Title and number; the seller's mark on the right, or above it on a phone. */}
        <div className={cn("flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6", inDialog && "pr-8")}>
          <div className="min-w-0">
            <Title className="text-[28px] leading-none font-black tracking-[0.18em] text-slate-900">INVOICE</Title>
            <div className="mt-2 h-0.5 w-full bg-slate-900" />
            <p className="mt-1.5 font-mono text-[11px] tracking-[0.12em] text-slate-500 sm:tracking-[0.22em]">NO: {inv.number}</p>
          </div>
          <div className="flex min-w-0 items-center gap-3 sm:text-right">
            <div className="min-w-0 sm:order-first">
              <p className="text-[15px] font-extrabold tracking-tight text-slate-900">{s.seller_name}</p>
              <p className="text-[11px] tracking-wide text-slate-500">{s.seller_address ?? "Kokrajhar, Assam"}</p>
            </div>
            {/* The seller's own mark, from bodookhrang.com. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- printed as-is; a plain image prints reliably */}
            <img src="/img/bodookhrang-logo.png" alt="Bodo Okhrang Tech Pvt. Ltd." className="order-first h-12 w-auto shrink-0 sm:order-none sm:h-14" />
          </div>
        </div>

        {/* Billed to, the invoice's particulars, and what is due. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.1fr_1fr_auto] sm:gap-6">
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Invoice to</p>
            <p className="mt-0.5 font-bold text-[#009164]">{s.buyer_name}</p>
            <p className="mt-1 text-[12px] text-slate-600">Kokrajhar, Assam</p>
            {s.buyer_gstin && <p className="text-[12px] text-slate-600">GSTIN: {s.buyer_gstin}</p>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
            <dt className="font-semibold text-slate-500">Period</dt>
            <dd>{month(inv.period)}</dd>
            <dt className="font-semibold text-slate-500">{paid ? "Paid on" : "Due on"}</dt>
            <dd>{paid && inv.paid_at ? day(inv.paid_at) : day(inv.due_on)}</dd>
            <dt className="font-semibold text-slate-500">Status</dt>
            <dd>
              <span
                className={cn(
                  "rounded px-1.5 py-px text-[10px] font-bold tracking-wider uppercase",
                  paid ? "bg-emerald-100 text-emerald-700" : skipped ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-800",
                )}
              >
                {paid ? "Paid" : skipped ? "Waived" : "Unpaid"}
              </span>
              {!paid && !skipped && <span className="ml-1.5 text-[11px] text-slate-500">{inv.locked_at ? "amount locked" : "live until month end"}</span>}
            </dd>
          </dl>
          <div className="sm:text-right">
            <p className="text-[11px] font-semibold text-slate-500">{paid ? "Total paid" : "Total due"}</p>
            <p className="mt-0.5 border-b-2 border-slate-900 pb-0.5 text-[22px] font-black tracking-tight text-slate-900 tabular-nums">INR {inr(inv.total_paise).slice(1)}</p>
          </div>
        </div>

        {/* The lines. */}
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y-2 border-slate-800 text-[11px] font-bold text-slate-700">
              <th className="hidden w-12 bg-slate-50 py-2 pl-3 text-left sm:table-cell">No.</th>
              <th className="bg-slate-50 py-2 pr-2 pl-2 text-left sm:pr-3 sm:pl-0">
                Item<span className="hidden sm:inline"> description</span>
              </th>
              <th className="border-l border-slate-200 py-2 pr-2 pl-2 text-right sm:w-28">Rate</th>
              <th className="px-1 py-2 text-center sm:w-20">Qty</th>
              <th className="py-2 pr-2 text-right sm:w-32 sm:pr-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr className="border-b border-slate-200">
                <td colSpan={5} className="py-3 pl-3 text-slate-500">
                  Nothing billed for {month(inv.period)}.
                </td>
              </tr>
            )}
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-slate-200 align-top">
                <td className="hidden bg-slate-50 py-2.5 pl-3 text-slate-500 tabular-nums sm:table-cell">{String(i + 1).padStart(2, "0")}.</td>
                <td className="bg-slate-50 py-2.5 pr-2 pl-2 sm:pr-3 sm:pl-0">
                  <p className="font-bold text-slate-900">
                    {l.label}
                    {l.tag && <span className="ml-2 inline-block rounded whitespace-nowrap bg-emerald-100 px-1.5 py-px text-[9px] font-bold tracking-wider text-emerald-700 uppercase">{l.tag}</span>}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {isAccountsLine(l) && acc
                      ? KINDS.filter((k) => acc[k.kind]).map((k) => `${acc[k.kind]} ${k.label.toLowerCase()}`).join(" · ")
                      : month(inv.period)}
                  </p>
                </td>
                <td className="border-l border-slate-200 py-2.5 pr-2 pl-2 text-right whitespace-nowrap tabular-nums">{inr(l.rate_paise)}</td>
                <td className="px-1 py-2.5 text-center tabular-nums">{l.qty}</td>
                <td className="py-2.5 pr-2 text-right font-semibold whitespace-nowrap tabular-nums sm:pr-3">{inr(l.amount_paise)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Payment on the left, the totals in the emerald block on the right. */}
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-2.5 text-[12px]">
            <div>
              <p className="font-bold text-slate-900">Payment</p>
              <p className="text-slate-600">
                {paid
                  ? `Paid online${inv.paid_at ? ` on ${day(inv.paid_at)}` : ""}${inv.razorpay_payment_id ? ` · ${inv.razorpay_payment_id}` : ""}`
                  : skipped
                    ? `Waived · ${inv.skip_note ?? "free month"} · nothing due`
                    : "Online through Razorpay (UPI, cards, net banking), from this page."}
              </p>
            </div>
            <div>
              <p className="font-bold text-slate-900">Terms</p>
              <p className="text-slate-600">
                Due on the {s.due_day}th of the month. A month&apos;s amount is locked when it ends or is paid. GST is charged at {Number(inv.gst_percent)}%.
              </p>
            </div>
          </div>
          <dl className="w-full overflow-hidden rounded-lg bg-[#009164] text-[12px] text-white sm:w-64">
            <div className="flex justify-between border-b border-white/25 px-4 py-2">
              <dt>Sub-total</dt>
              <dd className="tabular-nums">{inr(inv.amount_paise)}</dd>
            </div>
            <div className="flex justify-between border-b border-white/25 px-4 py-2">
              <dt>GST ({Number(inv.gst_percent)}%)</dt>
              <dd className="tabular-nums">{inr(inv.gst_paise)}</dd>
            </div>
            <div className="flex justify-between bg-[#006b4a] px-4 py-2.5 text-[14px] font-extrabold">
              <dt>Grand total</dt>
              <dd className="tabular-nums">{inr(inv.total_paise)}</dd>
            </div>
          </dl>
        </div>

        {/* The seller's registrations, as the reference's company information row. */}
        <div className="fee-foot">
          <p className="border-b border-slate-200 pb-1.5 text-[12px] font-bold tracking-wide text-[#009164]">Company information</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-slate-600">
            {s.seller_gstin && (
              <p className="flex items-center gap-1.5 whitespace-nowrap">
                <Landmark className="size-4 shrink-0 text-slate-400" /> GSTIN <span className="font-mono font-semibold text-slate-800">{s.seller_gstin}</span>
              </p>
            )}
            {s.seller_cin && (
              <p className="flex items-center gap-1.5 whitespace-nowrap">
                <Building2 className="size-4 shrink-0 text-slate-400" /> CIN <span className="font-mono font-semibold text-slate-800">{s.seller_cin}</span>
              </p>
            )}
            <p className="flex items-center gap-1.5 whitespace-nowrap">
              <MapPin className="size-4 shrink-0 text-slate-400" /> {s.seller_address ?? "Kokrajhar, Assam"}
            </p>
          </div>
        </div>

        {/* Signed by the managing director, on the right. */}
        <div className="flex justify-end">
          <div className="w-52 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- printed as-is; a plain image prints reliably */}
            <img src="/img/signature-kamal-bodosa.png?v=3" alt="Signature of Dr. Kamal Bodosa" className="mx-auto h-14 w-auto" />
            <div className="mt-1 border-t border-slate-300 pt-1.5">
              <p className="text-[13px] font-bold text-slate-900">Dr. Kamal Bodosa</p>
              <p className="text-[11px] text-slate-600">Managing Director</p>
              <p className="text-[11px] font-semibold tracking-wide text-slate-800">BODOOKHRANG TECH PVT. LTD.</p>
            </div>
          </div>
        </div>

        <p className="text-center text-[14px] font-semibold text-[#009164]">Thank you for using our service. We appreciate the opportunity to work with you.</p>

        <p className="border-t border-slate-200 pt-3 text-center text-[11px] text-slate-400">This is a system generated invoice.</p>

        <div className="flex justify-end print:hidden">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onPrint}>
              <Printer data-icon="inline-start" /> Print
            </Button>
            {!paid && !skipped && online && inv.total_paise >= 100 && (
              <Button size="sm" onClick={onPay} disabled={paying}>
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
