import Link from "next/link";

import { Icon } from "@/components/Icon";
import { PageHead } from "@/components/blocks";
import { site, tel } from "@/content/site";
import type { LegalDoc } from "@/content/legal";

/**
 * Renders one legal document: masthead, a sticky in-page contents list, the
 * numbered sections, and a cross-link to the other document so the pair reads
 * as one set of paperwork. Everything is static HTML — anchors, not JS.
 */
export function LegalArticle({ doc, other }: { doc: LegalDoc; other: LegalDoc }) {
  return (
    <>
      <PageHead
        kicker="§"
        sub="Legal"
        crumb={doc.shortTitle}
        title={doc.title}
        lede={doc.lede}
      />

      <section className="section section--legal">
        <div className="wrap legal">
          <aside className="legal__aside">
            <p className="legal__stamp">
              Last updated
              <time dateTime={doc.updatedISO}>{doc.updated}</time>
            </p>

            <nav className="legal__toc" aria-label="On this page">
              <p className="legal__toc-h">On this page</p>
              <ol>
                {doc.sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`}>
                      <span className="legal__toc-n">{String(i + 1).padStart(2, "0")}</span>
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <Link className="btn btn--ghost legal__other" href={other.href}>
              {other.shortTitle} <Icon name="arrow" />
            </Link>
          </aside>

          <article className="legal__doc">
            {doc.sections.map((s, i) => (
              <section className="legal__sec" id={s.id} key={s.id}>
                <h2 className="legal__h">
                  <span className="legal__num">{String(i + 1).padStart(2, "0")}</span>
                  {s.heading}
                </h2>
                {s.body.map((p) => (
                  <p className="prose" key={p}>
                    {p}
                  </p>
                ))}
                {s.list && (
                  <ul className="legal__list">
                    {s.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                {s.after?.map((p) => (
                  <p className="prose" key={p}>
                    {p}
                  </p>
                ))}
              </section>
            ))}

            <footer className="legal__foot">
              <p>
                Questions about this document are answered by the office, in person:{" "}
                <a href={`tel:${tel(site.phone)}`}>{site.phone}</a>, or the{" "}
                {site.address.label.toLowerCase()} at {site.address.lines.join(", ")}.
              </p>
            </footer>
          </article>
        </div>
      </section>
    </>
  );
}
