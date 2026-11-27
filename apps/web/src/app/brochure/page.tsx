import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock, Globe, Mail, MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";

import { tel } from "@nbss/shared/company";
import { syllabus } from "@/content/gallery";
import { services } from "@/content/services";
import { pillars, site, stats } from "@/content/site";
import { pageMetadata } from "@/lib/seo/page-metadata";

import { PILLAR_ICONS, ROLES, SERVICE_ICONS, STEPS, TECH } from "./content";
import { OnePager } from "./one-pager";
import { PrintFromQuery, SavePdf } from "./save-pdf";
import "./brochure.css";

/**
 * The company brochure, as one link the team can send. It holds two documents: the
 * one-page summary first (for the client who reads one page), then the full brochure,
 * each with its own button to print or save just that one as an A4 PDF.
 *
 * It sits outside the public site's chrome (no header, footer or menu) because it
 * is sent, not browsed; the website is one tap away at the foot. Its copy is read
 * from the same content files as the website, so a service changed there changes
 * here. It is drawn in fixed light colours, as paper is, whatever the reader's theme.
 */
export const metadata: Metadata = pageMetadata({
  title: "Company brochure: security services across Assam",
  description:
    "NBSS supplies trained, police-verified security guards to schools, hospitals, government offices, banks, hotels, retail, industry, construction sites and events across Assam. Services, training, supervision and contacts on one page.",
  path: "/brochure",
  image: {
    url: "/og/brochure",
    width: 1200,
    height: 630,
    alt: "NBSS company brochure: trained guards for every site, across Assam",
  },
});

const STRIP = [
  { src: "/img/nbss/parade-salute.webp", alt: "NBSS guards saluting at evening parade" },
  { src: "/img/nbss/training-classroom.webp", alt: "NBSS recruits in a training classroom" },
  { src: "/img/nbss/woman-guard.webp", alt: "An NBSS lady security guard on duty" },
  { src: "/img/nbss/hall-gate.webp", alt: "NBSS guards at a hall gate" },
];

/**
 * A row of buttons: on a phone two to a row at half width each, and an odd last one
 * centred at the same width; from sm up, a plain row.
 */
const ACTIONS =
  "grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap [&>*]:justify-center sm:[&>*]:justify-start [&>*:last-child:nth-child(odd)]:col-span-2 [&>*:last-child:nth-child(odd)]:w-[calc(50%-0.3125rem)] [&>*:last-child:nth-child(odd)]:justify-self-center sm:[&>*:last-child:nth-child(odd)]:w-auto print:hidden";
const BTN = "press inline-flex h-11 min-w-0 items-center gap-2 rounded-full px-3 text-[14px] font-semibold whitespace-nowrap sm:px-5";

const WHATSAPP = site.social.find((s) => s.label === "WhatsApp")?.url ?? "https://wa.me/917577036205";
const SCHOOLERP = "https://schoolerp.okhrang.com";

export default function BrochurePage() {
  return (
    <div className="brochure min-h-dvh bg-[#f4f6f5] text-slate-900 [color-scheme:light]">
      <PrintFromQuery />
      <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-[#f4f6f5]/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[1080px] items-center gap-2 px-3 py-2.5 sm:px-6">
          <span className="mr-auto min-w-0 truncate text-[13px] font-semibold text-slate-600">
            <span className="text-slate-900">NBSS</span> · Company brochure
          </span>
          <SavePdf target="onepager" label="One-pager PDF" />
          <SavePdf target="brochure" label="Brochure PDF" className="hidden sm:inline-flex" />
          <SavePdf target="brochure" label="Brochure" className="sm:hidden" />
        </div>
      </div>

      <div className="mx-auto max-w-[1080px] px-3 py-3 sm:px-6 sm:py-6">
        {/* ─── 1. The one-pager ─── */}
        <div className="onepager-doc">
          <DocLabel n={1} title="At a glance" note="Everything NBSS does, on one A4 page" />
          <OnePager />
        </div>

        {/* ─── 2. The full brochure ─── */}
        <div className="brochure-doc mt-10 sm:mt-14 print:mt-0">
        <DocLabel n={2} title="Full brochure" note="Services, people, training and supervision in detail" />

        {/* ─── Cover ─── */}
        <section className="sheet keep overflow-hidden rounded-[28px] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_24px_60px_-30px_rgb(0_60_40/0.25)]">
          <div className="h-1.5 bg-gradient-to-r from-[#006b4a] via-[#009164] to-[#14b8a6]" />
          <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-10 sm:pt-8">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <Image src="/logo/nbss-256.webp" alt="" width={48} height={48} className="size-11 shrink-0 sm:size-12" priority />
              <span className="min-w-0 leading-tight">
                <span className="block font-display text-[20px] font-extrabold tracking-[-0.03em] sm:text-[22px]">NBSS</span>
                <span className="block truncate text-[12px] font-medium text-slate-500 sm:text-[13px]">National Bodo Security Service</span>
              </span>
            </Link>
            <SavePdf target="brochure" label="PDF" className="sm:hidden" />
            <SavePdf target="brochure" label="Save as PDF" className="hidden sm:inline-flex" />
          </div>

          <div className="grid gap-8 px-5 pt-8 pb-6 sm:px-10 sm:pt-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-10 print:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] print:items-center print:gap-7 print:px-8 print:pt-8">
            <div>
              <p className="text-[11px] font-bold tracking-[0.22em] text-[#00714e] uppercase sm:text-[12px]">Company profile · Security services</p>
              <h1 className="mt-3 font-display text-[38px] leading-[1.02] font-extrabold tracking-[-0.04em] sm:text-[54px] print:text-[38px]">
                Trained guards for every site,{" "}
                <span className="bg-[linear-gradient(90deg,#16a36f,#009164,#00714e)] bg-clip-text text-transparent underline decoration-[#009164]/60 decoration-4 underline-offset-[10px]">
                  across Assam.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-slate-600 sm:text-[16px] print:text-[13px]">
                National Bodo Security Service is a professionally managed security agency headquartered in Kokrajhar, Bodoland
                Territorial Council. We supply trained, police-verified security personnel to government, corporate, institutional
                and commercial clients, supervised around the clock.
              </p>
              <div className={`mt-6 ${ACTIONS}`}>
                <a href={`tel:${tel(site.phone)}`} className={`${BTN} bg-[#009164] text-white shadow-[0_2px_0_#006b4a] hover:bg-[#00845b]`}>
                  <Phone className="size-4" /> Call<span className="hidden sm:inline"> {site.phone}</span>
                </a>
                <a href={WHATSAPP} className={`${BTN} border border-slate-200 bg-white hover:bg-slate-50`}>
                  <MessageCircle className="size-4 text-[#25D366]" /> WhatsApp
                </a>
                <Link href="/contact" className={`${BTN} border border-slate-200 bg-white hover:bg-slate-50`}>
                  Get a quote <ArrowUpRight className="size-4" />
                </Link>
                <Link href="/" className={`${BTN} border border-slate-200 bg-white hover:bg-slate-50`}>
                  <Globe className="size-4 text-[#009164]" /> Website
                </Link>
              </div>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-slate-100 lg:aspect-[5/4] print:aspect-[5/4]">
              <Image
                src="/img/nbss/parade-ranks.webp"
                alt="NBSS guards in uniform standing in formation"
                fill
                priority
                sizes="(min-width: 1024px) 500px, 100vw"
                className="object-cover object-[60%_75%]"
              />
              <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-semibold text-slate-900 shadow-sm backdrop-blur">
                <ShieldCheck className="size-4 text-[#009164]" /> {site.tagline}
              </span>
            </div>
          </div>

          <dl className="grid grid-cols-2 border-t border-slate-100 sm:grid-cols-4">
            {stats.slice(0, 4).map((s, i) => (
              <div key={s.label} className={`px-5 py-5 sm:px-8 ${i % 2 ? "border-l border-slate-100" : ""} ${i >= 2 ? "border-t border-slate-100 sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""}`}>
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="font-display text-[30px] font-extrabold tracking-[-0.04em] text-[#009164] sm:text-[34px]">
                    {s.value}
                    {s.suffix}
                  </span>
                  <span className="mt-0.5 block text-[13px] font-semibold">{s.label}</span>
                  <span className="block text-[12px] text-slate-500">{s.note}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ─── Why NBSS ─── */}
        <Sheet eyebrow="Why NBSS" title="Six things every client gets.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
            {pillars.map((p) => {
              const Icon = PILLAR_ICONS[p.icon] ?? ShieldCheck;
              return (
                <article key={p.index} className="keep rounded-2xl border border-slate-100 bg-[#fafbfa] p-5">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[#009164]/12 text-[#00714e]">
                    <Icon className="size-5" strokeWidth={1.9} />
                  </span>
                  <h3 className="mt-4 text-[15px] font-bold tracking-tight">{p.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">{p.body}</p>
                </article>
              );
            })}
          </div>
        </Sheet>

        {/* ─── Services ─── */}
        <Sheet eyebrow="Our services" title={`Guards for ${services.length} kinds of site.`} lead="Every posting is planned for the premises: the posts, the hours, and the people best suited to them.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
            {services.map((s) => {
              const Icon = SERVICE_ICONS[s.icon] ?? ShieldCheck;
              return (
                <Link
                  key={s.slug}
                  href={`/services/${s.slug}`}
                  className="keep group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-shadow hover:shadow-[0_12px_30px_-18px_rgb(0_60_40/0.4)]"
                >
                  <span className="relative block aspect-[16/9] overflow-hidden bg-slate-100">
                    <Image src={s.image} alt="" fill sizes="(min-width: 1024px) 340px, (min-width: 640px) 50vw, 100vw" className="object-cover transition-[scale] duration-700 group-hover:scale-[1.04]" />
                    <span className="absolute top-3 left-3 flex size-9 items-center justify-center rounded-xl bg-white/95 text-[#00714e] shadow-sm">
                      <Icon className="size-[18px]" strokeWidth={1.9} />
                    </span>
                  </span>
                  <span className="flex flex-1 flex-col p-4">
                    <span className="text-[15px] font-bold tracking-tight">{s.name}</span>
                    <span className="mt-1 text-[13px] leading-relaxed text-slate-600">{s.summary}</span>
                    <ul className="mt-3 space-y-1 text-[12.5px] text-slate-700">
                      {s.scope.slice(0, 3).map((line) => (
                        <li key={line} className="flex gap-2">
                          <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[#009164]" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  </span>
                </Link>
              );
            })}
          </div>
        </Sheet>

        {/* ─── People and training ─── */}
        <Sheet eyebrow="Our people" title="Who we post, and how they are trained.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
            {ROLES.map((r) => (
              <article key={r.title} className="keep rounded-2xl border border-slate-100 bg-[#fafbfa] p-5">
                <h3 className="text-[15px] font-bold tracking-tight">{r.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">{r.body}</p>
              </article>
            ))}
          </div>
          <div className="keep mt-5 rounded-2xl bg-[#06110d] p-5 text-white sm:p-7">
            <p className="text-[11px] font-bold tracking-[0.22em] text-emerald-300 uppercase">Training before first duty</p>
            <ol className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
              {syllabus.map((m) => (
                <li key={m.code} className="flex gap-3">
                  <span className="font-mono text-[13px] font-semibold text-emerald-300">{m.code}</span>
                  <span>
                    <span className="block text-[14px] font-semibold">{m.title}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-relaxed text-white/65">{m.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </Sheet>

        {/* ─── Technology ─── */}
        <Sheet eyebrow="Supervision you can see" title="Every guard, on our app." lead="Our own Android app runs every posting: attendance, tracking and alarms, checked by our control room around the clock.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
            {TECH.map((t) => (
              <article key={t.title} className="keep rounded-2xl border border-slate-100 bg-[#fafbfa] p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#009164]/12 text-[#00714e]">
                  <t.icon className="size-5" strokeWidth={1.9} />
                </span>
                <h3 className="mt-4 text-[15px] font-bold tracking-tight">{t.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">{t.body}</p>
              </article>
            ))}
          </div>
        </Sheet>

        {/* ─── How to start, and the photos ─── */}
        <Sheet flow eyebrow="Getting started" title="From first call to guards on duty.">
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="keep relative rounded-2xl border border-slate-100 bg-[#fafbfa] p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-[#009164] font-display text-[15px] font-extrabold text-white">{i + 1}</span>
                <h3 className="mt-4 text-[15px] font-bold tracking-tight">{s.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="keep mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 print:hidden">
            {STRIP.map((p) => (
              <span key={p.src} className="relative block aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
                <Image src={p.src} alt={p.alt} fill sizes="(min-width: 640px) 25vw, 50vw" className="object-cover" />
              </span>
            ))}
          </div>
        </Sheet>

        {/* ─── Contact ─── */}
        <section className="sheet sheet-flow keep mt-3 overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#00714e,#009164_55%,#14b8a6)] p-6 text-white sm:mt-5 sm:p-10">
          <p className="text-[11px] font-bold tracking-[0.22em] text-emerald-100 uppercase sm:text-[12px]">Talk to us</p>
          <h2 className="mt-2 font-display text-[30px] leading-tight font-extrabold tracking-[-0.035em] sm:text-[40px]">Let&apos;s secure your site.</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            <div>
              <p className="flex items-center gap-2 text-[12px] font-semibold text-emerald-100">
                <Phone className="size-4" /> Phone
              </p>
              <ul className="mt-1.5 space-y-0.5 text-[15px] font-semibold tabular-nums">
                {site.phones.map((p) => (
                  <li key={p}>
                    <a href={`tel:${tel(p)}`} className="hover:underline">
                      {p}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="flex items-center gap-2 text-[12px] font-semibold text-emerald-100">
                <Mail className="size-4" /> Email
              </p>
              <a href={`mailto:${site.email}`} className="mt-1.5 block text-[15px] font-semibold hover:underline">
                {site.email}
              </a>
              <p className="mt-4 flex items-center gap-2 text-[12px] font-semibold text-emerald-100">
                <Clock className="size-4" /> Office hours
              </p>
              <p className="mt-1.5 text-[14px]">{site.hoursShort}</p>
            </div>
            <div>
              <p className="flex items-center gap-2 text-[12px] font-semibold text-emerald-100">
                <MapPin className="size-4" /> {site.address.label}
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed">
                {site.address.lines.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </p>
            </div>
          </div>
          <div className={`mt-7 ${ACTIONS}`}>
            <a href={WHATSAPP} className={`${BTN} bg-white text-[#00714e] shadow-sm`}>
              <MessageCircle className="size-4" /> <span className="sm:hidden">WhatsApp</span>
              <span className="hidden sm:inline">Message on WhatsApp</span>
            </a>
            <Link href="/contact" className={`${BTN} border border-white/40 hover:bg-white/10`}>
              Get a quote <ArrowUpRight className="size-4" />
            </Link>
            <Link href="/" className={`${BTN} border border-white/40 hover:bg-white/10`}>
              <Globe className="size-4" /> Visit website
            </Link>
          </div>
          <p className="mt-6 hidden text-[13px] font-semibold print:block">nbsskokrajhar.com · {site.phone}</p>
        </section>

        {/* ─── From the team that built our app ─── */}
        <section className="sheet sheet-flow keep mt-3 rounded-[28px] bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:mt-5 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-center lg:gap-10 print:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] print:items-center">
            <div>
              <p className="text-[11px] font-bold tracking-[0.22em] text-[#00714e] uppercase sm:text-[12px]">From our technology partner</p>
              <h2 className="mt-2 font-display text-[26px] leading-tight font-extrabold tracking-[-0.035em] sm:text-[32px]">Run a school? Meet SchoolERP.</h2>
              <p className="mt-3 text-[14.5px] leading-relaxed text-slate-600">
                The NBSS app and website are built by Bodo Okhrang, Kokrajhar. Their SchoolERP runs admissions, attendance,
                examinations, fees, library, transport and certificates in one place, with each school on its own branded address.
              </p>
            </div>
            <a
              href={SCHOOLERP}
              target="_blank"
              rel="noopener"
              className="group flex flex-col rounded-[26px] border border-[#ece6d6] bg-[#fdfaf3] p-2 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_20px_40px_-24px_rgb(120_90_20/0.35)] transition-[translate,box-shadow] duration-300 hover:-translate-y-1"
            >
              <span className="relative block aspect-[1200/630] overflow-hidden rounded-[20px] border border-[#ece6d6]">
                <Image
                  src="/img/partners/schoolerp-banner-light.webp"
                  alt="SchoolERP by Bodo Okhrang: everything your school runs on, in one place"
                  fill
                  sizes="(min-width: 1024px) 560px, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </span>
              <span className="flex items-center gap-3 px-2 pt-4 pb-2 sm:px-3">
                <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#ece6d6] bg-white">
                  <Image src="/img/partners/schoolerp.webp" alt="" width={96} height={96} loading="eager" className="size-full object-contain p-1" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-snug font-semibold sm:text-[16px]">SchoolERP by Bodo Okhrang</span>
                  <span className="block truncate text-[13px] text-slate-500">schoolerp.okhrang.com</span>
                </span>
                <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#f5c542] text-slate-900 shadow-sm transition-colors group-hover:bg-[#f0b92a]">
                  <ArrowUpRight className="size-[18px]" />
                </span>
              </span>
            </a>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 px-2 pt-5 pb-8 text-[12px] text-slate-500 print:pb-0">
          <span>
            © {new Date().getFullYear()} {site.name}
          </span>
          <Link href="/" className="font-semibold text-[#00714e] hover:underline">
            nbsskokrajhar.com
          </Link>
        </footer>
        </div>
      </div>
    </div>
  );
}

/** One section of the brochure: a white sheet with a small capitals line and a heading. */
function Sheet({
  eyebrow,
  title,
  lead,
  flow,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  /** On paper, follow on from the section before instead of starting a new page. */
  flow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`sheet ${flow ? "sheet-flow" : ""} mt-3 rounded-[28px] bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:mt-5 sm:p-10 print:p-8`}>
      <p className="text-[11px] font-bold tracking-[0.22em] text-[#00714e] uppercase sm:text-[12px]">{eyebrow}</p>
      <h2 className="mt-2 font-display text-[26px] leading-tight font-extrabold tracking-[-0.035em] sm:text-[36px]">{title}</h2>
      {lead && <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-slate-600">{lead}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Names each of the page's two documents on screen; not printed. */
function DocLabel({ n, title, note }: { n: number; title: string; note: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-3 px-2 print:hidden">
      <span className="font-mono text-[12px] font-semibold text-[#00714e]">0{n}</span>
      <h2 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h2>
      <span className="hidden text-[13px] text-slate-500 sm:inline">{note}</span>
    </div>
  );
}
