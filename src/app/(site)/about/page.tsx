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
import { leadership, mission, site, vision } from "@/content/site";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: canonical("/about"),
  title: "About — a security agency run from Kokrajhar",
  description:
    "The company profile, vision and mission of National Bodo Security Service, and the compliance it operates under.",
};

export default function AboutPage() {
  return (
    <>
      <PageHead
        kicker="◆"
        sub="Company profile"
        crumb="About"
        title="Safety, protection and peace of mind."
        lede="National Bodo Security Service is a trusted and professionally managed security service provider headquartered in Kokrajhar, Bodoland Territorial Council, Assam. Our priority is to ensure safety and protection for our clients through reliable manpower and high-quality service standards."
        image="/img/nbss/parade-night.jpg"
      />

      {/* =========================================================== INTRO */}
      <section className="section">
        <div className="wrap split">
          <div className="split__copy">
            <Eyebrow num="01" text="Who we are" />
            <h2 className="sec-h">A regional agency, run from Kokrajhar.</h2>
            <p className="prose">
              We specialise in providing trained, disciplined and responsible security personnel to
              government departments, corporate offices, educational institutions, hospitals,
              industrial sectors, banks, hotels, residential complexes and commercial
              establishments.
            </p>
            <p className="prose">
              Kokrajhar is the administrative seat of the Bodoland Territorial Council, and it is
              where we recruit, train and run the business from. Our people come from the districts
              they are posted in. They know the roads, the languages and the neighbours — which is
              the difference between a guard watching a gate and a guard who knows who belongs at
              it.
            </p>
            <p className="prose">
              The name carries the region: <strong>Bodo</strong> is the community and the diamond
              in our shield is drawn from the <em>Aronai</em>, the woven scarf a Bodo household
              gives to honour a guest. It is a promise of hospitality and protection — a reasonable
              thing for a security company to put on its badge.
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

      {/* ================================================ VISION & MISSION */}
      <section className="section section--alt">
        <div className="wrap">
          <SectionHead num="02" kicker="What we hold to" title="Our vision and our mission." />
          <div className="creed">
            <article className="creed__item" style={{ "--i": 0 } as React.CSSProperties}>
              <h3 className="creed__t">{vision.title}</h3>
              <p className="creed__p">{vision.body}</p>
            </article>
            <article className="creed__item" style={{ "--i": 1 } as React.CSSProperties}>
              <h3 className="creed__t">{mission.title}</h3>
              <p className="creed__p">{mission.body}</p>
              <ul className="creed__list">
                {mission.points?.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* ========================================================= PILLARS */}
      <section className="section section--pillars">
        <div className="wrap">
          <SectionHead num="03" kicker="Why choose us" title="The parts that take work." />
          <Pillars />
        </div>
      </section>

      {/* ====================================================== MANAGEMENT */}
      <section className="section">
        <div className="wrap">
          <SectionHead
            num="04"
            kicker="Management"
            title="Who runs it."
            aside={
              <Link className="btn btn--ghost" href="/contact">
                Get in touch <Icon name="arrow" />
              </Link>
            }
          />
          <div className="team team--single">
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

      {/* ====================================================== COMPLIANCE */}
      <section className="section section--alt">
        <div className="wrap">
          <SectionHead
            num="05"
            kicker="Legal compliance"
            title="Paperwork you can ask to see."
            lede="Registration and compliance documents are shared with the contract, or earlier on request."
            aside={
              <Link className="btn btn--ghost" href="/contact">
                Request copies <Icon name="arrow" />
              </Link>
            }
          />
          <div className="creds">
            {site.compliance.map((c, i) => (
              <article className="cred" key={c.label} style={{ "--i": i } as React.CSSProperties}>
                <h3 className="cred__t">{c.label}</h3>
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
            <Eyebrow num="06" text="Client support & availability" />
            <h2 className="sec-h">Where we operate.</h2>
            <p className="sec-lede">
              Kokrajhar, Chirang, Baksa, Udalguri, Bongaigaon, Barpeta and other nearby districts.
            </p>
          </div>
          <CoverageList />
        </div>
      </section>

      <CtaBand />
    </>
  );
}
