import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/Icon";
import { Eyebrow, PageHead, SectionHead, ServiceCards, TickList } from "@/components/blocks";
import { QuoteForm } from "@/components/forms/QuoteForm";
import {
  divisionBySlug,
  relatedServices,
  serviceBySlug,
  services,
} from "@/content/services";
import { site, tel } from "@/content/site";
import { canonical } from "@/lib/seo";

type Params = { params: Promise<{ slug: string }> };

/** All thirty-one detail pages are prerendered at build time. */
export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  if (!service) return {};
  return {
    title: service.name,
    description: service.summary,
    alternates: canonical(`/services/${service.slug}`),
    openGraph: {
      type: "article",
      url: `/services/${service.slug}`,
      title: `${service.name} — ${site.shortName}`,
      description: service.summary,
      images: [{ url: service.image, alt: `${service.name} — ${site.name}` }],
    },
  };
}

export default async function ServiceDetailPage({ params }: Params) {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  if (!service) notFound();

  const division = divisionBySlug(service.division);
  const related = relatedServices(service, 4);

  return (
    <>
      <PageHead
        kicker={<Icon name={service.icon} />}
        sub={division?.name ?? "Services"}
        title={service.name}
        lede={service.summary}
        image={service.image}
        accent={division?.accent}
        crumb={service.name}
        crumbs={[
          { href: "/services", label: "Services" },
          { href: `/services?division=${service.division}`, label: division?.name ?? "" },
        ]}
        actions={
          <>
            <Link className="btn btn--gold" href="#quote">
              Get a quote for this
            </Link>
            <a className="btn btn--ghost" href={`tel:${tel(site.phone)}`}>
              <Icon name="phone" /> {site.phone}
            </a>
          </>
        }
      />

      <section className="section">
        <div className="wrap svc">
          <div className="svc__main">
            <h2 className="svc__h">What this posting actually involves</h2>
            <p className="svc__detail">{service.detail}</p>

            <h3 className="svc__sub">Scope of work</h3>
            <TickList items={service.scope} />
          </div>

          <aside className="svc__side">
            <div className="panel">
              <h3 className="panel__h">Typically deployed at</h3>
              <ul className="panel__list">
                {service.fit.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>

            <div className="panel panel--accent">
              <h3 className="panel__h">Included on every contract</h3>
              <ul className="panel__list">
                <li>Verified, police-cleared personnel</li>
                <li>Twenty-one day induction before posting</li>
                <li>24 × 7 control room and escalation ladder</li>
                <li>EPF, ESI and statutory compliance</li>
                <li>Guaranteed reliever against absence</li>
                <li>Monthly site report to the client</li>
              </ul>
            </div>

            <div className="panel panel--call">
              <p className="panel__k">Talk to the deployment desk</p>
              <a className="panel__tel" href={`tel:${tel(site.phone)}`}>
                {site.phone}
              </a>
              <p className="panel__note">
                Mon–Sat 09:30–18:00. Control room answers 24 × 7 on {site.emergency}.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="section section--alt" id="quote">
        <div className="wrap narrow">
          <header className="sec-head">
            <Eyebrow num="◆" text="Costed for your site" />
            <h2 className="sec-h">Four details, then a field officer calls.</h2>
            <p className="sec-lede">
              The service is already selected. Give us the district and the site type, and we will
              arrange the survey.
            </p>
          </header>
          <QuoteForm service={service.slug} />
        </div>
      </section>

      {related.length > 0 && (
        <section className="section">
          <div className="wrap">
            <SectionHead
              num="◆"
              kicker="Also in this division"
              title={division?.name ?? "Related services"}
              aside={
                <Link className="btn btn--ghost" href={`/services?division=${service.division}`}>
                  See the division <Icon name="arrow" />
                </Link>
              }
            />
            <ServiceCards services={related} />
          </div>
        </section>
      )}
    </>
  );
}
