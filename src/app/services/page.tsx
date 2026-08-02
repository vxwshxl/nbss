import type { Metadata } from "next";
import Link from "next/link";

import { CtaBand, Eyebrow, PageHead, ServiceCards } from "@/components/blocks";
import { divisionBySlug, divisions, services, servicesIn } from "@/content/services";

export const metadata: Metadata = {
  title: "Services — guarding, facility management, manpower and electronic security",
  description: `${services.length} services across four divisions, delivered from Kokrajhar across the Bodoland Territorial Region and Lower Assam.`,
};

const STEPS = [
  {
    n: "01",
    title: "You call or send the form",
    body: "Tell us the site, the shift pattern and roughly how many people you have in mind. A rough answer is fine — that is what the survey is for.",
  },
  {
    n: "02",
    title: "A field officer walks the site",
    body: "Within 48 hours inside the BTR districts. We look at entries, blind spots, lighting, the rest facility and where the register will live.",
  },
  {
    n: "03",
    title: "A costed proposal, built up line by line",
    body: "Wage, EPF, ESI, bonus, leave, uniform, service charge and GST shown separately. If a number looks odd, ask — it will have a reason.",
  },
  {
    n: "04",
    title: "Deployment and a two-week review",
    body: "Guards on site within seven working days of signing, then a review at day fourteen to fix whatever the site survey did not anticipate.",
  },
];

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ division?: string }>;
}) {
  const { division } = await searchParams;
  // An unknown slug falls back to "everything" rather than an empty grid.
  const active = division && divisionBySlug(division) ? division : undefined;
  const shown = servicesIn(active);

  return (
    <>
      <PageHead
        kicker={services.length}
        sub="Service catalogue"
        crumb="Services"
        title="Everything one building needs, from one agency."
        lede="Four divisions, thirty-one line items. Pick the ones you need — most clients start with the gate and add the rest once they have watched us run it for a season."
        image="/img/ops-team.jpg"
      />

      <section className="section">
        <div className="wrap">
          {/*
            Filtering is a plain link to a search param, so each division is a
            real, shareable URL and the back button behaves. Next handles the
            transition client-side, so it still feels instant.
          */}
          <div className="chips" role="tablist" aria-label="Filter services by division">
            <Link
              className={`chip${!active ? " is-on" : ""}`}
              role="tab"
              aria-selected={!active}
              href="/services"
              scroll={false}
            >
              All services <span className="chip__n">{services.length}</span>
            </Link>
            {divisions.map((d) => (
              <Link
                key={d.slug}
                className={`chip${active === d.slug ? " is-on" : ""}`}
                role="tab"
                aria-selected={active === d.slug}
                data-accent={d.accent}
                href={`/services?division=${d.slug}`}
                scroll={false}
              >
                {d.name}
              </Link>
            ))}
          </div>

          <ServiceCards services={shown} />
        </div>
      </section>

      <section className="section section--alt">
        <div className="wrap">
          <header className="sec-head">
            <Eyebrow num="◆" text="How a contract starts" />
            <h2 className="sec-h">Four steps, roughly ten days.</h2>
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
