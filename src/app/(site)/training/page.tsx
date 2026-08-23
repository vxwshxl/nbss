import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/Icon";
import {
  CtaBand,
  Eyebrow,
  PageHead,
  SectionHead,
  Shot,
  TickList,
  VideoBand,
} from "@/components/blocks";
import { photosIn, syllabus } from "@/content/gallery";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: canonical("/training"),
  title: "Training — the six areas every guard is trained in",
  description:
    "Guarding duties, physical fitness and parade, fire safety, first aid, access control and crowd control — completed before a first posting.",
};

const VERIFICATION = [
  {
    n: "01",
    title: "Police verification",
    body: "Every guard is police-verified before deployment. This is not waived for an urgent posting, and it is not something we start after the guard is already on your gate.",
  },
  {
    n: "02",
    title: "Identity and address",
    body: "Aadhaar and permanent address documents are checked and held on file as part of the same verification, not accepted as a photocopy handed over at interview.",
  },
  {
    n: "03",
    title: "Fitness for duty",
    body: "Guarding is physical work on long shifts. Basic fitness is assessed before posting, and parade and fitness training continue afterwards.",
  },
];

export default function TrainingPage() {
  const photos = photosIn("training");

  return (
    <>
      <PageHead
        kicker="06"
        sub="Training"
        crumb="Training"
        title="Trained before anyone stands at your gate."
        lede="Six areas, covered before a first posting and revisited afterwards. A guard who freezes at a fire alarm has not been careless — somebody skipped the training."
        image="/img/nbss/training-classroom.jpg"
      />

      <section className="section">
        <div className="wrap split">
          <div className="split__copy">
            <Eyebrow num="01" text="The premise" />
            <h2 className="sec-h">Most guarding failures are training failures.</h2>
            <p className="prose">
              A guard who lets a vehicle out because the paperwork looked roughly right has not
              been dishonest — he has been untrained. A guard who argues with an agitated attendant
              in a hospital corridor has not been rude. In each case there is a module behind the
              mistake.
            </p>
            <p className="prose">
              So we do not deploy on the strength of an interview. Our guards undergo training in
              guarding duties, physical fitness and parade, fire safety and emergency response,
              first-aid support, access control and gate management, and crowd control and
              discipline. Sessions are run with external instructors where the subject calls for
              it — the emergency-response training on this page was conducted with SDRF Assam.
            </p>
            <TickList
              items={[
                "Training completed before the first independent posting",
                "Uniform, cap and identity card issued to every guard",
                "Parade and turnout inspection as continuing practice",
                "Police verification completed before deployment",
                "Site-specific briefing before every new posting",
              ]}
            />
          </div>

          <figure className="split__fig">
            <div className="split__media">
              <Image
                src="/img/nbss/parade-ranks.jpg"
                alt="NBSS guards drawn up in ranks with batons during parade drill"
                fill
                sizes="(max-width: 880px) 100vw, 40vw"
              />
            </div>
            <figcaption>
              Drill ranks — bearing, spacing and discipline.
              <span>National Bodo Security Service</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="section section--alt">
        <div className="wrap">
          <SectionHead
            num="02"
            kicker="What we train"
            title="Six areas, every guard."
            lede="These are the areas named in our training programme. They are the ones that decide what happens on a site at three in the morning."
          />
          <div className="modules">
            {syllabus.map((m, i) => (
              <article className="module" key={m.code} style={{ "--i": i } as React.CSSProperties}>
                <div className="module__top">
                  <span className="module__c">{m.code}</span>
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
            title="Verification runs alongside, and it is the harder gate."
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

      <section className="section section--alt">
        <div className="wrap split">
          <div className="split__copy">
            <Eyebrow num="04" text="Parade" />
            <h2 className="sec-h">Turnout, in motion.</h2>
            <p className="prose">
              Parade is where discipline becomes visible. It is also where a supervisor catches the
              uniform, the cap, the identity card and the bearing — before a client has to notice
              any of them.
            </p>
          </div>
          <VideoBand
            src="/video/nbss-parade.mp4"
            poster="/img/nbss/parade-salute.jpg"
            caption="NBSS parade, Kokrajhar."
          />
        </div>
      </section>

      {photos.length > 0 && (
        <section className="section">
          <div className="wrap">
            <SectionHead num="05" kicker="Sessions" title="Training and parade, photographed." />
            <div className="peek">
              {photos.map((p, i) => (
                <Shot
                  key={p.src}
                  photo={{ ...p, tall: false }}
                  index={i}
                  sizes="(max-width: 700px) 50vw, 25vw"
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section section--pillars">
        <div className="wrap narrow">
          <header className="sec-head">
            <Eyebrow num="◆" text="Join us" />
            <h2 className="sec-h">Freshers welcome. Training is provided.</h2>
            <p className="sec-lede">
              You need to be reasonably fit, willing to work shifts, and able to produce Aadhaar and
              address proof for verification. Everything else, we teach.
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
