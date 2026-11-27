import Image from "next/image";
import { BadgeCheck, Check, Clock, Globe, Mail, MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";

import { services } from "@/content/services";
import { BTR_DISTRICTS, site, stats } from "@/content/site";

import { REASONS, ROLES, SERVICE_ICONS, STEPS, TECH, TRAINING } from "./content";
import "./one-pager.css";

/**
 * NBSS on one A4 page, for a client who reads one page and no more: who we are, every
 * service, why us, training, the app, compliance, how to start and every contact.
 * The marketing counterpart of the full brochure below it (as SchoolERP's summary is).
 *
 * Laid out in one-pager.css at a fixed A4 size (794 × 1123 CSS px) from tablet width up,
 * so the screen shows exactly what prints; on a phone the same page reflows to one column.
 * Prints as exactly one page: its own named @page with no margin, and nothing may grow it.
 * When adding a line here, print it (`?print=onepager`) and check it is still one page.
 */
export function OnePager() {
  return (
    <section className="onepager" aria-labelledby="op-title">
      <header className="op-top">
        <Image src="/logo/nbss-256.webp" alt="" width={44} height={44} className="op-logo" priority />
        <span className="op-brand">
          <b>NBSS</b>
          <span>National Bodo Security Service</span>
        </span>
        <span className="op-badge">
          <ShieldCheck aria-hidden />
          <span>
            24 × 7 supervised guards
            <small>Kokrajhar, BTC · serving all Assam</small>
          </span>
        </span>
      </header>

      <div className="op-hero">
        <div>
          <p className="op-eyebrow">Company at a glance</p>
          <h2 id="op-title" className="op-title font-display">
            Trained guards for every site, <em>across Assam.</em>
          </h2>
          <p className="op-lead">
            Police-verified guards for every kind of site, trained before first duty and supervised day and
            night from our own control room in Kokrajhar.
          </p>
          <ul className="op-chips" aria-label="Who we post">
            {ROLES.map((r) => (
              <li key={r.title}>{r.title}</li>
            ))}
          </ul>
        </div>
        <figure className="op-photo">
          <Image
            src="/img/nbss/stadium-night.webp"
            alt="NBSS guards in uniform lined up at a stadium at dusk"
            fill
            sizes="(min-width: 860px) 300px, 100vw"
            className="object-cover object-[50%_60%]"
          />
          <figcaption>
            <ShieldCheck aria-hidden /> {site.tagline}
          </figcaption>
        </figure>
      </div>

      <dl className="op-stats">
        {stats.map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd className="font-display">
              {s.value}
              {s.suffix}
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="op-services">
        <h3 id="op-services" className="op-label">
          Guards for {services.length} kinds of site
        </h3>
        <ul className="op-services">
          {services.map((s) => {
            const Icon = SERVICE_ICONS[s.icon] ?? ShieldCheck;
            return (
              <li key={s.slug}>
                <b>
                  <Icon aria-hidden strokeWidth={2.2} />
                  {s.name}
                </b>
                <span>{s.summary}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="op-two">
        <section aria-labelledby="op-why" className="op-card">
          <h3 id="op-why" className="op-label">
            Why clients choose NBSS
          </h3>
          <ul className="op-checks">
            {REASONS.map((r) => (
              <li key={r.title}>
                <Check aria-hidden strokeWidth={3} />
                {r.title}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="op-training" className="op-card op-dark">
          <h3 id="op-training" className="op-label">
            Training before first duty
          </h3>
          <ol className="op-training">
            {TRAINING.map((m, i) => (
              <li key={m.title}>
                <span>0{i + 1}</span>
                {m.title}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="op-two">
        <section aria-labelledby="op-app" className="op-card">
          <h3 id="op-app" className="op-label">
            Every guard, on our app
          </h3>
          <ul className="op-tech">
            {TECH.map((t) => (
              <li key={t.title}>
                <span className="op-icon">
                  <t.icon aria-hidden strokeWidth={2} />
                </span>
                <span>
                  <b>{t.title}</b>
                  <span>{t.short}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="op-compliance" className="op-card">
          <h3 id="op-compliance" className="op-label">
            Registered &amp; compliant
          </h3>
          <ul className="op-compliance">
            {site.compliance.map((c) => (
              <li key={c.label}>
                <BadgeCheck aria-hidden />
                <b>{c.label}</b>
              </li>
            ))}
          </ul>
          <p className="op-note">Documents shared with the contract on request.</p>
        </section>
      </div>

      <section aria-labelledby="op-start">
        <h3 id="op-start" className="op-label">
          From first call to guards on duty
        </h3>
        <ol className="op-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="op-step-n">{i + 1}</span>
              <b>{s.title}</b>
            </li>
          ))}
        </ol>
      </section>

      <footer className="op-contact">
        <div className="op-contact-lead">
          <p className="font-display">Let&apos;s secure your site.</p>
          <span>Free site visit, written quote. Based in {BTR_DISTRICTS[0]}; postings across Assam.</span>
        </div>
        <ul className="op-contact-list">
          <li>
            <Phone aria-hidden />
            <span className="tabular-nums">{site.phones.join(" · ")}</span>
          </li>
          <li>
            <MessageCircle aria-hidden />
            <span>WhatsApp {site.phones[1]}</span>
          </li>
          <li>
            <Mail aria-hidden />
            <span>{site.email}</span>
          </li>
          <li>
            <Clock aria-hidden />
            <span>Office Mon to Sat, 9 AM to 6 PM · desk 24 × 7</span>
          </li>
          <li>
            <MapPin aria-hidden />
            <span>{site.address.city}, BTC, {site.address.state}</span>
          </li>
          <li className="op-web">
            <Globe aria-hidden />
            <span>nbsskokrajhar.com</span>
          </li>
        </ul>
      </footer>
    </section>
  );
}
