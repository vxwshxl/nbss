import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/Icon";
import { PageHead, TickList } from "@/components/blocks";
import { ApplyForm } from "@/components/forms/ApplyForm";
import { vacancies, vacancyById } from "@/content/gallery";
import { site, tel } from "@/content/site";
import { canonical } from "@/lib/seo";

type Params = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return vacancies.map((v) => ({ id: v.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const vacancy = vacancyById(id);
  if (!vacancy) return {};
  return {
    title: `${vacancy.title} — careers`,
    description: vacancy.summary,
    alternates: canonical(`/careers/${vacancy.id}`),
    openGraph: {
      type: "article",
      url: `/careers/${vacancy.id}`,
      title: `${vacancy.title} — ${site.shortName}`,
      description: vacancy.summary,
    },
  };
}

export default async function VacancyPage({ params }: Params) {
  const { id } = await params;
  const vacancy = vacancyById(id);
  if (!vacancy) notFound();

  const others = vacancies.filter((v) => v.id !== vacancy.id).slice(0, 3);

  return (
    <>
      <PageHead
        kicker={<Icon name="person" />}
        sub={vacancy.type}
        crumb={vacancy.title}
        crumbs={[{ href: "/careers", label: "Careers" }]}
        title={vacancy.title}
        lede={vacancy.summary}
        actions={
          <>
            <Link className="btn btn--gold" href="#apply">
              Apply for this role
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
            <h2 className="svc__h">About the role</h2>
            <p className="svc__detail">{vacancy.summary}</p>

            <h3 className="svc__sub">What we need from you</h3>
            <TickList items={vacancy.requirements} />

            <h3 className="svc__sub">What we give you</h3>
            <TickList
              items={[
                "Training in all six areas before your first posting",
                "Uniform, cap and photo identity card",
                "ESI and EPF facility as applicable",
                "Posting in or near your home district wherever possible",
                "Supervision and a supervisor you can actually reach",
                "A route up — guard to supervisor to field officer",
              ]}
            />

            <p className="warn">
              <Icon name="shield-alt" />
              <span>
                NBSS never charges a fee for a job, training, a uniform or a placement. If anyone
                asks you for money in our name, call{" "}
                <a href={`tel:${tel(site.phone)}`}>{site.phone}</a> and report it.
              </span>
            </p>
          </div>

          <aside className="svc__side">
            <div className="panel">
              <h3 className="panel__h">At a glance</h3>
              <dl className="panel__dl">
                <div><dt>Location</dt><dd>{vacancy.location}</dd></div>
                <div><dt>Type</dt><dd>{vacancy.type}</dd></div>
                <div><dt>Experience</dt><dd>{vacancy.experience}</dd></div>
                <div><dt>Pay</dt><dd>{vacancy.pay}</dd></div>
              </dl>
            </div>

            <div className="panel panel--call">
              <p className="panel__k">Questions about the role</p>
              <a className="panel__tel" href={`tel:${tel(site.phone)}`}>
                {site.phone}
              </a>
              <p className="panel__note">
                Monday to Saturday, 09:00–18:00. Or walk into the Kokrajhar office.
              </p>
            </div>

            {others.length > 0 && (
              <div className="panel">
                <h3 className="panel__h">Other openings</h3>
                <ul className="panel__list panel__list--links">
                  {others.map((o) => (
                    <li key={o.id}>
                      <Link href={`/careers/${o.id}`}>
                        {o.title} <em>{o.type}</em>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="section section--alt" id="apply">
        <div className="wrap narrow">
          <ApplyForm vacancy={vacancy} />
        </div>
      </section>
    </>
  );
}
