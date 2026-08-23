import type { Metadata } from "next";

import { CtaBand, Eyebrow, PageHead, ServiceCards } from "@/components/blocks";
import { services } from "@/content/services";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: canonical("/services"),
  title: "Services — trained security personnel for every kind of site",
  description: `Security guards supplied to ${services.length} kinds of site, from Kokrajhar across the Bodoland Territorial Council and lower Assam.`,
};

const STEPS = [
  {
    n: "01",
    title: "You call or send the form",
    body: "Tell us the site, the shift pattern and roughly how many people you have in mind. A rough answer is fine — that is what the visit is for.",
  },
  {
    n: "02",
    title: "We come and look at the site",
    body: "Entries, blind spots, lighting, the rest facility and where the duty register will live. A number quoted without seeing the site is a guess.",
  },
  {
    n: "03",
    title: "A costed proposal, shown line by line",
    body: "Wage, the applicable statutory heads and the agency service charge set out separately. If a figure looks odd, ask — it will have a reason.",
  },
  {
    n: "04",
    title: "Deployment, then supervision",
    body: "Trained, verified and uniformed guards on site, with supervision running from day one rather than starting when something goes wrong.",
  },
];

export default function ServicesPage() {
  return (
    <>
      <PageHead
        kicker={services.length}
        sub="Our services"
        crumb="Services"
        title="We provide security personnel for these sites."
        lede="One thing, done properly: trained, disciplined and police-verified guards, posted where you need them and supervised after they get there."
        image="/img/nbss/guards-on-duty.jpg"
      />

      <section className="section">
        <div className="wrap">
          <ServiceCards services={services} />
        </div>
      </section>

      <section className="section section--alt">
        <div className="wrap">
          <header className="sec-head">
            <Eyebrow num="◆" text="How a contract starts" />
            <h2 className="sec-h">Four steps, and a visit before any number.</h2>
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
