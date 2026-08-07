/**
 * The site's own pages, as a search index.
 *
 * Search previously only ever looked at the service catalogue, so someone
 * typing "careers", "training" or "contact" was told nothing matched — the
 * pages answering exactly that question were invisible to it. Keeping the
 * index here rather than deriving it from the route tree means each entry can
 * carry the words people actually type, which are rarely the words in the
 * page's title ("jobs" for careers, "quote" for contact).
 */

export type PageEntry = {
  href: string;
  title: string;
  summary: string;
  icon: string;
  /** Extra search terms that do not appear in the title or summary. */
  terms: string[];
};

export const pages: PageEntry[] = [
  {
    href: "/",
    title: "Home",
    summary: "Who NBSS is, the sites we guard, and where we operate.",
    icon: "shield",
    terms: ["home", "start", "overview", "nbss", "national bodo security service"],
  },
  {
    href: "/about",
    title: "About NBSS",
    summary: "Company profile, vision and mission, management, and legal compliance.",
    icon: "roots",
    terms: [
      "company",
      "profile",
      "vision",
      "mission",
      "leadership",
      "management",
      "director",
      "dhanjit brahma",
      "compliance",
      "gst",
      "esi",
      "epf",
      "who we are",
    ],
  },
  {
    href: "/services",
    title: "Services",
    summary: "The nine kinds of site we supply trained security personnel to.",
    icon: "layers",
    terms: [
      "what we do",
      "guarding",
      "security guards",
      "bank",
      "hospital",
      "school",
      "college",
      "factory",
      "warehouse",
      "hotel",
      "mall",
      "apartment",
      "construction",
      "event",
      "vip",
    ],
  },
  {
    href: "/training",
    title: "Training",
    summary: "The six areas every guard is trained in before a first posting.",
    icon: "drill",
    terms: [
      "induction",
      "drill",
      "parade",
      "refresher",
      "course",
      "syllabus",
      "fire safety",
      "first aid",
      "crowd control",
      "access control",
    ],
  },
  {
    href: "/gallery",
    title: "Gallery",
    summary: "Photographs of our parades, training sessions and live deployments.",
    icon: "camera",
    terms: ["photos", "pictures", "images", "media", "parade", "video"],
  },
  {
    href: "/careers",
    title: "Careers",
    summary: "Roles we recruit for and how to apply to join NBSS.",
    icon: "people",
    terms: [
      "jobs",
      "vacancy",
      "vacancies",
      "hiring",
      "recruitment",
      "apply",
      "employment",
      "work",
      "guard job",
      "join",
    ],
  },
  {
    href: "/contact",
    title: "Contact & quote",
    summary: "Request a site visit or a quotation, and reach the deployment desk.",
    icon: "phone",
    terms: [
      "quote",
      "quotation",
      "enquiry",
      "enquire",
      "call",
      "phone",
      "number",
      "address",
      "map",
      "site visit",
      "faq",
      "questions",
      "price",
      "cost",
      "rates",
    ],
  },
];

/** Case-insensitive substring match across every indexed field. */
export function searchPages(query: string): PageEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return pages.filter((p) =>
    [p.title, p.summary, ...p.terms].join(" ").toLowerCase().includes(q),
  );
}
