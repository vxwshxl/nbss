import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/Icon";
import { CtaBand, Eyebrow, PageHead, SectionHead } from "@/components/blocks";
import { totalOpenings, vacancies } from "@/content/gallery";
import { site } from "@/content/site";

const openings = totalOpenings();

export const metadata: Metadata = {
  title: `Careers — ${openings} openings across the Bodoland districts`,
  description:
    "Guards, lady guards, supervisors, field officers, control-room operators, drivers and technicians. Freshers trained and paid from day one.",
};

const PERKS = [
  { icon: "rupee", title: "Paid by the 7th", body: "Wages credited to your bank account by the seventh of every month. Not “around the tenth”. The seventh." },
  { icon: "shield-check", title: "EPF & ESI from day one", body: "Calculated on your declared wage. You get the numbers, the passbook and help using them." },
  { icon: "drill", title: "Paid induction", body: "Twenty-one days of training, paid. Uniform, boots and photo ID issued on completion, at our cost." },
  { icon: "roots", title: "Posted near home", body: "We place you in your own district wherever the deployment allows. Most of our people sleep at home." },
  { icon: "layers", title: "A way up", body: "Guard to supervisor to field officer. Two of our six department heads started on a gate." },
  { icon: "person", title: "Women encouraged", body: "The lady-guard programme has run since 2015. Separate rest and changing facilities are a condition of every posting." },
];

const STEPS = [
  { n: "01", title: "Apply online or walk in", body: "Use the form on any vacancy page, or come to the Kokrajhar office between 09:30 and 18:00, Monday to Saturday." },
  { n: "02", title: "Verification interview", body: "HR shortlists weekly. Bring Aadhaar, address proof and two references with working phone numbers." },
  { n: "03", title: "Induction, then posting", body: "Twenty-one paid days at the training ground, a supervised attachment, then your first independent posting." },
];

export default function CareersPage() {
  return (
    <>
      <PageHead
        kicker={openings}
        sub="Open positions"
        crumb="Careers"
        title="Honest work, trained properly, paid on the seventh."
        lede="We hire from Kokrajhar, Chirang, Baksa, Udalguri and Tamulpur. Freshers are welcome — induction is twenty-one days and it is paid. EPF, ESI and bonus are not optional extras here."
        image="/img/ops-drill.jpg"
      />

      <section className="section">
        <div className="wrap">
          <SectionHead
            num="01"
            kicker="Vacancies"
            title={`${openings} seats open right now.`}
            aside={
              <Link className="btn btn--ghost" href="/training">
                How the training works <Icon name="arrow" />
              </Link>
            }
          />

          <div className="jobs">
            {vacancies.map((v, i) => (
              <article className="job" key={v.id} style={{ "--i": i } as React.CSSProperties}>
                <div className="job__head">
                  <h3 className="job__t">
                    <Link href={`/careers/${v.id}`}>{v.title}</Link>
                  </h3>
                  <span className="job__count">{v.openings} open</span>
                </div>
                <p className="job__p">{v.summary}</p>
                <dl className="job__meta">
                  <div><dt>Location</dt><dd>{v.location}</dd></div>
                  <div><dt>Type</dt><dd>{v.type}</dd></div>
                  <div><dt>Experience</dt><dd>{v.experience}</dd></div>
                  <div><dt>Pay</dt><dd>{v.pay}</dd></div>
                </dl>
                <div className="job__foot">
                  <Link className="btn btn--sm btn--gold" href={`/careers/${v.id}`}>
                    View &amp; apply <Icon name="arrow" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--alt">
        <div className="wrap">
          <SectionHead num="02" kicker="What you get" title="The terms, stated plainly." />
          <div className="perks">
            {PERKS.map((p, i) => (
              <article className="perk" key={p.title} style={{ "--i": i } as React.CSSProperties}>
                <span className="perk__ico">
                  <Icon name={p.icon} />
                </span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap narrow">
          <header className="sec-head">
            <Eyebrow num="03" text="How to apply" />
            <h2 className="sec-h">Three steps, and nobody asks you for money.</h2>
            <p className="sec-lede">
              NBSS never charges a fee for a job, training, a uniform or a “placement”. If anyone
              asks you for money in our name, call {site.phone} and tell us.
            </p>
          </header>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li className="step" key={s.n} style={{ "--i": i } as React.CSSProperties}>
                <span className="step__n">{s.n}</span>
                <h3 className="step__t">{s.title}</h3>
                <p className="step__p">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
