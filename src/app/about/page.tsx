import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Icon, Logo } from "@/components/Icon";
import {
  CoverageList,
  CtaBand,
  Eyebrow,
  PageHead,
  Pillars,
  SectionHead,
  StatStrip,
} from "@/components/blocks";
import { leadership, site, timeline } from "@/content/site";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: canonical("/about"),
  title: "About — sixteen years of guarding in the Bodoland Territorial Region",
  description:
    "How National Bodo Security Services recruits, verifies, trains and supervises the people it puts on your gate.",
};

export default function AboutPage() {
  return (
    <>
      <PageHead
        kicker={site.founded}
        sub="About the agency"
        crumb="About"
        title="We recruit from the districts we guard."
        lede="NBSS was registered in Kokrajhar in 2009 with forty-two guards and one vehicle. The idea then is the idea now: hire locally, verify properly, train seriously, pay on time — and be reachable at three in the morning."
        image="/img/gallery/kokrajhar-eve.jpg"
      />

      {/* =========================================================== INTRO */}
      <section className="section">
        <div className="wrap split">
          <div className="split__copy">
            <Eyebrow num="01" text="Who we are" />
            <h2 className="sec-h">A regional agency, deliberately.</h2>
            <p className="prose">
              The Bodoland Territorial Region covers roughly 9,600 square kilometres across
              Kokrajhar, Chirang, Baksa, Udalguri and Tamulpur, with Kokrajhar as its
              administrative seat. It is an agrarian region with limited industry and very few
              employers offering trained, statutory-compliant work.
            </p>
            <p className="prose">
              That is the gap NBSS was built into. A young person from a village outside Gossaigaon
              gets twenty-one days of paid induction, a uniform, an EPF number and a wage that
              arrives by the seventh. A client gets a guard who is from the area, knows who belongs
              at the gate, and has somewhere to go back to — which is why our people stay, and why
              our contracts renew.
            </p>
            <p className="prose">
              The name carries the region: <strong>Bodo</strong> is the community,{" "}
              <strong>Bodoland</strong> is the territory, and the diamond in our shield is drawn
              from the <em>Aronai</em> — the woven scarf a Bodo household gives to honour a guest.
              It is a promise of hospitality and protection. That is a reasonable thing for a
              security company to put on its badge.
            </p>
          </div>

          <figure className="split__fig">
            <div className="split__media">
              <Image
                src="/img/gallery/aronai.jpg"
                alt="An Aronai, the traditional woven Bodo scarf, with its diamond motifs"
                fill
                sizes="(max-width: 880px) 100vw, 40vw"
              />
            </div>
            <figcaption>
              The <em>Aronai</em> — the woven band our mark is drawn from.{" "}
              <span>Wikimedia Commons, CC BY 4.0</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <StatStrip />

      {/* ========================================================= MISSION */}
      <section className="section section--alt">
        <div className="wrap">
          <SectionHead num="02" kicker="What we hold to" title="Two sentences, and we are judged on both." />
          <div className="creed">
            <article className="creed__item" style={{ "--i": 0 } as React.CSSProperties}>
              <h3 className="creed__t">Mission</h3>
              <p className="creed__p">
                To provide the Northeast with security, facility and manpower services that are
                visibly better run than the market expects — by recruiting locally, verifying every
                person, training before deployment and paying statutorily and on time, without
                exception.
              </p>
            </article>
            <article className="creed__item" style={{ "--i": 1 } as React.CSSProperties}>
              <h3 className="creed__t">Vision</h3>
              <p className="creed__p">
                That a job with NBSS is understood across Bodoland as honest, trained, respected
                work — and that a client anywhere in Assam who wants a site run properly has an
                obvious first call to make.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ======================================================== TIMELINE */}
      <section className="section">
        <div className="wrap">
          <SectionHead num="03" kicker="How we got here" title="Sixteen years, in order." />
          <ol className="timeline">
            {timeline.map((m, i) => (
              <li className="tl" key={m.year} style={{ "--i": i } as React.CSSProperties}>
                <span className="tl__y">{m.year}</span>
                <span className="tl__dot" aria-hidden="true" />
                <p className="tl__p">{m.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ========================================================= PILLARS */}
      <section className="section section--pillars">
        <div className="wrap">
          <SectionHead num="04" kicker="How we operate" title="The parts that cost money." />
          <Pillars />
        </div>
      </section>

      {/* ============================================================ TEAM */}
      <section className="section section--alt">
        <div className="wrap">
          <SectionHead num="05" kicker="Managing team" title="Six people who answer their phones." />
          <div className="team">
            {leadership.map((p, i) => (
              <article className="member" key={p.name} style={{ "--i": i } as React.CSSProperties}>
                <span className="member__mono" aria-hidden="true">
                  <Logo />
                </span>
                <h3 className="member__n">{p.name}</h3>
                <p className="member__r">{p.role}</p>
                <p className="member__b">{p.bio}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================== CREDENTIALS */}
      <section className="section">
        <div className="wrap">
          <SectionHead
            num="06"
            kicker="Licences & registrations"
            title="Paperwork you can ask to see."
            aside={
              <Link className="btn btn--ghost" href="/contact">
                Request copies <Icon name="arrow" />
              </Link>
            }
          />
          <div className="creds">
            {site.licenses.map((c, i) => (
              <article className="cred" key={c.label} style={{ "--i": i } as React.CSSProperties}>
                <h3 className="cred__t">{c.label}</h3>
                <p className="cred__n">{c.number}</p>
                <p className="cred__b">{c.body}</p>
                <p className="cred__x">{c.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================== COVERAGE */}
      <section className="section section--coverage">
        <div className="wrap coverage">
          <div className="coverage__copy">
            <Eyebrow num="07" text="Coverage" />
            <h2 className="sec-h">Where a surprise check is possible at 02:00.</h2>
            <p className="sec-lede">
              That is the actual test we apply before taking a site. Everything else is marketing.
            </p>
          </div>
          <CoverageList />
        </div>
      </section>

      <CtaBand />
    </>
  );
}
