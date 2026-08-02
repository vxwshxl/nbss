import type { Metadata } from "next";
import Link from "next/link";

import { Icon, Logo } from "@/components/Icon";
import { CtaBand, PageHead, Quotes, SectionHead } from "@/components/blocks";
import { clients } from "@/content/gallery";
import { sectors } from "@/content/services";
import { testimonials } from "@/content/site";

export const metadata: Metadata = {
  title: "Clients — who we guard and what they say",
  description:
    "Reference sites across banking, healthcare, education, retail, plantations and government in the Northeast.",
};

export default function ClientsPage() {
  return (
    <>
      <PageHead
        kicker="240+"
        sub="Clients"
        crumb="Clients"
        title="Who we guard, and for how long."
        lede="Contract renewal is the only client metric that resists spin. Ours runs at 96% on a rolling three-year average, and our oldest contract has been live since the year we registered."
        image="/img/services/office.jpg"
      />

      <section className="section">
        <div className="wrap">
          <SectionHead
            num="01"
            kicker="Reference sites"
            title="A representative sample."
            aside={
              <p className="sec-note">
                Named references are shared on request, with the client&apos;s permission.
              </p>
            }
          />

          <div className="clients">
            {clients.map((c, i) => (
              <article className="client" key={c.name} style={{ "--i": i } as React.CSSProperties}>
                <span className="client__mark" aria-hidden="true">
                  <Logo />
                </span>
                <h3 className="client__n">{c.name}</h3>
                <p className="client__s">{c.sector}</p>
                <dl className="client__meta">
                  <div>
                    <dt>Client since</dt>
                    <dd>{c.since}</dd>
                  </div>
                  <div>
                    <dt>Sites</dt>
                    <dd>{c.sites}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--quotes">
        <div className="wrap">
          <SectionHead num="02" kicker="In their words" title="Unedited, and not all of it flattering." />
          <Quotes quotes={testimonials} />
        </div>
      </section>

      <section className="section section--alt">
        <div className="wrap">
          <SectionHead
            num="03"
            kicker="Sector spread"
            title="Where the 240 sites sit."
            aside={
              <Link className="btn btn--ghost" href="/sectors">
                Sector detail <Icon name="arrow" />
              </Link>
            }
          />
          <ul className="sector-chips">
            {sectors.map((s, i) => (
              <li key={s.slug} style={{ "--i": i } as React.CSSProperties}>
                <Link href={`/sectors#${s.slug}`}>{s.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
