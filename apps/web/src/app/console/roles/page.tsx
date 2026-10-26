import type { Metadata } from "next";
import { Check, KeyRound } from "lucide-react";

import { fromRoleChoice, ROLE_CHOICE_LABEL, ROLE_CHOICES, roleChoice, type RoleChoice } from "@nbss/shared/identity";

import { pagesFor } from "@/components/console/nav-items";
import { PageHeader } from "@/components/console/page-header";
import { requireRoleSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Roles" };
export const dynamic = "force-dynamic";

/** What each role is for, in a line, and what it may change. */
const ROLE_INFO: Record<RoleChoice, { summary: string; can: string[]; tone: string; chip: string }> = {
  developer: {
    summary: "Builds and runs the software. Sees everything an administrator does, plus Test / Live and View as.",
    can: ["Switch between Test and Live data", "View the console as any person", "Change the software fee rate", "Everything an administrator can do"],
    tone: "from-violet-50 to-fuchsia-50 border-violet-200",
    chip: "bg-violet-600",
  },
  admin: {
    summary: "Runs the agency: every site, guard, roster, report and the bill.",
    can: ["Add and remove guards, supervisors and clients", "Create sites and draw their boundaries", "Approve phones and check-ins", "Pay the software fee", "Read the audit log"],
    tone: "from-emerald-50 to-teal-50 border-emerald-200",
    chip: "bg-emerald-600",
  },
  supervisor: {
    summary: "Runs deployments day to day: who is where, covers, SOS and attendance.",
    can: ["Watch live tracking and route history", "Build the roster and assign replacements", "Answer and close SOS alerts", "Review attendance and reports"],
    tone: "from-sky-50 to-cyan-50 border-sky-200",
    chip: "bg-sky-600",
  },
  guard: {
    summary: "Works the posts, through the app: check in and out, SOS, own duties and hours.",
    can: ["Check in and out at their site", "Raise and answer SOS", "See their own duties, route and attendance", "Ask for cover"],
    tone: "from-amber-50 to-orange-50 border-amber-200",
    chip: "bg-amber-500",
  },
  housekeeping: {
    summary: "Keeps the premises, through the app, exactly as a guard works a post: posted, rostered, checked in and tracked.",
    can: ["Check in and out at their site", "Raise and answer SOS", "See their own duties, route and attendance", "Ask for cover"],
    tone: "from-lime-50 to-green-50 border-lime-200",
    chip: "bg-lime-600",
  },
  client: {
    summary: "Buys the service: their own sites' cover, guards on duty, SOS and bookings.",
    can: ["See who is on duty at their sites", "Get SOS alerts from their sites", "Book guards", "See man-hours for their invoice"],
    tone: "from-rose-50 to-pink-50 border-rose-200",
    chip: "bg-rose-500",
  },
};

/**
 * The roles and what each may open, built from the same menu rules the console uses,
 * so it cannot drift out of date. Developers, administrators and supervisors can read
 * it; the developer role itself is shown to developers only.
 */
export default async function RolesPage() {
  const session = await requireRoleSession("admin", "supervisor");
  const viewer = session.realProfile.role;
  const shown = ROLE_CHOICES.filter((r) => r !== "developer" || viewer === "developer");

  const supabase = await supabaseServer();
  const { data } = await supabase.from("profiles").select("role, trade").eq("active", true);
  const count = (r: RoleChoice) => (data ?? []).filter((p) => roleChoice(p.role, p.trade) === r).length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Roles" />
      <p className="-mt-3 text-sm text-muted-foreground">What each kind of account is for, what it can change, and every page it can open.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {shown.map((r) => {
          const info = ROLE_INFO[r];
          const pages = pagesFor(fromRoleChoice(r).role);
          return (
            <section key={r} className={cn("rounded-2xl border bg-gradient-to-br p-5 shadow-e1", info.tone)}>
              <div className="flex items-center gap-3">
                <span className={cn("grid size-10 place-items-center rounded-2xl text-white shadow-sm", info.chip)}>
                  <KeyRound className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold">{ROLE_CHOICE_LABEL[r]}</h2>
                  <p className="text-xs text-muted-foreground">
                    {count(r)} active {count(r) === 1 ? "account" : "accounts"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm">{info.summary}</p>
              <ul className="mt-3 grid gap-1.5 text-sm">
                {info.can.map((c) => (
                  <li key={c} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" strokeWidth={2.6} />
                    {c}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-xl bg-white/70 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase">Pages on the website</p>
                {r === "guard" || r === "housekeeping" || r === "client" ? (
                  <p className="mt-1 text-xs text-muted-foreground">Mostly the phone app. On the website: {pages.flatMap((g) => g.pages).join(", ")}.</p>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {pages.flatMap((g) => g.pages).map((p) => (
                      <span key={p} className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium">
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
