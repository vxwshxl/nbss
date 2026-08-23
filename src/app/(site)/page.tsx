import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/Icon";
import {
  CoverageList,
  CtaBand,
  Eyebrow,
  Pillars,
  SectionHead,
  ServiceCards,
  Shot,
  StatStrip,
  VideoBand,
} from "@/components/blocks";
import { ownPhotos } from "@/content/gallery";
import { featuredServices, services } from "@/content/services";
import { coverage, site, tel } from "@/content/site";

const HERO_LINES = ["Your Safety,", "Our Responsibility."];

/** Districts, repeated twice so the marquee loops seamlessly at -50%. */
const TICKER = coverage.map((d) => d.name);

export default function HomePage() {
  const peek = ownPhotos().slice(0, 6);

  return (
    <>
      {/* ============================================================ HERO */}
      <section className="hero">
        <div className="hero__bg" aria-hidden="true">
          <Image
            src="/img/nbss/parade-salute.jpg"
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
              <span className="eyebrow__num">NBSS</span>
              <span className="eyebrow__rule" />
              Kokrajhar · Bodoland Territorial Council
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

            <p className="hero__lede" style={{ "--i": 2 } as React.CSSProperties}>
              National Bodo Security Service is a trusted and professionally managed security
              agency headquartered in Kokrajhar. We supply trained, disciplined and responsible
              security personnel to government departments, corporate offices, educational
              institutions, hospitals, banks, industry and commercial establishments.
            </p>

            <div className="hero__cta" style={{ "--i": 3 } as React.CSSProperties}>
              <Link className="btn btn--gold btn--lg" href="/contact#quote">
                Request a quotation
              </Link>
              <Link className="btn btn--ghost btn--lg" href="/services">
                See all {services.length} services <Icon name="arrow" />
              </Link>
            </div>

            <ul className="hero__badges" style={{ "--i": 4 } as React.CSSProperties}>
              <li>Registered under Govt. of Assam</li>
              <li>Police-verified guards</li>
              <li>ESI &amp; EPF as applicable</li>
              <li>24 × 7 supervision</li>
            </ul>
          </div>

          <aside className="hero__card" style={{ "--i": 5 } as React.CSSProperties}>
            <p className="hero__card-k">Deployment desk</p>
            <a className="hero__card-tel" href={`tel:${tel(site.phone)}`}>
              {site.phone}
            </a>
            <dl className="hero__card-list">
              <div>
                <dt>Head office</dt>
                <dd>Kokrajhar, Assam (BTC)</dd>
              </div>
              <div>
                <dt>Districts served</dt>
                <dd>{coverage.length} and nearby</dd>
              </div>
              <div>
                <dt>Supervision</dt>
                <dd>24 × 7</dd>
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

      {/* ======================================================== SERVICES */}
      <section className="section section--alt">
        <div className="wrap">
          <SectionHead
            num="01"
            kicker="What we do"
            title="We provide security personnel. That is the whole business."
            lede="Trained, uniformed and police-verified guards, posted where you need them and supervised after they get there. These are the sites we are asked for most often."
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
            num="02"
            kicker="Why choose us"
            title="Six reasons clients stay with us."
            lede="Any agency can print a uniform. These are the parts that take work — which is exactly why they are the ones worth asking us about."
          />
          <Pillars />
        </div>
      </section>

      {/* =========================================================== VIDEO */}
      <section className="section">
        <div className="wrap split">
          <div className="split__copy">
            <Eyebrow num="03" text="On the ground" />
            <h2 className="sec-h">Parade is where the discipline shows.</h2>
            <p className="prose">
              Turnout, drill and bearing are not ceremony. A guard who stands a parade properly
              stands a gate properly, and the morning inspection is where a supervisor catches the
              uniform, the identity card and the attitude before a client does.
            </p>
            <p className="prose">
              Physical fitness and parade is one of six areas every NBSS guard is trained in before
              a first posting, alongside guarding duties, fire safety, first aid, access control
              and crowd handling.
            </p>
            <Link className="btn btn--ghost" href="/training">
              How we train <Icon name="arrow" />
            </Link>
          </div>

          <VideoBand
            src="/video/nbss-parade.mp4"
            poster="/img/nbss/parade-ranks.jpg"
            caption="NBSS parade, Kokrajhar."
          />
        </div>
      </section>

      {/* ======================================================== COVERAGE */}
      <section className="section section--coverage">
        <div className="wrap coverage">
          <div className="coverage__copy">
            <Eyebrow num="04" text="Where we deploy" />
            <h2 className="sec-h">Kokrajhar outward, as far as we can supervise.</h2>
            <p className="sec-lede">
              We operate across Kokrajhar, Chirang, Baksa, Udalguri, Bongaigaon, Barpeta and other
              nearby districts. If your site is just outside that list, ask — we would rather give
              you a straight answer than take on a posting we cannot check on properly.
            </p>
            <Link className="btn btn--ghost" href="/contact">
              Ask about your district <Icon name="arrow" />
            </Link>
          </div>
          <CoverageList />
        </div>
      </section>

      {/* ========================================================= GALLERY */}
      <section className="section section--alt section--peek">
        <div className="wrap">
          <SectionHead
            num="05"
            kicker="Our people"
            title="Parade, training and duty — our own photographs."
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
