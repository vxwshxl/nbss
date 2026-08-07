import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/Icon";
import { CtaBand, Eyebrow, PageHead, SectionHead } from "@/components/blocks";
import { vacancies } from "@/content/gallery";
import { site } from "@/content/site";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: canonical("/careers"),
  title: "Careers — join NBSS in Kokrajhar and the BTC districts",
  description:
    "Security guards, lady guards, supervisors and field officers. Freshers welcome — training is provided before your first posting.",
};

const PERKS = [
  {
    icon: "drill",
    title: "Training provided",
    body: "Guarding duties, parade and fitness, fire safety, first aid, access control and crowd handling — taught before your first posting.",
  },
  {
    icon: "shield-check",
    title: "ESI & EPF as applicable",
    body: "Statutory benefits are extended to deployed personnel as applicable, and we help you with the paperwork rather than leaving you to it.",
  },
  {
    icon: "person",
    title: "Uniform and identity card",
    body: "Uniform, cap and photo identity card are issued to every guard. You do not turn up to a client site improvising.",
  },
  {
    icon: "roots",
    title: "Posted near home",
    body: "We recruit locally and post locally wherever the deployment allows. Most of our people work in their own district.",
  },
  {
    icon: "layers",
    title: "A way up",
    body: "Guard to supervisor to field officer. Experience on a gate is the qualification that counts most here.",
  },
  {
    icon: "radio",
    title: "Real supervision",
    body: "You are not left alone on a site to work it out. Supervision runs 24 × 7 and there is someone to call.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Apply online or walk in",
    body: "Use the form on any role page, or come to the Kokrajhar office between 09:00 and 18:00, Monday to Saturday.",
  },
  {
    n: "02",
    title: "Interview and verification",
    body: "Bring Aadhaar and address proof. Police verification is completed before deployment — for every guard, without exception.",
  },
  {
    n: "03",
    title: "Training, then posting",
    body: "You are trained in the six areas every NBSS guard covers, then posted to a site with a briefing for that specific gate.",
  },
];

export default function CareersPage() {
  return (
    <>
      <PageHead
        kicker={vacancies.length}
        sub="Open positions"
        crumb="Careers"
        title="Honest work, trained properly, supervised well."
        lede="We hire from Kokrajhar, Chirang, Baksa, Udalguri and the districts around them. Freshers are welcome — training is provided before your first posting."
        image="/img/nbss/parade-salute.jpg"
      />

      <section className="section">
        <div className="wrap">
          <SectionHead
            num="01"
            kicker="Vacancies"
            title="Roles we recruit for."
            lede="Openings vary by district and by season. Call the office to check what is live before you travel."
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
                  <span className="job__count">{v.type}</span>
                </div>
                <p className="job__p">{v.summary}</p>
                <dl className="job__meta">
                  <div><dt>Location</dt><dd>{v.location}</dd></div>
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
              NBSS never charges a fee for a job, for training, for a uniform or for a
              “placement”. If anyone asks you for money in our name, call {site.phone} and tell us.
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
