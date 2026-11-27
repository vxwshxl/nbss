import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/seo/page-metadata";

import { BrochurePages } from "./brochure-pages";
import { OnePager } from "./one-pager";
import { PrintFromQuery, SavePdf } from "./save-pdf";
import "./brochure.css";

/**
 * The company brochure, as one link the team can send. It holds two documents: the
 * one-page summary first (for the client who reads one page), then the full brochure,
 * each with its own button to print or save just that one as an A4 PDF. Both are
 * drawn as real A4 pages (one-pager.tsx, brochure-pages.tsx) that reflow on a phone.
 *
 * It sits outside the public site's chrome (no header, footer or menu) because it
 * is sent, not browsed; the website is one tap away at the foot. Its copy is read
 * from the same content files as the website, so a service changed there changes
 * here. It is drawn in fixed light colours, as paper is, whatever the reader's theme.
 */
export const metadata: Metadata = pageMetadata({
  title: "Company brochure: security services across Assam",
  description:
    "NBSS supplies trained, police-verified security guards to schools, hospitals, government offices, banks, hotels, retail, industry, construction sites and events across Assam. Services, training, supervision, our assistant Nibo and contacts, as a one-page summary and an eight-page brochure.",
  path: "/brochure",
  image: {
    url: "/og/brochure",
    width: 1200,
    height: 630,
    alt: "NBSS company brochure: trained guards for every site, across Assam",
  },
});

export default function BrochurePage() {
  return (
    <div className="brochure min-h-dvh bg-[#eef2f0] text-slate-900 [color-scheme:light]">
      <PrintFromQuery />
      <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-[#eef2f0]/90 backdrop-blur print:hidden">
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
          <DocLabel n={2} title="Full brochure" note="Eight pages: services, people, supervision and Nibo" />
          <BrochurePages />
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 px-2 pt-6 pb-8 text-[12px] text-slate-500 print:hidden">
          <span>
            © {new Date().getFullYear()} National Bodo Security Service
          </span>
          <Link href="/" className="font-semibold text-[#00714e] hover:underline">
            nbsskokrajhar.com
          </Link>
        </footer>
      </div>
    </div>
  );
}

/** Names each of the page's two documents on screen; not printed. */
function DocLabel({ n, title, note }: { n: number; title: string; note: string }) {
  return (
    <div className="mx-auto mb-3 flex max-w-[794px] items-baseline gap-3 px-2 print:hidden">
      <span className="font-mono text-[12px] font-semibold text-[#00714e]">0{n}</span>
      <h2 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h2>
      <span className="hidden text-[13px] text-slate-500 sm:inline">{note}</span>
    </div>
  );
}
