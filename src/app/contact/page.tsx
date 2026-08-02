import type { Metadata } from "next";

import { Icon } from "@/components/Icon";
import { CoverageList, Eyebrow, PageHead, TickList } from "@/components/blocks";
import { EnquiryForm } from "@/components/forms/EnquiryForm";
import { QuoteForm } from "@/components/forms/QuoteForm";
import { faqs, site, tel } from "@/content/site";

export const metadata: Metadata = {
  title: "Contact — Kokrajhar, Bodoland Territorial Region",
  description:
    "Talk to the deployment desk. Survey within 48 hours, guards on site within seven working days.",
};

export default function ContactPage() {
  return (
    <>
      <PageHead
        kicker="24×7"
        sub="Contact"
        crumb="Contact"
        title="Call the desk. Somebody picks up."
        lede="The corporate office keeps office hours. The control room does not — it is staffed every hour of every day, including the ones nobody wants."
      />

      {/* ==================================================== CONTACT CARDS */}
      <section className="section">
        <div className="wrap">
          <div className="contact-cards">
            <article className="ccard" style={{ "--i": 0 } as React.CSSProperties}>
              <span className="ccard__ico"><Icon name="phone" /></span>
              <h2 className="ccard__t">Deployment desk</h2>
              <a className="ccard__big" href={`tel:${tel(site.phone)}`}>{site.phone}</a>
              <a className="ccard__alt" href={`tel:${tel(site.phoneAlt)}`}>{site.phoneAlt}</a>
              <p className="ccard__n">Mon–Sat, 09:30–18:00</p>
            </article>

            <article className="ccard ccard--live" style={{ "--i": 1 } as React.CSSProperties}>
              <span className="ccard__ico"><span className="pulse" aria-hidden="true" /></span>
              <h2 className="ccard__t">Control room — 24 × 7</h2>
              <a className="ccard__big" href={`tel:${tel(site.emergency)}`}>{site.emergency}</a>
              <p className="ccard__n">Never unstaffed, never outsourced, never a phone tree.</p>
            </article>

            <article className="ccard" style={{ "--i": 2 } as React.CSSProperties}>
              <span className="ccard__ico"><Icon name="mail" /></span>
              <h2 className="ccard__t">Email</h2>
              <a className="ccard__big ccard__big--sm" href={`mailto:${site.email}`}>{site.email}</a>
              <a className="ccard__alt" href={`mailto:${site.emailHr}`}>{site.emailHr} — jobs</a>
              <p className="ccard__n">Answered within one working day</p>
            </article>

            <article className="ccard" style={{ "--i": 3 } as React.CSSProperties}>
              <span className="ccard__ico"><Icon name="pin" /></span>
              <h2 className="ccard__t">Registered office</h2>
              <address className="ccard__addr">
                {site.address.line1}<br />
                {site.address.line2}<br />
                {site.address.city} — {site.address.pin}<br />
                {site.address.state}
              </address>
              <a className="ccard__alt" href={site.address.mapUrl} rel="noopener noreferrer" target="_blank">
                Open in maps <Icon name="arrow" />
              </a>
            </article>
          </div>
        </div>
      </section>

      {/* ======================================================= QUOTE FORM */}
      <section className="section section--alt" id="quote">
        <div className="wrap forms">
          <div className="forms__intro">
            <Eyebrow num="01" text="Request a quotation" />
            <h2 className="sec-h">Four details, then a field officer calls.</h2>
            <p className="sec-lede">
              Give us the district, the site type and roughly how many people you have in mind. If
              you are not sure about the headcount, leave it blank — working that out is what the
              survey is for.
            </p>
            <TickList
              items={[
                "Survey within 48 hours inside the BTR districts",
                "Costing with wage, EPF, ESI, bonus and GST shown separately",
                "Guards on site within seven working days of signing",
                "No obligation, and we will say so if you do not need us",
              ]}
            />
          </div>

          <div className="forms__form">
            <QuoteForm />
          </div>
        </div>
      </section>

      {/* ===================================================== GENERAL FORM */}
      <section className="section">
        <div className="wrap forms forms--rev">
          <div className="forms__form">
            <EnquiryForm />
          </div>

          <div className="forms__intro">
            <Eyebrow num="02" text="General enquiry" />
            <h2 className="sec-h">Something else on your mind?</h2>
            <p className="sec-lede">
              Compliance documents, a tender query, a complaint about one of our guards, a request
              for a copy of the PSARA licence — this form reaches the same desk, and a complaint
              reaches it faster.
            </p>
            <ul className="office-hours">
              {site.hours.map((h) => (
                <li key={h}>
                  <Icon name="clock" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ============================================================= FAQ */}
      <section className="section section--alt">
        <div className="wrap narrow">
          <header className="sec-head">
            <Eyebrow num="03" text="Before you ask" />
            <h2 className="sec-h">The eight questions we get first.</h2>
          </header>

          <div className="faqs">
            {faqs.map((f, i) => (
              <details
                className="faq"
                key={f.q}
                open={i === 0}
                style={{ "--i": i } as React.CSSProperties}
              >
                <summary className="faq__q">
                  <span>{f.q}</span>
                  <span className="faq__sign" aria-hidden="true" />
                </summary>
                <div className="faq__a">
                  <p>{f.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================== COVERAGE */}
      <section className="section section--coverage">
        <div className="wrap coverage">
          <div className="coverage__copy">
            <Eyebrow num="04" text="Coverage" />
            <h2 className="sec-h">Eight districts.</h2>
            <p className="sec-lede">
              Five in the Bodoland Territorial Region, three in Lower Assam. Anything further, ask
              — we will give you a straight answer.
            </p>
          </div>
          <CoverageList />
        </div>
      </section>
    </>
  );
}
