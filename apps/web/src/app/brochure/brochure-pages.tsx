import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  BellRing,
  Check,
  Clock,
  Eye,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Phone,
  ShieldCheck,
  Smartphone,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { Nibo, type NiboMood } from "@/components/nibo/nibo";
import { tel } from "@nbss/shared/company";
import { syllabus } from "@/content/gallery";
import { services } from "@/content/services";
import { ASSAM_DISTRICTS, BTR_DISTRICTS, mission, pillars, site, stats, vision } from "@/content/site";

import { PILLAR_ICONS, ROLES, SERVICE_ICONS, STEPS, TECH } from "./content";
import "./brochure-pages.css";

/**
 * The full brochure as eight A4 pages, each laid out to fill its sheet (after the
 * SchoolERP brochure): a numbered chapter per page, cards down to a closing band,
 * and a footer with the section and page number.
 *
 * Drawn at A4 size (794 × 1123 CSS px) from 860 px wide up, so the screen is the proof
 * of the print; on a phone the pages reflow into one readable column. Every page must
 * stay within its sheet: after changing copy here, print `?print=brochure` and check
 * the page count is still eight (brochure-pages.css says how to measure a page).
 *
 * Copy comes from `@/content` (as on the website) and ./content.ts; the Nibo page
 * quotes the lines he really says (lib/nibo/nudges.ts) and what the assistant really
 * does (lib/ai), nothing more.
 */

const WHATSAPP = site.social.find((s) => s.label === "WhatsApp")?.url ?? "https://wa.me/917577036205";
const SCHOOLERP = "https://schoolerp.okhrang.com";

const CHAPTERS = [
  { n: 1, title: "Why NBSS", page: 3 },
  { n: 2, title: "Our services", page: 4 },
  { n: 3, title: "Our people and their training", page: 5 },
  { n: 4, title: "Supervision you can see", page: 6 },
  { n: 5, title: "Meet Nibo, our assistant", page: 7 },
  { n: 6, title: "Getting started and contacts", page: 8 },
] as const;

/** What Nibo says, word for word from lib/nibo/nudges.ts (counts are examples). */
const NUDGES: { who: string; mood: NiboMood; text: string; action: string }[] = [
  { who: "Control room", mood: "oops", text: "1 SOS alert still open.", action: "Open SOS" },
  { who: "Supervisor", mood: "think", text: "2 rostered guards not checked in yet.", action: "Who?" },
  { who: "Supervisor", mood: "think", text: "3 punches waiting for review today.", action: "Review" },
  { who: "Guard", mood: "wave", text: "Your shift has started. Check in when you reach the gate.", action: "Check in" },
  { who: "Client", mood: "cheer", text: "Your quotation is ready to look at.", action: "See it" },
];

/** Questions the assistant answers from its record lookups (lib/ai/tools.ts). */
const QUESTIONS = [
  "Who is on duty at my site right now?",
  "How many hours did our guards work this month?",
  "Which guards have not checked in yet?",
  "Which punches are waiting for review, and why?",
  "When is my next shift?",
  "Who is covering the roster this week?",
];

const NIBO_TRAITS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: ShieldCheck, title: "Answers from the records", body: "Every figure is looked up and checked against your records before he answers. No guesses." },
  { icon: Eye, title: "Sees only what you may see", body: "A client asks about their own site, a guard about their own shifts and hours." },
  { icon: BellRing, title: "Speaks up when it matters", body: "An open SOS first, then late guards and punches to review, then a tip for the page." },
  { icon: MessagesSquare, title: "Quiet when you are busy", body: "Never while you type. Make him chattier, quieter, quiet for today, or silent." },
];

const PANELS = [
  {
    icon: UserRound,
    title: "Client panel",
    body: "Who is on your gate right now, the man-hours behind this month's invoice, and an assistant that answers questions about your own site.",
  },
  {
    icon: Smartphone,
    title: "Guard panel",
    body: "Check in at the gate, see your hours and overtime, and ask about your own shifts. Sign in with the code on your identity card.",
  },
];

export function BrochurePages() {
  return (
    <div className="bp-stack">
      <Cover />
      <Contents />
      <WhyPage />
      <ServicesPage />
      <PeoplePage />
      <SupervisionPage />
      <NiboPage />
      <ContactPage />
    </div>
  );
}

/* ───────────────────────────── 1. Cover ───────────────────────────── */

function Cover() {
  return (
    <section className="bp-page bp-cover" aria-labelledby="bp-cover-title">
      <header className="bp-top">
        <Image src="/logo/nbss-256.webp" alt="" width={52} height={52} className="bp-logo" priority />
        <span className="bp-brand">
          <b>NBSS</b>
          <span>National Bodo Security Service</span>
        </span>
        <span className="bp-top-right">Company profile</span>
      </header>

      <p className="bp-eyebrow">Security services · Kokrajhar, BTC · All of Assam</p>
      <h1 id="bp-cover-title" className="bp-cover-title font-display">
        Trained guards for every site, <em>across Assam.</em>
      </h1>
      <p className="bp-cover-lead">{site.descriptor}</p>

      <div className="bp-actions">
        <a href={`tel:${tel(site.phone)}`} className="bp-btn bp-btn-solid">
          <Phone aria-hidden /> Call {site.phone}
        </a>
        <a href={WHATSAPP} className="bp-btn">
          <MessageCircle aria-hidden className="text-[#25D366]" /> WhatsApp
        </a>
        <Link href="/contact" className="bp-btn">
          Get a quote <ArrowUpRight aria-hidden />
        </Link>
        <Link href="/" className="bp-btn">
          <Globe aria-hidden /> Website
        </Link>
      </div>

      <figure className="bp-cover-photo">
        <Image
          src="/img/nbss/parade-ranks.webp"
          alt="NBSS guards in uniform standing in formation"
          fill
          priority
          sizes="(min-width: 860px) 720px, 100vw"
          className="object-cover object-[60%_70%]"
        />
        <figcaption>
          <ShieldCheck aria-hidden /> {site.tagline}
        </figcaption>
        <div className="bp-cover-nibo" aria-hidden>
          <span className="bp-bubble">Hi, I&apos;m Nibo. I help run every post.</span>
          <Nibo still mood="wave" uid="bp-cover" className="bp-nibo-svg" />
        </div>
      </figure>

      <dl className="bp-stats">
        {stats.map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd className="font-display">
              {s.value}
              {s.suffix}
            </dd>
            <dd className="bp-stat-note">{s.note}</dd>
          </div>
        ))}
      </dl>

      <div className="bp-cover-band">
        <span>9 sectors · 35 districts · 24 × 7 supervision</span>
        <span>nbsskokrajhar.com</span>
      </div>
    </section>
  );
}

/* ─────────────────────── 2. Contents · who we are ─────────────────────── */

function Contents() {
  const others = ASSAM_DISTRICTS.length;
  return (
    <Page n={2} section="Who we are">
      <p className="bp-eyebrow">Inside this brochure</p>
      <h2 className="bp-h2 font-display">Contents</h2>
      <ol className="bp-contents">
        {CHAPTERS.map((c) => (
          <li key={c.n}>
            <span className="bp-contents-n">{c.n}</span>
            <span className="bp-contents-title">{c.title}</span>
            <span className="bp-contents-dots" aria-hidden />
            <span className="bp-contents-page">{c.page}</span>
          </li>
        ))}
      </ol>

      <h3 className="bp-label">Who we are</h3>
      <p className="bp-lead">
        {site.descriptor} Our guards are recruited from Kokrajhar and the districts around it, trained before their first
        duty, and supervised around the clock from our own control room.
      </p>

      <div className="bp-grid-2 bp-grow">
        <article className="bp-card bp-card-soft bp-vision">
          <h4 className="bp-card-title">{vision.title}</h4>
          <p className="bp-card-body">{vision.body}</p>
          <Photo src="/img/nbss/flag-hoisting.webp" alt="NBSS guards at a flag hoisting" />
        </article>
        <article className="bp-card bp-card-soft">
          <h4 className="bp-card-title">{mission.title}</h4>
          <ul className="bp-ticks">
            {mission.points?.map((p) => (
              <li key={p}>
                <Check aria-hidden strokeWidth={3} />
                {p.replace(/^To /, "").replace(/^./, (c) => c.toUpperCase())}
              </li>
            ))}
          </ul>
        </article>
      </div>

      <h3 className="bp-label">Registered and compliant</h3>
      <div className="bp-compliance">
        {site.compliance.map((c) => (
          <article key={c.label} className="bp-card">
            <BadgeCheck aria-hidden className="bp-compliance-icon" />
            <h4 className="bp-card-title">{c.label}</h4>
            <p className="bp-card-body">{c.note}</p>
          </article>
        ))}
      </div>

      <h3 className="bp-label">Where we post guards</h3>
      <div className="bp-districts">
        <p>
          <b>Home: the Bodoland Territorial Region.</b> Head office, recruiting and the closest supervision.
        </p>
        <ul className="bp-chips bp-chips-strong">
          {BTR_DISTRICTS.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <p>
          <b>And the other {others} districts of Assam.</b>
        </p>
        <ul className="bp-chips">
          {ASSAM_DISTRICTS.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>
    </Page>
  );
}

/* ───────────────────────────── 3. Why NBSS ───────────────────────────── */

function WhyPage() {
  return (
    <Page n={3} section="Why NBSS">
      <ChapterHead n={1} title="Why NBSS" lead="Six things every client gets, on every site we hold." />
      <div className="bp-grid-2 bp-grow">
        {pillars.map((p) => {
          const Icon = PILLAR_ICONS[p.icon] ?? ShieldCheck;
          return (
            <article key={p.index} className="bp-card bp-pillar">
              <span className="bp-pillar-top">
                <span className="bp-icon">
                  <Icon aria-hidden strokeWidth={1.9} />
                </span>
                <span className="bp-pillar-n">{p.index}</span>
              </span>
              <h3 className="bp-card-title">{p.title}</h3>
              <p className="bp-card-body">{p.body}</p>
            </article>
          );
        })}
      </div>
      <div className="bp-photo-row">
        <Photo src="/img/nbss/parade-salute.webp" alt="NBSS guards saluting at evening parade" />
        <Photo src="/img/nbss/hall-gate.webp" alt="NBSS guards at a hall gate" />
        <Photo src="/img/nbss/woman-guard.webp" alt="An NBSS lady security guard on duty" />
      </div>
      <Band title={site.tagline}>
        A gap at shift change is our problem to solve, not yours to chase: we hold backup strength, supervise every shift,
        and set out every rupee of the quotation so you see what the guard receives and what we charge.
      </Band>
    </Page>
  );
}

/* ───────────────────────────── 4. Services ───────────────────────────── */

function ServicesPage() {
  return (
    <Page n={4} section="Our services">
      <ChapterHead
        n={2}
        title={`Guards for ${services.length} kinds of site`}
        lead="Every posting is planned for the premises: the posts, the hours, and the people best suited to them."
      />
      <div className="bp-services bp-grow">
        {services.map((s) => {
          const Icon = SERVICE_ICONS[s.icon] ?? ShieldCheck;
          return (
            <Link key={s.slug} href={`/services/${s.slug}`} className="bp-service">
              <span className="bp-service-photo">
                <Image src={s.image} alt="" fill sizes="(min-width: 860px) 230px, 50vw" className="object-cover" />
                <span className="bp-service-icon">
                  <Icon aria-hidden strokeWidth={2} />
                </span>
              </span>
              <span className="bp-service-text">
                <b>{s.name}</b>
                <span>{s.summary}</span>
                <ul>
                  {s.scope.slice(0, 3).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </span>
            </Link>
          );
        })}
      </div>
    </Page>
  );
}

/* ───────────────────────── 5. People and training ───────────────────────── */

function PeoplePage() {
  return (
    <Page n={5} section="Our people">
      <ChapterHead n={3} title="Our people and their training" lead="Who we post, and what every one of them learns before a first duty." />
      <div className="bp-grid-4">
        {ROLES.map((r, i) => (
          <article key={r.title} className="bp-card bp-role">
            <span className="bp-role-n">0{i + 1}</span>
            <h3 className="bp-card-title">{r.title}</h3>
            <p className="bp-card-body">{r.body}</p>
          </article>
        ))}
      </div>

      <div className="bp-dark bp-grow">
        <p className="bp-dark-label">Training before first duty</p>
        <ol className="bp-training">
          {syllabus.map((m) => (
            <li key={m.code}>
              <span className="bp-training-n">{m.code}</span>
              <span>
                <b>{m.title}</b>
                <span>{m.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="bp-photo-row">
        <Photo src="/img/nbss/training-classroom.webp" alt="NBSS recruits in a training classroom" />
        <Photo src="/img/nbss/training-demo.webp" alt="A training demonstration for NBSS recruits" />
        <Photo src="/img/nbss/field-formation.webp" alt="NBSS recruits in formation on the field" />
      </div>
      <Band title="Nobody stands at a client gate untrained.">
        Training is revisited after posting, and a supervisor checks every post on their round, day and night.
      </Band>
    </Page>
  );
}

/* ─────────────────────── 6. Supervision you can see ─────────────────────── */

function SupervisionPage() {
  return (
    <Page n={6} section="Supervision">
      <ChapterHead
        n={4}
        title="Supervision you can see"
        lead="Our own Android app runs every posting: attendance, tracking and alarms, checked by our control room around the clock."
      />
      <div className="bp-grid-2">
        {TECH.map((t) => (
          <article key={t.title} className="bp-card bp-feature">
            <span className="bp-icon">
              <t.icon aria-hidden strokeWidth={1.9} />
            </span>
            <span>
              <h3 className="bp-card-title">{t.title}</h3>
              <p className="bp-card-body">{t.body}</p>
            </span>
          </article>
        ))}
      </div>

      <h3 className="bp-label">Two doors into the same console</h3>
      <div className="bp-grid-2">
        {PANELS.map((p) => (
          <article key={p.title} className="bp-card bp-card-soft bp-feature">
            <span className="bp-icon bp-icon-solid">
              <p.icon aria-hidden strokeWidth={1.9} />
            </span>
            <span>
              <h4 className="bp-card-title">{p.title}</h4>
              <p className="bp-card-body">{p.body}</p>
            </span>
          </article>
        ))}
      </div>

      <div className="bp-photo-row bp-grow">
        <Photo src="/img/nbss/guards-on-duty.webp" alt="NBSS guards on duty" />
        <Photo src="/img/nbss/batch-officers.webp" alt="NBSS supervisors and field officers" />
        <Photo src="/img/nbss/vest-team.webp" alt="An NBSS team in high-visibility vests" />
      </div>
      <Band title="24 × 7 supervision and deployment desk">
        The office keeps {site.hoursShort}; the supervision and deployment desk never closes. A missing guard is noticed
        by the control room, not by you.
      </Band>
    </Page>
  );
}

/* ───────────────────────────── 7. Meet Nibo ───────────────────────────── */

function NiboPage() {
  return (
    <Page n={7} section="Meet Nibo">
      <ChapterHead n={5} title="Meet Nibo, our assistant" />
      <div className="bp-nibo-hero">
        <div className="bp-nibo-figure" aria-hidden>
          <Nibo still mood="happy" uid="bp-nibo-hero" className="bp-nibo-svg" />
        </div>
        <div>
          <p className="bp-lead">
            Nibo is the little security robot in the corner of the NBSS console and the NBSS app. He gives a tip for
            each page, points out what needs attention right now, and answers questions about your own records in
            plain words. Tap him to chat.
          </p>
          <ul className="bp-nibo-says" aria-label="Things Nibo says">
            {NUDGES.map((n, i) => (
              <li key={n.text}>
                <span className="bp-nibo-head" aria-hidden>
                  <Nibo still head mood={n.mood} uid={`bp-nudge-${i}`} className="size-full" />
                </span>
                <span className="bp-nibo-line">
                  <small>To the {n.who.toLowerCase()}</small>
                  {n.text}
                </span>
                <span className="bp-nibo-act">{n.action}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bp-grid-2">
        {NIBO_TRAITS.map((t) => (
          <article key={t.title} className="bp-card bp-feature">
            <span className="bp-icon">
              <t.icon aria-hidden strokeWidth={1.9} />
            </span>
            <span>
              <h3 className="bp-card-title">{t.title}</h3>
              <p className="bp-card-body">{t.body}</p>
            </span>
          </article>
        ))}
      </div>

      <div className="bp-ask bp-grow">
        <p className="bp-dark-label">Ask him</p>
        <ul>
          {QUESTIONS.map((q) => (
            <li key={q}>
              <MessagesSquare aria-hidden />
              {q}
            </li>
          ))}
        </ul>
      </div>
      <Band title="For every role, on the web and on the phone.">
        Clients, guards, supervisors and the control room each get the Nibo that fits their work, in the console and in
        the NBSS app.
      </Band>
    </Page>
  );
}

/* ─────────────────────── 8. Getting started · contact ─────────────────────── */

function ContactPage() {
  return (
    <Page n={8} section="Getting started">
      <ChapterHead n={6} title="From first call to guards on duty" />
      <ol className="bp-steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="bp-card">
            <span className="bp-step-n">{i + 1}</span>
            <h3 className="bp-card-title">{s.title}</h3>
            <p className="bp-card-body">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="bp-photo-row bp-grow">
        <Photo src="/img/nbss/stadium-ranks.webp" alt="NBSS guards in ranks at a stadium" />
        <Photo src="/img/nbss/woman-guard-2.webp" alt="An NBSS lady security guard" />
        <Photo src="/img/nbss/team-event.webp" alt="An NBSS team on duty at an event" />
      </div>

      <div className="bp-contact">
        <div className="bp-contact-head">
          <div>
            <p className="bp-contact-eyebrow">Talk to us</p>
            <h2 className="bp-contact-title font-display">Let&apos;s secure your site.</h2>
            <p className="bp-contact-sub">A free site visit, then a clear quote in writing. No hidden charges.</p>
          </div>
          <Nibo still mood="cheer" uid="bp-contact" className="bp-contact-nibo" />
        </div>
        <div className="bp-contact-grid">
          <div>
            <p className="bp-contact-k">
              <Phone aria-hidden /> Phone
            </p>
            <ul className="bp-contact-v tabular-nums">
              {site.phones.map((p) => (
                <li key={p}>
                  <a href={`tel:${tel(p)}`}>{p}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="bp-contact-k">
              <Mail aria-hidden /> Email
            </p>
            <p className="bp-contact-v">
              <a href={`mailto:${site.email}`}>{site.email}</a>
            </p>
            <p className="bp-contact-k">
              <MessageCircle aria-hidden /> WhatsApp
            </p>
            <p className="bp-contact-v">
              <a href={WHATSAPP}>{site.phones[1]}</a>
            </p>
          </div>
          <div>
            <p className="bp-contact-k">
              <MapPin aria-hidden /> {site.address.label}
            </p>
            <p className="bp-contact-v">
              {site.address.lines.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </p>
            <p className="bp-contact-k">
              <Clock aria-hidden /> Hours
            </p>
            <p className="bp-contact-v">
              {site.hours.map((h) => (
                <span key={h} className="block">
                  {h}
                </span>
              ))}
            </p>
          </div>
        </div>
        <div className="bp-actions bp-actions-light">
          <a href={WHATSAPP} className="bp-btn bp-btn-white">
            <MessageCircle aria-hidden /> Message on WhatsApp
          </a>
          <Link href="/contact" className="bp-btn bp-btn-ghost">
            Get a quote <ArrowUpRight aria-hidden />
          </Link>
        </div>
        <p className="bp-contact-web">nbsskokrajhar.com</p>
      </div>

      <a href={SCHOOLERP} target="_blank" rel="noopener" className="bp-partner">
        <span className="bp-partner-logo">
          <Image src="/img/partners/schoolerp.webp" alt="" width={96} height={96} />
        </span>
        <span>
          <small>From our technology partner</small>
          <b>Run a school? Meet SchoolERP by Bodo Okhrang.</b>
          <span>
            The NBSS app and website are built by Bodo Okhrang, Kokrajhar. SchoolERP runs admissions, attendance,
            examinations, fees and more for schools. schoolerp.okhrang.com
          </span>
        </span>
      </a>
    </Page>
  );
}

/* ───────────────────────────── Parts ───────────────────────────── */

function Page({ n, section, children }: { n: number; section: string; children: React.ReactNode }) {
  return (
    <section className="bp-page" aria-label={`Brochure page ${n}: ${section}`}>
      {children}
      <footer className="bp-foot">
        <span>
          <b>NBSS</b> · {section}
        </span>
        <span>
          nbsskokrajhar.com · <b>{n}</b>
        </span>
      </footer>
    </section>
  );
}

function ChapterHead({ n, title, lead }: { n: number; title: string; lead?: string }) {
  return (
    <header className="bp-chapter">
      <h2 className="bp-h2 font-display">
        <span className="bp-chapter-n">{n}</span>
        {title}
      </h2>
      {lead && <p className="bp-lead">{lead}</p>}
    </header>
  );
}

function Band({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bp-band">
      <p className="bp-band-title">{title}</p>
      <p>{children}</p>
    </div>
  );
}

function Photo({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="bp-photo">
      <Image src={src} alt={alt} fill sizes="(min-width: 860px) 240px, 50vw" className="object-cover" />
    </span>
  );
}
