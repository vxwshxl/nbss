import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/Icon";
import { CtaBand, Eyebrow, PageHead, SectionHead, Shot, TickList } from "@/components/blocks";
import { photosIn, syllabus } from "@/content/gallery";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: canonical("/training"),
  title: "Training — the twenty-one day induction and what comes after",
  description:
    "Eight modules, twenty-one days, then quarterly refreshers at the Kokrajhar training ground.",
};

const VERIFICATION = [
  { n: "01", title: "Identity", body: "Aadhaar and permanent address verified against documents, not against a photocopy handed over at interview." },
  { n: "02", title: "Police clearance", body: "Requested from the home police station of the candidate's permanent address, not the district they applied in." },
  { n: "03", title: "References", body: "Two independent references contacted by an HR officer by phone. A reference nobody can reach is not a reference." },
  { n: "04", title: "Medical fitness", body: "Basic fitness, vision and blood pressure. Night-shift and armed postings carry a stricter standard." },
  { n: "05", title: "Re-verification", body: "The whole file is refreshed every two years for every person still on the roll." },
  { n: "06", title: "Enhanced check", body: "School, hostel and hospital postings carry an additional check before a candidate is placed on that site." },
];

export default function TrainingPage() {
  const photos = photosIn("training");

  return (
    <>
      <PageHead
        kicker="21"
        sub="Training academy"
        crumb="Training"
        title="Twenty-one days before anyone stands at your gate."
        lede="Eight modules, paid from day one, ending in a supervised attachment on a real posting. Then a refresher every quarter, for as long as they wear the uniform."
        image="/img/ops-fire-training.jpg"
      />

      <section className="section">
        <div className="wrap split">
          <div className="split__copy">
            <Eyebrow num="01" text="The premise" />
            <h2 className="sec-h">Most guarding failures are training failures.</h2>
            <p className="prose">
              A guard who lets a truck out because the paperwork looked roughly right has not been
              dishonest — he has been untrained. A guard who freezes at a fire alarm has not been
              careless. A guard who argues with an agitated attendant in a casualty ward has not
              been rude. In each case somebody skipped a module.
            </p>
            <p className="prose">
              So we do not deploy on the strength of an interview. Every recruit, fresher or
              twenty-year veteran, goes through the same induction at the Kokrajhar training ground
              and is signed off by a field officer before independent posting. It is paid time,
              which is why we take it seriously and so do they.
            </p>
            <TickList
              items={[
                "Paid from day one — nobody trains hungry",
                "Uniform, boots and ID issued on completion, not before",
                "Written and practical assessment at the end of each module",
                "Quarterly refresher for every person on the roll",
                "Site-specific briefing before every new posting",
              ]}
            />
          </div>

          <figure className="split__fig">
            <div className="split__media">
              <Image
                src="/img/ops-parade.jpg"
                alt="Security personnel in formation during a morning turnout inspection"
                fill
                sizes="(max-width: 880px) 100vw, 40vw"
              />
            </div>
            <figcaption>
              Morning turnout inspection at the training ground.{" "}
              <span>Beijing Patrol, CC BY 2.0</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="section section--alt">
        <div className="wrap">
          <SectionHead num="02" kicker="The syllabus" title="Eight modules, twenty-one days." />
          <div className="modules">
            {syllabus.map((m, i) => (
              <article className="module" key={m.code} style={{ "--i": i } as React.CSSProperties}>
                <div className="module__top">
                  <span className="module__c">{m.code}</span>
                  <span className="module__d">{m.days}</span>
                </div>
                <h3 className="module__t">{m.title}</h3>
                <p className="module__p">{m.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <SectionHead
            num="03"
            kicker="Before the uniform"
            title="Verification runs in parallel, and it is the harder gate."
          />
          <div className="verify">
            {VERIFICATION.map((v, i) => (
              <article className="vstep" key={v.n} style={{ "--i": i } as React.CSSProperties}>
                <span className="vstep__n">{v.n}</span>
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {photos.length > 0 && (
        <section className="section section--alt">
          <div className="wrap">
            <SectionHead num="04" kicker="The ground" title="Kokrajhar training ground." />
            <div className="peek">
              {photos.map((p, i) => (
                <Shot key={p.src} photo={{ ...p, tall: false }} index={i} sizes="(max-width: 700px) 50vw, 25vw" />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section section--pillars">
        <div className="wrap narrow">
          <header className="sec-head">
            <Eyebrow num="◆" text="Join the next batch" />
            <h2 className="sec-h">Freshers welcome. Training is paid.</h2>
            <p className="sec-lede">
              You need to be reasonably fit, willing to work shifts, and able to produce Aadhaar,
              address proof and two references. Everything else, we teach.
            </p>
            <Link className="btn btn--gold btn--lg" href="/careers">
              See open positions <Icon name="arrow" />
            </Link>
          </header>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
