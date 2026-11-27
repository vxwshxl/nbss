import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Clock,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Phone,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";

import { Nibo, type NiboMood } from "@/components/nibo/nibo";
import { tel } from "@nbss/shared/company";
import { services } from "@/content/services";
import { BTR_DISTRICTS, mission, site, vision } from "@/content/site";

import { PILLAR_ICONS, REASONS, ROLES, SERVICE_ICONS, STEPS, TECH, TRAINING } from "./content";
import "./brochure-pages.css";

/**
 * The full brochure as eight A4 pages. One idea per page: a short, direct headline,
 * one line per card, and large photographs of NBSS's own guards. A reader who only
 * looks at the headlines and the pictures should still come away with the offer.
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

/** The four figures on the cover, all from the company profile. */
const FIGURES = [
  { value: "24×7", label: "Supervision" },
  { value: "100%", label: "Police verified" },
  { value: "9", label: "Sectors served" },
  { value: "35", label: "Districts of Assam" },
];

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
  "When is my next shift?",
];

const PANELS = [
  { icon: UserRound, title: "For clients", body: "Who is on your gate now, and the hours behind every invoice." },
  { icon: Smartphone, title: "For guards", body: "Check in at the gate and see your own shifts and hours." },
];

export function BrochurePages() {
  return (
    <div className="bp-stack">
      <Cover />
      <WhoPage />
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
      <figure className="bp-cover-hero">
        <Image
          src="/img/nbss/stadium-night.webp"
          alt="NBSS guards in uniform lined up at a stadium at dusk"
          fill
          priority
          sizes="(min-width: 860px) 794px, 100vw"
          className="object-cover object-[50%_60%]"
        />
        <div className="bp-cover-shade" />
        <header className="bp-top">
          <Image src="/logo/nbss-256.webp" alt="" width={52} height={52} className="bp-logo" priority />
          <span className="bp-brand">
            <b>NBSS</b>
            <span>National Bodo Security Service</span>
          </span>
          <span className="bp-top-right">Company profile</span>
        </header>
        <div className="bp-cover-copy">
          <p className="bp-cover-eyebrow">Security services · Kokrajhar · All of Assam</p>
          <h1 id="bp-cover-title" className="bp-cover-title font-display">
            Trained guards for every site, <em>across Assam.</em>
          </h1>
          <p className="bp-cover-lead">Police-verified. Supervised day and night. Tracked on our own app.</p>
        </div>
      </figure>

      <div className="bp-cover-body">
        <dl className="bp-figures">
          {FIGURES.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd className="font-display">{f.value}</dd>
            </div>
          ))}
        </dl>

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

        <div className="bp-cover-band">
          <span className="tabular-nums">
            <Phone aria-hidden /> {site.phone}
          </span>
          <span>
            <Globe aria-hidden /> nbsskokrajhar.com
          </span>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── 2. Who we are ───────────────────────────── */

function WhoPage() {
  return (
    <Page n={2} section="Who we are">
      <ChapterHead
        eyebrow="Who we are"
        title="Kokrajhar's own security agency."
        lead="We recruit locally, train every guard before first duty, and supervise every shift from our own control room."
      />
      <Photo src="/img/nbss/hall-gate.webp" alt="Three NBSS guards on duty at a hall entrance" className="bp-grow" position="50% 62%" />

      <div className="bp-grid-2">
        <blockquote className="bp-quote">
          <p className="bp-quote-k">{vision.title}</p>
          <p className="bp-quote-text font-display">
            To be the most reliable security service in Assam and the North-East.
          </p>
        </blockquote>
        <article className="bp-card bp-card-soft">
          <p className="bp-quote-k">{mission.title}</p>
          <ul className="bp-ticks">
            {["Highly trained guards", "Discipline and punctuality", "Service we keep improving", "Relationships built on trust"].map(
              (p) => (
                <li key={p}>
                  <Check aria-hidden strokeWidth={3} />
                  {p}
                </li>
              ),
            )}
          </ul>
        </article>
      </div>

      <div className="bp-facts">
        <div>
          <h3 className="bp-label">Registered and compliant</h3>
          <ul className="bp-pills">
            {site.compliance.map((c) => (
              <li key={c.label}>
                <Check aria-hidden strokeWidth={3} />
                {c.label.replace("Registered under Government of Assam", "Govt. of Assam registered")}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="bp-label">Where we work</h3>
          <ul className="bp-pills bp-pills-strong">
            {BTR_DISTRICTS.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <p className="bp-small">Home in the Bodoland Territorial Region. Postings across all of Assam.</p>
        </div>
      </div>
    </Page>
  );
}

/* ───────────────────────────── 3. Why NBSS ───────────────────────────── */

function WhyPage() {
  return (
    <Page n={3} section="Why NBSS">
      <ChapterHead eyebrow="Why NBSS" title="Six reasons clients stay with us." />
      <Photo src="/img/nbss/stadium-ranks.webp" alt="NBSS guards in ranks at a stadium" className="bp-grow" position="50% 55%" />
      <div className="bp-grid-3">
        {REASONS.map((r) => {
          const Icon = PILLAR_ICONS[r.icon] ?? ShieldCheck;
          return (
            <article key={r.title} className="bp-card bp-reason">
              <span className="bp-icon">
                <Icon aria-hidden strokeWidth={1.9} />
              </span>
              <h3 className="bp-card-title">{r.title}</h3>
              <p className="bp-card-body">{r.body}</p>
            </article>
          );
        })}
      </div>
      <Band title={site.tagline}>A gap at your gate is our problem to solve, not yours.</Band>
    </Page>
  );
}

/* ───────────────────────────── 4. Services ───────────────────────────── */

function ServicesPage() {
  return (
    <Page n={4} section="Our services">
      <ChapterHead eyebrow="Our services" title="Guards for every kind of site." />
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
              </span>
            </Link>
          );
        })}
      </div>
      <Band title="Your site is not listed?">Tell us about it. We plan a posting for any premises.</Band>
    </Page>
  );
}

/* ───────────────────────── 5. People and training ───────────────────────── */

function PeoplePage() {
  const portraits = [
    { src: "/img/nbss/guard-portrait.webp", alt: "An NBSS security guard in uniform", role: ROLES[0]! },
    { src: "/img/nbss/woman-guard.webp", alt: "An NBSS lady security guard in uniform", role: ROLES[1]! },
  ];
  return (
    <Page n={5} section="Our people">
      <ChapterHead eyebrow="Our people" title="The people at your gate." />
      <div className="bp-portraits bp-grow">
        {portraits.map((p) => (
          <figure key={p.src} className="bp-portrait">
            <Image src={p.src} alt={p.alt} fill sizes="(min-width: 860px) 350px, 50vw" className="object-cover object-[50%_25%]" />
            <figcaption>
              <b>{p.role.title}</b>
              <span>{p.role.body}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="bp-grid-2">
        {ROLES.slice(2).map((r) => (
          <article key={r.title} className="bp-card bp-feature">
            <span className="bp-icon bp-icon-solid">
              <ShieldCheck aria-hidden strokeWidth={1.9} />
            </span>
            <span>
              <h3 className="bp-card-title">{r.title}</h3>
              <p className="bp-card-body">{r.body}</p>
            </span>
          </article>
        ))}
      </div>
      <div className="bp-dark">
        <p className="bp-dark-label">Trained before first duty</p>
        <ol className="bp-training">
          {TRAINING.map((m, i) => (
            <li key={m.title}>
              <span className="bp-training-n">0{i + 1}</span>
              <span>
                <b>{m.title}</b>
                <span>{m.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Page>
  );
}

/* ─────────────────────── 6. Supervision you can see ─────────────────────── */

function SupervisionPage() {
  return (
    <Page n={6} section="Supervision">
      <ChapterHead
        eyebrow="Supervision"
        title="You can see every guard."
        lead="Every posting runs on our own Android app, watched by our control room day and night."
      />
      <Photo src="/img/nbss/vest-team.webp" alt="NBSS guards in high-visibility vests on duty" className="bp-grow" position="50% 55%" />
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
      <div className="bp-grid-2">
        {PANELS.map((p) => (
          <article key={p.title} className="bp-card bp-card-soft bp-feature">
            <span className="bp-icon bp-icon-solid">
              <p.icon aria-hidden strokeWidth={1.9} />
            </span>
            <span>
              <h3 className="bp-card-title">{p.title}</h3>
              <p className="bp-card-body">{p.body}</p>
            </span>
          </article>
        ))}
      </div>
      <Band title="Our desk never closes.">A missing guard is noticed by our control room, not by you.</Band>
    </Page>
  );
}

/* ───────────────────────────── 7. Meet Nibo ───────────────────────────── */

function NiboPage() {
  return (
    <Page n={7} section="Meet Nibo">
      <ChapterHead
        eyebrow="Meet Nibo"
        title="Your assistant in the NBSS app."
        lead="Nibo points out what needs attention and answers questions about your own site, in plain words."
      />
      <div className="bp-nibo-hero bp-grow">
        <div className="bp-nibo-figure" aria-hidden>
          <Nibo still mood="happy" uid="bp-nibo-hero" className="bp-nibo-svg" />
        </div>
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
      <div className="bp-ask">
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
      <Band title="Answers from your records, never guesses.">Each person sees only their own site, shifts and hours.</Band>
    </Page>
  );
}

/* ─────────────────────── 8. Getting started · contact ─────────────────────── */

function ContactPage() {
  return (
    <Page n={8} section="Getting started">
      <ChapterHead eyebrow="Getting started" title="Guards on duty in four steps." />
      <ol className="bp-steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="bp-card">
            <span className="bp-step-n">{i + 1}</span>
            <h3 className="bp-card-title">{s.title}</h3>
            <p className="bp-card-body">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="bp-contact bp-grow">
        <div className="bp-contact-head">
          <div>
            <p className="bp-contact-eyebrow">Talk to us</p>
            <h2 className="bp-contact-title font-display">Let&apos;s secure your site.</h2>
            <p className="bp-contact-sub">Free site visit. Written quote. No hidden charges.</p>
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
              <MapPin aria-hidden /> Office
            </p>
            <p className="bp-contact-v">
              {site.address.city}, BTC, {site.address.state}
            </p>
            <p className="bp-contact-k">
              <Clock aria-hidden /> Hours
            </p>
            <p className="bp-contact-v">
              Mon to Sat, 9 AM to 6 PM
              <span className="block text-[12px] font-semibold text-[#d1fae5]">Supervision desk 24 × 7</span>
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
          <Link href="/" className="bp-btn bp-btn-ghost">
            <Globe aria-hidden /> Visit website
          </Link>
        </div>
        <p className="bp-contact-web">nbsskokrajhar.com</p>
      </div>

      <div className="bp-partner-row">
        <div className="bp-partner-copy">
          <small>From our technology partner</small>
          <b className="font-display">Run a school? Meet SchoolERP.</b>
          <span>The NBSS app and website are built by Bodo Okhrang, Kokrajhar.</span>
        </div>
        {/* The card exactly as on bodookhrang.com's hero: the product's own banner, then its icon, name and host. */}
        <a href={SCHOOLERP} target="_blank" rel="noopener" className="bp-erp-card">
          <span className="bp-erp-banner">
            <Image
              src="/img/partners/schoolerp-banner-light.webp"
              alt="SchoolERP by Bodo Okhrang: everything your school runs on, in one place"
              fill
              sizes="(min-width: 860px) 380px, 100vw"
              className="object-cover"
            />
          </span>
          <span className="bp-erp-meta">
            <span className="bp-erp-icon">
              <Image src="/img/partners/schoolerp.webp" alt="" width={96} height={96} loading="eager" />
            </span>
            <span className="bp-erp-name">
              <b>SchoolERP by Bodo Okhrang</b>
              <span>schoolerp.okhrang.com</span>
            </span>
            <span className="bp-erp-go" aria-hidden>
              <ArrowUpRight />
            </span>
          </span>
        </a>
      </div>
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

function ChapterHead({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <header className="bp-chapter">
      <p className="bp-eyebrow">{eyebrow}</p>
      <h2 className="bp-h2 font-display">{title}</h2>
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

function Photo({ src, alt, className, position = "50% 50%" }: { src: string; alt: string; className?: string; position?: string }) {
  return (
    <span className={`bp-photo ${className ?? ""}`}>
      <Image src={src} alt={alt} fill sizes="(min-width: 860px) 720px, 100vw" className="object-cover" style={{ objectPosition: position }} />
    </span>
  );
}
