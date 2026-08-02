import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/Icon";
import {
  CoverageList,
  CtaBand,
  Eyebrow,
  Pillars,
  Quotes,
  SectionHead,
  ServiceCards,
  Shot,
  StatStrip,
} from "@/components/blocks";
import { photosIn } from "@/content/gallery";
import { divisions, featuredServices, sectors, services } from "@/content/services";
import { site, tel, testimonials } from "@/content/site";

const HERO_LINES = ["Trained in", "Bodoland.", "Trusted across", "the Northeast."];

/** Districts, repeated twice so the marquee loops seamlessly at -50%. */
const TICKER = [
  "Kokrajhar", "Chirang", "Baksa", "Udalguri",
  "Tamulpur", "Bongaigaon", "Dhubri", "Guwahati",
];

export default function HomePage() {
  const peek = photosIn("operations").slice(0, 6);

  return (
    <>
      {/* ============================================================ HERO */}
      <section className="hero">
        <div className="hero__bg" aria-hidden="true">
          <Image
            src="/img/hero-guard.jpg"
            alt=""
            fill
            sizes="100vw"
            priority
            fetchPriority="high"
          />
        </div>
        <div className="hero__veil" aria-hidden="true" />

        <div className="wrap hero__in">
          <div className="hero__copy">
            <p className="eyebrow eyebrow--hero">
              <span className="eyebrow__num">EST {site.founded}</span>
              <span className="eyebrow__rule" />
              Kokrajhar · Bodoland Territorial Region
            </p>

            <h1 className="hero__h">
              {HERO_LINES.map((line, i) => (
                <span
                  key={line}
                  className={`hero__line${i === 1 ? " hero__line--accent" : ""}`}
                  style={{ "--i": i } as React.CSSProperties}
                >
                  {line}
                </span>
              ))}
            </h1>

            <p className="hero__lede" style={{ "--i": 4 } as React.CSSProperties}>
              National Bodo Security Services puts verified, drilled and properly paid people on
              your gate — and backs them with a control room in Kokrajhar that is staffed at three
              in the morning. Guarding, facility management, manpower and electronic security, on
              one contract.
            </p>

            <div className="hero__cta" style={{ "--i": 5 } as React.CSSProperties}>
              <Link className="btn btn--gold btn--lg" href="/contact#quote">
                Request a site survey
              </Link>
              <Link className="btn btn--ghost btn--lg" href="/services">
                See all {services.length} services <Icon name="arrow" />
              </Link>
            </div>

            <ul className="hero__badges" style={{ "--i": 6 } as React.CSSProperties}>
              <li>PSARA licensed</li>
              <li>ISO 9001:2015</li>
              <li>EPF &amp; ESI compliant</li>
              <li>24 × 7 control room</li>
            </ul>
          </div>

          <aside className="hero__card" style={{ "--i": 7 } as React.CSSProperties}>
            <p className="hero__card-k">Deployment desk</p>
            <a className="hero__card-tel" href={`tel:${tel(site.phone)}`}>
              {site.phone}
            </a>
            <dl className="hero__card-list">
              <div>
                <dt>Site survey</dt>
                <dd>Within 48 hours</dd>
              </div>
              <div>
                <dt>Guards on site</dt>
                <dd>7 working days</dd>
              </div>
              <div>
                <dt>Districts covered</dt>
                <dd>8 across Assam</dd>
              </div>
            </dl>
            <Link className="hero__card-go" href="/contact">
              Talk to us <Icon name="arrow" />
            </Link>
          </aside>
        </div>

        <div className="hero__ticker" aria-hidden="true">
          <div className="ticker__track">
            {[0, 1].map((pass) =>
              TICKER.map((name) => (
                <span key={`${pass}-${name}`} style={{ display: "contents" }}>
                  <span>{name}</span>
                  <span className="dot">◆</span>
                </span>
              )),
            )}
          </div>
        </div>
      </section>

      <StatStrip />

      {/* ======================================================= DIVISIONS */}
      <section className="section section--divisions">
        <div className="wrap">
          <SectionHead
            num="01"
            kicker="What we do"
            title="Four divisions, one field officer, one invoice."
            lede="Most clients start with guards and end up handing us the housekeeping, the waste and the cameras — because chasing four vendors for one building is nobody's idea of a job."
          />

          <div className="divisions">
            {divisions.map((d, i) => (
              <Link
                className="division"
                href={`/services?division=${d.slug}`}
                data-accent={d.accent}
                key={d.slug}
                style={{ "--i": i } as React.CSSProperties}
              >
                <div className="division__img">
                  <Image src={d.cover} alt="" fill sizes="(max-width: 700px) 100vw, 25vw" />
                </div>
                <div className="division__body">
                  <span className="division__ico">
                    <Icon name={d.icon} />
                  </span>
                  <p className="division__k">{d.kicker}</p>
                  <h3 className="division__t">{d.name}</h3>
                  <p className="division__p">{d.blurb}</p>
                  <span className="division__go">
                    Explore <Icon name="arrow" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================== FEATURED */}
      <section className="section section--alt">
        <div className="wrap">
          <SectionHead
            num="02"
            kicker="Most asked for"
            title="The postings we fill most weeks."
            aside={
              <Link className="btn btn--ghost" href="/services">
                All {services.length} services <Icon name="arrow" />
              </Link>
            }
          />
          <ServiceCards services={featuredServices()} />
        </div>
      </section>

      {/* ========================================================= PILLARS */}
      <section className="section section--pillars">
        <div className="wrap">
          <SectionHead
            num="03"
            kicker="Why NBSS"
            title="Six things that are hard to copy."
            lede="Any agency can print a uniform. These are the parts that take years and cost money — which is exactly why they are the ones worth asking about."
          />
          <Pillars />
        </div>
      </section>

      {/* ======================================================== COVERAGE */}
      <section className="section section--coverage">
        <div className="wrap coverage">
          <div className="coverage__copy">
            <Eyebrow num="04" text="Where we deploy" />
            <h2 className="sec-h">Five BTR districts, plus three we can actually supervise.</h2>
            <p className="sec-lede">
              We turn work down. A site we cannot reach on a surprise check at 02:00 is a site we
              cannot promise anything about — so the map stops where the supervision does.
            </p>
            <Link className="btn btn--ghost" href="/contact">
              Ask about your district <Icon name="arrow" />
            </Link>
          </div>
          <CoverageList />
        </div>
      </section>

      {/* ========================================================= SECTORS */}
      <section className="section section--alt">
        <div className="wrap">
          <SectionHead
            num="05"
            kicker="Sectors"
            title="A bank branch is not a tea estate."
            aside={
              <Link className="btn btn--ghost" href="/sectors">
                All sectors <Icon name="arrow" />
              </Link>
            }
          />
        </div>

        <div className="rail" tabIndex={0} aria-label="Sectors we serve, scroll horizontally">
          {sectors.map((s, i) => (
            <Link
              className="tile"
              href={`/sectors#${s.slug}`}
              key={s.slug}
              style={{ "--i": i } as React.CSSProperties}
            >
              <Image src={s.image} alt="" fill sizes="320px" loading="lazy" />
              <span className="tile__body">
                <strong>{s.name}</strong>
                <em>{s.blurb}</em>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ==================================================== TESTIMONIALS */}
      <section className="section section--quotes">
        <div className="wrap">
          <SectionHead
            num="06"
            kicker="In their words"
            title="What clients say when the auditor is not in the room."
          />
          <Quotes quotes={testimonials} />
        </div>
      </section>

      {/* ========================================================= GALLERY */}
      <section className="section section--peek">
        <div className="wrap">
          <SectionHead
            num="07"
            kicker="On the ground"
            title="Operations, training and the region we come from."
            aside={
              <Link className="btn btn--ghost" href="/gallery">
                Open the gallery <Icon name="arrow" />
              </Link>
            }
          />
          <div className="peek">
            {peek.map((p, i) => (
              <Shot
                key={p.src}
                photo={{ ...p, tall: false }}
                index={i}
                showCredit={false}
                sizes="(max-width: 700px) 50vw, 16vw"
              />
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
