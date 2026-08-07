import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/Icon";
import { Eyebrow, PageHead, SectionHead, ServiceCards, TickList } from "@/components/blocks";
import { QuoteForm } from "@/components/forms/QuoteForm";
import { relatedServices, serviceBySlug, services } from "@/content/services";
import { site, tel } from "@/content/site";
import { canonical } from "@/lib/seo";

type Params = { params: Promise<{ slug: string }> };

/** Every detail page is prerendered at build time. */
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

  const related = relatedServices(service, 3);

  return (
    <>
      <PageHead
        kicker={<Icon name={service.icon} />}
        sub="Security services"
        title={service.name}
        lede={service.summary}
        image={service.image}
        accent={service.accent}
        crumb={service.name}
        crumbs={[{ href: "/services", label: "Services" }]}
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
                <li>Police-verified personnel</li>
                <li>Training completed before posting</li>
                <li>Uniformed and disciplined staff</li>
                <li>24 × 7 monitoring and supervision</li>
                <li>Quick replacement and backup support</li>
                <li>ESI and EPF facility as applicable</li>
              </ul>
            </div>

            <div className="panel panel--call">
              <p className="panel__k">Talk to the deployment desk</p>
              <a className="panel__tel" href={`tel:${tel(site.phone)}`}>
                {site.phone}
              </a>
              <p className="panel__note">
                Mon–Sat, 09:00–18:00. Supervision and deployment run 24 × 7.
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
              kicker="Other sites we guard"
              title="We post guards here too."
              aside={
                <Link className="btn btn--ghost" href="/services">
                  All {services.length} services <Icon name="arrow" />
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
