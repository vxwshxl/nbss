import type { Metadata } from "next";

import { Icon } from "@/components/Icon";
import { CoverageList, Eyebrow, PageHead, TickList } from "@/components/blocks";
import { EnquiryForm } from "@/components/forms/EnquiryForm";
import { QuoteForm } from "@/components/forms/QuoteForm";
import { faqs, site, tel } from "@/content/site";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: canonical("/contact"),
  title: "Contact — Kokrajhar, Bodoland Territorial Council",
  description:
    "Talk to the deployment desk at National Bodo Security Service, Kokrajhar. Call 7002071628 or request a quotation.",
};

/**
 * FAQPage schema, valid here because the same answers are rendered on this
 * page — Google drops the rich result if the markup describes questions the
 * visitor cannot actually see.
 */
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function ContactPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Hand-authored copy from src/content/site.ts — no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <PageHead
        kicker="◆"
        sub="Contact"
        crumb="Contact"
        title="Call the desk. Somebody picks up."
        lede="Tell us about the site — where it is, what it is, and roughly how many guards you have in mind. If you are not sure about the number, say so; working that out is what the visit is for."
      />

      {/* ==================================================== CONTACT CARDS */}
      <section className="section">
        <div className="wrap">
          <div className="contact-cards">
            <article className="ccard ccard--live" style={{ "--i": 0 } as React.CSSProperties}>
              <span className="ccard__ico"><Icon name="phone" /></span>
              <h2 className="ccard__t">Deployment desk</h2>
              <a className="ccard__big" href={`tel:${tel(site.phone)}`}>{site.phone}</a>
              <p className="ccard__n">
                For quotations, site visits, existing contracts and complaints.
              </p>
            </article>

            <article className="ccard" style={{ "--i": 1 } as React.CSSProperties}>
              <span className="ccard__ico"><Icon name="pin" /></span>
              <h2 className="ccard__t">{site.address.label}</h2>
              <address className="ccard__addr">
                {site.address.lines.map((line) => (
                  <span key={line} style={{ display: "block" }}>
                    {line}
                  </span>
                ))}
              </address>
              <a className="ccard__alt" href={site.address.mapUrl} rel="noopener noreferrer" target="_blank">
                Open in maps <Icon name="arrow" />
              </a>
            </article>

            <article className="ccard" style={{ "--i": 2 } as React.CSSProperties}>
              <span className="ccard__ico"><Icon name="clock" /></span>
              <h2 className="ccard__t">Hours</h2>
              <ul className="ccard__hours">
                {site.hours.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
              <p className="ccard__n">
                Or use the forms below — they reach the same desk.
              </p>
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
              site visit is for.
            </p>
            <TickList
              items={[
                "A site visit before any number is quoted",
                "Wage, statutory heads and service charge shown separately",
                "Police-verified, trained and uniformed personnel",
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
              to see our registration papers — this form reaches the same desk, and a complaint
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
            <h2 className="sec-h">Where we operate.</h2>
            <p className="sec-lede">
              Kokrajhar, Chirang, Baksa, Udalguri, Bongaigaon, Barpeta and other nearby districts.
              Anything further, ask — we will give you a straight answer.
            </p>
          </div>
          <CoverageList />
        </div>
      </section>
    </>
  );
}
