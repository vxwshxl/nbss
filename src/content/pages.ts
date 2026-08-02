/**
 * The site's own pages, as a search index.
 *
 * Search previously only ever looked at the service catalogue, so someone
 * typing "careers", "training" or "contact" was told nothing matched — the
 * pages answering exactly that question were invisible to it. Keeping the
 * index here rather than deriving it from the route tree means each entry can
 * carry the words people actually type, which are rarely the words in the
 * page's title ("jobs" for careers, "quote" for contact, "clients" for the
 * customer list).
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
    summary: "Who NBSS is, the divisions, coverage and key figures.",
    icon: "shield",
    terms: ["home", "start", "overview", "nbss", "national bodo security services"],
  },
  {
    href: "/about",
    title: "About NBSS",
    summary: "History since 2009, leadership, licences and how we recruit and verify.",
    icon: "roots",
    terms: ["company", "history", "leadership", "management", "team", "psara", "licence", "iso", "compliance", "timeline", "who we are"],
  },
  {
    href: "/services",
    title: "Services",
    summary: "All services across guarding, facility management, manpower and electronic security.",
    icon: "layers",
    terms: ["catalogue", "what we do", "divisions", "guarding", "housekeeping", "staffing", "cctv"],
  },
  {
    href: "/sectors",
    title: "Sectors we serve",
    summary: "Banking, healthcare, education, industry, plantations, retail and government sites.",
    icon: "people",
    terms: ["industries", "verticals", "bank", "hospital", "school", "college", "factory", "tea estate", "retail", "government"],
  },
  {
    href: "/training",
    title: "Training",
    summary: "The twenty-one day induction, quarterly refreshers and the Kokrajhar training ground.",
    icon: "drill",
    terms: ["induction", "drill", "refresher", "course", "syllabus", "fire safety", "first aid", "academy"],
  },
  {
    href: "/clients",
    title: "Clients",
    summary: "Who we guard for and what they say about the deployment.",
    icon: "shield-check",
    terms: ["customers", "references", "testimonials", "reviews", "case studies", "portfolio"],
  },
  {
    href: "/gallery",
    title: "Gallery",
    summary: "Photographs of parades, drills, the control room and live deployments.",
    icon: "camera",
    terms: ["photos", "pictures", "images", "media", "parade", "control room"],
  },
  {
    href: "/careers",
    title: "Careers",
    summary: "Open vacancies, what we pay and how to apply to join NBSS.",
    icon: "people",
    terms: ["jobs", "vacancy", "vacancies", "hiring", "recruitment", "apply", "employment", "work", "salary", "guard job", "join"],
  },
  {
    href: "/contact",
    title: "Contact & quote",
    summary: "Request a site survey or a quotation, and reach the 24 × 7 control room.",
    icon: "phone",
    terms: ["quote", "quotation", "enquiry", "enquire", "call", "phone", "email", "address", "map", "site survey", "faq", "questions", "price", "cost", "rates"],
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
