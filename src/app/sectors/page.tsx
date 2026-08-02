import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/Icon";
import { CtaBand, Eyebrow, PageHead } from "@/components/blocks";
import { sectors } from "@/content/services";

export const metadata: Metadata = {
  title: "Sectors we serve — from bank branches to tea estates",
  description:
    "Twelve verticals NBSS deploys into, and what changes about the posting in each one.",
};

export default function SectorsPage() {
  return (
    <>
      <PageHead
        kicker={sectors.length}
        sub="Sectors"
        crumb="Sectors"
        title="The same uniform. A different job in every one."
        lede="A bank guard runs a written opening drill. A tea-estate guard supervises leaf weighment. A hospital guard talks down a frightened family at two in the morning. We brief for the sector, not just the post."
        image="/img/services/mall.jpg"
      />

      <section className="section">
        <div className="wrap">
          <div className="sectors">
            {sectors.map((s, i) => (
              <article
                className="sector"
                id={s.slug}
                key={s.slug}
                style={{ "--i": i } as React.CSSProperties}
              >
                <div className="sector__img">
                  <Image src={s.image} alt="" fill sizes="(max-width: 760px) 100vw, 50vw" loading="lazy" />
                </div>
                <div className="sector__body">
                  <span className="sector__n">{String(i + 1).padStart(2, "0")}</span>
                  <h2 className="sector__t">{s.name}</h2>
                  <p className="sector__p">{s.blurb}</p>
                  <Link className="sector__go" href="/contact#quote">
                    Discuss a site <Icon name="arrow" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--alt">
        <div className="wrap narrow">
          <header className="sec-head">
            <Eyebrow num="◆" text="Not on the list?" />
            <h2 className="sec-h">Then tell us what the site is.</h2>
            <p className="sec-lede">
              We have taken postings at a river ferry ghat, a seed farm and a district library. If
              it has a gate, a stock, or people who need to feel safe walking to their car, it is a
              security problem and we will look at it.
            </p>
            <Link className="btn btn--gold btn--lg" href="/contact">
              Describe your site <Icon name="arrow" />
            </Link>
          </header>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
