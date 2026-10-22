import type { Metadata } from "next";
import { Database, Globe, KeyRound, Server, Smartphone, UsersRound, type LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/console/page-header";
import { Panel } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth";
import type { Tone } from "@/lib/ui/tones";

export const metadata: Metadata = { title: "Guide" };

type Step = { cmd?: string; text: string };
type Section = { title: string; icon: LucideIcon; tone: Tone; intro?: string; steps: Step[] };

/**
 * How to run everything, for whoever keeps NBSS going. Commands run from the
 * repository root unless a step says otherwise. Kept in step with vps.md.
 */
const SECTIONS: Section[] = [
  {
    title: "First time on a computer",
    icon: KeyRound,
    tone: "amber",
    intro: "Node 20.9 or newer and pnpm 10. The .env file lives at the repository root; ask a developer for it.",
    steps: [
      { cmd: "pnpm install", text: "Install everything the website, the app and the scripts need." },
      { cmd: "pnpm env:link", text: "Point the website and the app at the one .env at the root." },
    ],
  },
  {
    title: "Website",
    icon: Globe,
    tone: "emerald",
    steps: [
      { cmd: "pnpm web", text: "Start the website and console at http://localhost:3000." },
      { cmd: "pnpm build && pnpm start", text: "A production build, served the way the VPS serves it." },
      { cmd: "pnpm check", text: "Typecheck and lint everything before you push." },
    ],
  },
  {
    title: "App on phones (Expo Go)",
    icon: Smartphone,
    tone: "sky",
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
    tone: "violet",
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
    tone: "rose",
    intro: "Everyone signs in at /login with their email or employee code and the 6-digit code mailed to them. A PIN or passphrase also works for anyone who has one.",
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
    tone: "slate",
    intro: "Ubuntu with Node 22, pnpm, systemd and Caddy. The full walk-through is in vps.md.",
    steps: [
      { cmd: "git pull && pnpm install --frozen-lockfile", text: "Fetch the update." },
      { cmd: "pnpm db:migrate", text: "Only if the update has a new migration." },
      { cmd: "pnpm build && sudo systemctl restart nbss", text: "Build and restart the site." },
      { cmd: "journalctl -u nbss -f", text: "Follow the live logs." },
    ],
  },
];

export default async function GuidePage() {
  await requireRole("admin");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="How to run NBSS" />
      <div className="grid gap-5 @3xl/main:grid-cols-2">
        {SECTIONS.map((s) => (
          <Panel key={s.title} tone={s.tone} title={s.title} icon={s.icon}>
            {s.intro && <p className="mb-4 text-sm text-muted-foreground">{s.intro}</p>}
            <ol className="space-y-3.5">
              {s.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    {step.cmd && (
                      <code className="mb-1 block overflow-x-auto rounded-lg bg-foreground px-3 py-2 font-mono text-[13px] whitespace-pre text-background">
                        {step.cmd}
                      </code>
                    )}
                    <p className="text-sm leading-relaxed">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        ))}
      </div>
    </div>
  );
}
