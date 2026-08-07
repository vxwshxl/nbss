import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

import { AronaiBand, Icon } from "@/components/Icon";
import { Counter } from "@/components/Counter";
import {
  coverage as allDistricts,
  pillars as allPillars,
  site,
  stats as allStats,
  tel,
  type District,
  type Pillar,
  type Stat,
} from "@/content/site";
import type { Photo } from "@/content/gallery";
import type { Service } from "@/content/services";

/** Numbered mono label above every section heading. */
export function Eyebrow({ num, text }: { num: ReactNode; text: string }) {
  return (
    <p className="eyebrow">
      <span className="eyebrow__num">{num}</span>
      <span className="eyebrow__rule" />
      {text}
    </p>
  );
}

export function SectionHead({
  num,
  kicker,
  title,
  lede,
  aside,
}: {
  num: ReactNode;
  kicker: string;
  title: string;
  lede?: string;
  /** Renders to the right on a split header — usually a link. */
  aside?: ReactNode;
}) {
  if (aside) {
    return (
      <header className="sec-head sec-head--split">
        <div>
          <Eyebrow num={num} text={kicker} />
          <h2 className="sec-h">{title}</h2>
          {lede && <p className="sec-lede">{lede}</p>}
        </div>
        {aside}
      </header>
    );
  }
  return (
    <header className="sec-head">
      <Eyebrow num={num} text={kicker} />
      <h2 className="sec-h">{title}</h2>
      {lede && <p className="sec-lede">{lede}</p>}
    </header>
  );
}

/** Masthead for every page except the homepage. */
export function PageHead({
  kicker,
  sub,
  title,
  lede,
  image,
  crumb,
  crumbs,
  actions,
  accent,
}: {
  kicker: ReactNode;
  sub: string;
  title: string;
  lede?: string;
  image?: string;
  crumb?: string;
  crumbs?: { href: string; label: string }[];
  actions?: ReactNode;
  accent?: string;
}) {
  return (
    <section
      className={`phead${image ? " phead--img" : ""}`}
      data-accent={accent}
    >
      {image && (
        <>
          <div className="phead__bg" aria-hidden="true">
            <Image src={image} alt="" fill sizes="100vw" priority />
          </div>
          <div className="phead__veil" aria-hidden="true" />
        </>
      )}

      <div className="wrap phead__in">
        {(crumb || crumbs) && (
          <nav className="crumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            {crumbs?.map((c) => (
              <span key={c.href} style={{ display: "contents" }}>
                <span aria-hidden="true">/</span>
                <Link href={c.href}>{c.label}</Link>
              </span>
            ))}
            <span aria-hidden="true">/</span>
            <span aria-current="page">{crumb}</span>
          </nav>
        )}

        <Eyebrow num={kicker} text={sub} />
        <h1 className="phead__h">{title}</h1>
        {lede && <p className="phead__lede">{lede}</p>}
        {actions && <div className="phead__cta">{actions}</div>}
      </div>

      <AronaiBand />
    </section>
  );
}

export function StatStrip({ stats = allStats }: { stats?: Stat[] }) {
  return (
    <section className="stats" aria-label="Key figures">
      <div className="wrap stats__grid">
        {stats.map((s, i) => (
          <div className="stat" key={s.label} style={{ "--i": i } as React.CSSProperties}>
            <p className="stat__v">
              <Counter to={s.value} />
              {s.suffix}
            </p>
            <p className="stat__l">{s.label}</p>
            <p className="stat__n">{s.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Pillars({ pillars = allPillars }: { pillars?: Pillar[] }) {
  return (
    <div className="pillars">
      {pillars.map((p, i) => (
        <article className="pillar" key={p.index} style={{ "--i": i } as React.CSSProperties}>
          <span className="pillar__n">{p.index}</span>
          <span className="pillar__ico">
            <Icon name={p.icon} />
          </span>
          <h3 className="pillar__t">{p.title}</h3>
          <p className="pillar__p">{p.body}</p>
        </article>
      ))}
    </div>
  );
}

export function CoverageList({ districts = allDistricts }: { districts?: District[] }) {
  return (
    <ul className="coverage__list">
      {districts.map((d, i) => (
        <li
          className={`district${d.core ? " district--core" : ""}`}
          key={d.name}
          style={{ "--i": i } as React.CSSProperties}
        >
          <span className="district__n">{d.name}</span>
          <span className="district__r">{d.region}</span>
        </li>
      ))}
    </ul>
  );
}

export function ServiceCards({ services }: { services: Service[] }) {
  return (
    <div className="cards">
      {services.map((s, i) => (
        <Link
          className="card"
          href={`/services/${s.slug}`}
          key={s.slug}
          style={{ "--i": i } as React.CSSProperties}
        >
          <span className="card__ico">
            <Icon name={s.icon} />
          </span>
          <h3 className="card__t">{s.name}</h3>
          <p className="card__p">{s.summary}</p>
          <span className="card__go">
            Read the scope <Icon name="arrow" />
          </span>
        </Link>
      ))}
      {services.length === 0 && <p className="empty">No services listed yet.</p>}
    </div>
  );
}

/**
 * The parade footage supplied by the client.
 *
 * Muted, looping and `playsInline` so it behaves as motion rather than media —
 * no controls to operate, nothing that hijacks a phone into fullscreen. It is
 * not `autoPlay`: the file is ~4.7 MB, and firing that at every visitor on a
 * mobile connection in Kokrajhar to decorate a section is not a trade worth
 * making. `preload="none"` plus a poster frame means nothing is fetched until
 * the visitor presses play.
 */
export function VideoBand({
  src,
  poster,
  caption,
}: {
  src: string;
  poster: string;
  caption: string;
}) {
  return (
    <figure className="vband">
      <video
        className="vband__v"
        src={src}
        poster={poster}
        controls
        muted
        loop
        playsInline
        preload="none"
        aria-label={caption}
      />
      <figcaption className="vband__cap">{caption}</figcaption>
    </figure>
  );
}

/**
 * A single gallery frame. Photographs are duotoned by CSS and lift to full
 * colour on hover; the credit line is required by the CC licences.
 */
export function Shot({
  photo,
  index,
  showCredit = true,
  sizes = "(max-width: 700px) 100vw, 30vw",
}: {
  photo: Photo;
  index: number;
  showCredit?: boolean;
  sizes?: string;
}) {
  return (
    <figure
      className={`shot${photo.tall ? " shot--tall" : ""}${photo.own ? " shot--own" : ""}`}
      style={{ "--i": index } as React.CSSProperties}
    >
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} loading="lazy" />
      <figcaption>
        <span className="shot__cap">{photo.caption}</span>
        {showCredit && (
          <span className="shot__credit">
            {photo.licence ? `${photo.credit} · ${photo.licence}` : photo.credit}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

export function TickList({ items }: { items: string[] }) {
  return (
    <ul className="ticks">
      {items.map((item, i) => (
        <li key={item} style={{ "--i": i } as React.CSSProperties}>
          <Icon name="check" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function CtaBand() {
  return (
    <section className="cta">
      <div className="wrap cta__in">
        <div>
          <Eyebrow num="◆" text="Next step" />
          <h2 className="cta__h">Tell us about the site. We will come and look at it.</h2>
          <p className="cta__p">
            No obligation, no pressure, and a written quotation with the wage, the applicable
            statutory heads and our service charge shown separately — so you can see exactly what
            the guard receives and what we charge on top.
          </p>
        </div>
        <div className="cta__actions">
          <Link className="btn btn--gold btn--lg" href="/contact#quote">
            Request a quotation
          </Link>
          <a className="btn btn--ghost btn--lg" href={`tel:${tel(site.phone)}`}>
            <Icon name="phone" /> {site.phone}
          </a>
        </div>
      </div>
    </section>
  );
}
