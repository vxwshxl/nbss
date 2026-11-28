import { Download, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { site } from "@/content/site";
import { DESIGNS } from "@/lib/card/designs";
import { pageMetadata } from "@/lib/seo/page-metadata";

/**
 * The visiting card, as one link the team can open and download from: three designs,
 * each shown front and back, each with its PNGs and a card-sized PDF for the press.
 *
 * Like /brochure it sits outside the site's chrome, in fixed light colours. The
 * images on the page are the files that download (drawn by lib/card/render.tsx), so
 * what is picked here is what gets printed. The facts on the card (numbers, email,
 * PSARA licence, address) come from content/site.ts.
 */
export const metadata: Metadata = pageMetadata({
  title: "Visiting card: three designs to download",
  description: `The NBSS visiting card in three designs, front and back, ready to print: PSARA Licence No. ${site.psaraLicence}, ${site.phones.join(", ")}, ${site.email}.`,
  path: "/card",
  image: {
    url: "/og/card",
    width: 1200,
    height: 630,
    alt: "The NBSS visiting card, front and back",
  },
});

const SIDES = [
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
] as const;

const BUTTON =
  "press inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-semibold whitespace-nowrap shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009164]";

export default function CardPage() {
  return (
    <div className="min-h-dvh bg-[#eef2f0] text-slate-900 [color-scheme:light]">
      <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-[#eef2f0]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-center gap-2 px-3 py-3 sm:px-6">
          <span className="mr-auto min-w-0 truncate text-[13px] font-semibold text-slate-600">
            <span className="text-slate-900">NBSS</span> · Visiting card
          </span>
          <Link href="/brochure" className="text-[13px] font-semibold text-[#00714e] hover:underline">
            Brochure
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-[1180px] px-3 py-6 sm:px-6 sm:py-10">
        <header className="max-w-[640px] px-1">
          <h1 className="text-[26px] font-bold tracking-tight sm:text-[32px]">Pick a visiting card</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
            Three designs, front and back. Download the one you like: the PDF holds both sides at card size, ready for
            the press; the PNGs are for WhatsApp or a designer.
          </p>
        </header>

        <div className="mt-8 space-y-12 sm:mt-10 sm:space-y-16">
          {DESIGNS.map((d, i) => (
            <section key={d.id} aria-labelledby={`card-${d.id}`}>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-3 px-1">
                <div className="mr-auto">
                  <p className="font-mono text-[12px] font-semibold text-[#00714e]">0{i + 1}</p>
                  <h2 id={`card-${d.id}`} className="text-[19px] font-bold tracking-tight">
                    {d.name}
                  </h2>
                  <p className="text-[13px] text-slate-500">{d.note}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={`/card/${d.id}.pdf`} download={`NBSS visiting card - ${d.name}.pdf`} className={`${BUTTON} bg-[#00714e] text-white hover:bg-[#005f41]`}>
                    <FileText className="size-4" aria-hidden />
                    PDF for print
                  </a>
                  {SIDES.map((s) => (
                    <a
                      key={s.id}
                      href={`/card/${d.id}-${s.id}.png`}
                      download={`NBSS visiting card - ${d.name} - ${s.label}.png`}
                      className={`${BUTTON} border border-slate-200 bg-white text-slate-900 hover:bg-slate-50`}
                    >
                      <Download className="size-4" aria-hidden />
                      {s.label} PNG
                    </a>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:gap-6">
                {SIDES.map((s) => (
                  <figure key={s.id}>
                    {/* The exact image that downloads, so no optimiser re-encodes it. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/card/${d.id}-${s.id}.webp`}
                      alt={`${d.name} visiting card, ${s.label.toLowerCase()}`}
                      width={1050}
                      height={600}
                      loading={i === 0 ? "eager" : "lazy"}
                      className="aspect-[7/4] w-full rounded-[14px] bg-white shadow-[0_18px_40px_-18px_rgba(4,18,12,0.45),0_2px_6px_rgba(4,18,12,0.08)] ring-1 ring-black/5"
                    />
                    <figcaption className="mt-2 px-1 text-[12px] font-semibold text-slate-500">{s.label}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-12 max-w-[640px] px-1 text-[13px] leading-relaxed text-slate-500">
          Size 3.5 × 2 in (89 × 51 mm), drawn at 600 dpi. Text stays 4 mm inside every edge, so a normal trim cuts
          nothing. PSARA Licence No. {site.psaraLicence}.
        </p>

        <footer className="flex flex-wrap items-center justify-between gap-2 px-1 pt-8 pb-4 text-[12px] text-slate-500">
          <span>© {new Date().getFullYear()} National Bodo Security Service</span>
          <Link href="/" className="font-semibold text-[#00714e] hover:underline">
            nbsskokrajhar.com
          </Link>
        </footer>
      </main>
    </div>
  );
}
