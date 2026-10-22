import type { Metadata } from "next";
import { Database, Globe, KeyRound, Server, Smartphone, UsersRound, type LucideIcon } from "lucide-react";

import Link from "next/link";

import { PageHeader } from "@/components/console/page-header";
import { GuideFilms } from "@/components/crm/guide-films";
import { Card, CardTitle, type Hue } from "@/components/crm/ui";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Guide" };

type Step = { cmd?: string; text: string };
type Section = { title: string; icon: LucideIcon; hue: Hue; intro?: string; steps: Step[] };

/**
 * How to run everything, for whoever keeps NBSS going. Commands run from the
 * repository root unless a step says otherwise. Kept in step with vps.md.
 */
const SECTIONS: Section[] = [
  {
    title: "First time on a computer",
    icon: KeyRound,
    hue: "gold",
    intro: "Node 20.9 or newer and pnpm 10. The .env file lives at the repository root; ask a developer for it.",
    steps: [
      { cmd: "pnpm install", text: "Install everything the website, the app and the scripts need." },
      { cmd: "pnpm env:link", text: "Point the website and the app at the one .env at the root." },
    ],
  },
  {
    title: "Website",
    icon: Globe,
    hue: "jade",
    steps: [
      { cmd: "pnpm web", text: "Start the website and console at http://localhost:3000." },
      { cmd: "pnpm build && pnpm start", text: "A production build, served the way the VPS serves it." },
      { cmd: "pnpm check", text: "Typecheck and lint everything before you push." },
    ],
  },
  {
    title: "App on phones (Expo Go)",
    icon: Smartphone,
    hue: "sky",
    intro: "Install Expo Go on each phone. Any number of phones can scan the same code.",
    steps: [
      { cmd: "pnpm app", text: "Start the app and show a QR code. Scan it with Expo Go (Android) or the Camera (iPhone). Phones must be on the same Wi-Fi." },
      { cmd: "pnpm app:tunnel", text: "Same, for phones that are not on your Wi-Fi." },
      { text: "Keep pnpm web running too: the app signs in and talks to Nibo through the website. It finds your computer on the Wi-Fi by itself, as long as the site is on the port in NEXT_PUBLIC_BASE_URL (3000)." },
      { text: "Expo Go cannot run the live map, background location or push alerts. For those, build a development app: cd apps/mobile, then npx expo run:android." },
    ],
  },
  {
    title: "Database",
    icon: Database,
    hue: "plum",
    steps: [
      { cmd: "pnpm db:status", text: "Which migrations in supabase/migrations have run." },
      { cmd: "pnpm db:migrate", text: "Run the ones that have not. Then pnpm db:types to refresh the types." },
      { cmd: "pnpm db:auth", text: "Push the ZeptoMail SMTP settings and the sign-in code email to Supabase (needs supabase login with the account that owns the project)." },
      { cmd: 'pnpm db:sql "select ..."', text: "Run one query against the live database." },
    ],
  },
  {
    title: "Roles and sign-in",
    icon: UsersRound,
    hue: "brick",
    intro: "Everyone signs in at /login with their email or employee code and the 6-digit code mailed to them. A new email becomes a client account on its first code, and lands on the booking form. A PIN or passphrase also works for anyone who has one.",
    steps: [
      { text: "Developer: everything an administrator can do, plus making or removing other developers." },
      { text: "Administrator: everything, including users, sites, settings and View as." },
      { text: "Supervisor: day-to-day operations. Guard: their own duty. Client: their own site." },
      { cmd: "pnpm db:developer you@example.com \"Name\"", text: "Make an email a developer (creates the account if needed). veebodosa@gmail.com is the first." },
    ],
  },
  {
    title: "On the VPS",
    icon: Server,
    hue: "teal",
    intro: "Ubuntu with Node 22, pnpm, systemd and Caddy. The full walk-through is in vps.md.",
    steps: [
      { cmd: "git pull && pnpm install --frozen-lockfile", text: "Fetch the update." },
      { cmd: "pnpm db:migrate", text: "Only if the update has a new migration." },
      { cmd: "pnpm build && sudo systemctl restart nbss", text: "Build and restart the site." },
      { cmd: "journalctl -u nbss -f", text: "Follow the live logs." },
    ],
  },
];

/** How the work flows through NBSS, step by step: the film's story in words, with where to go. */
const FLOW: { title: string; where: string; href?: string; text: string }[] = [
  { title: "A client books", where: "Website → Book guards", text: "They sign in with their email; the first code makes their client account, and the booking form opens straight away." },
  { title: "It lands in Bookings", where: "Bookings", href: "/console/bookings", text: "New requests show first. Open one to call the client, set a quotation and add a note they can read." },
  { title: "Register the site", where: "Sites & geofences", href: "/console/sites", text: "Draw the boundary on the map. A guard can only check in inside it." },
  { title: "Add the people", where: "Users → Add person", href: "/console/users", text: "Guards get an employee code and PIN for the gate; office staff and clients sign in with an emailed code." },
  { title: "Roster the posts", where: "Roster", href: "/console/roster", text: "Post guards to sites and shifts. Whoever has not arrived after the grace window shows on the dashboard." },
  { title: "Guards check in", where: "The app → Duty", text: "At the gate they tap check in. The fence decides whether it counts; anything doubtful goes to review." },
  { title: "Review attendance", where: "Attendance", href: "/console/attendance", text: "Approve or reject flagged punches, with a reason that stays on the record." },
  { title: "SOS", where: "The app → hold SOS", href: "/console/sos", text: "A guard holds the button; supervisors and the client are alerted until someone responds." },
  { title: "The client watches their site", where: "Client console", text: "Who is on the gate right now, and the man-hours and overtime behind the month's invoice." },
  { title: "Ask Nibo", where: "The robot in the corner", text: "Tap him to ask about duty, sites, hours or people. He only reads what you can open, and shows which lookups he used." },
  { title: "Keep watch", where: "Audit log", href: "/console/audit", text: "Every change, sign-in and View as, with who did it." },
];

export default async function GuidePage() {
  await requireRole("admin");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Guide" />
      <div className="grid gap-4 @5xl/main:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <GuideFilms />
        <Card>
          <CardTitle title="How NBSS works" />
          <ol className="grid gap-3">
            {FLOW.map((f, i) => (
              <li key={f.title} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-subtle text-[13px] font-semibold text-primary-ink tabular-nums">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">{f.title}</p>
                  <p className="text-[12px] font-medium text-[var(--hue-gold-deep)]">
                    {f.href ? <Link href={f.href} className="hover:underline">{f.where}</Link> : f.where}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-secondary-fg">{f.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <h2 className="display-section pt-4 text-[clamp(1.5rem,3vw,2rem)]">How to run NBSS</h2>
      <div className="grid gap-4 @3xl/main:grid-cols-2">
        {SECTIONS.map((s) => (
          <Card key={s.title} className="h-auto">
            <CardTitle title={s.title} hint={s.intro} icon={s.icon} hue={s.hue} />
            <ol className="space-y-3.5">
              {s.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold text-secondary-fg tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    {step.cmd && (
                      <code className="mb-1 block overflow-x-auto rounded-xl bg-ink px-3 py-2 font-mono text-[13px] whitespace-pre text-ink-fg">
                        {step.cmd}
                      </code>
                    )}
                    <p className="text-sm leading-relaxed">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        ))}
      </div>
    </div>
  );
}
