/** Gallery photographs, client references, vacancies and the training syllabus. */

export type Photo = {
  src: string;
  alt: string;
  caption: string;
  category: "operations" | "training" | "bodoland" | "community";
  credit: string;
  licence: string;
  /** Renders across two grid rows in the mosaic. */
  tall?: boolean;
};

export type GalleryCategory = { slug: string; label: string };

/** "all" must stay first — it is the default filter. */
export const galleryCategories: GalleryCategory[] = [
  { slug: "all", label: "Everything" },
  { slug: "operations", label: "Operations" },
  { slug: "training", label: "Training" },
  { slug: "bodoland", label: "Bodoland" },
  { slug: "community", label: "Community" },
];

/**
 * Attribution is mandatory for the CC BY and CC BY-SA images and is rendered
 * under every tile. See CREDITS.md for the full list.
 */
export const gallery: Photo[] = [
  { src: "/img/hero-guard.jpg", alt: "A uniformed security guard on duty at a campus gate", caption: "Gate duty, morning shift", category: "operations", credit: "liber(the poet)", licence: "CC BY-SA 2.0", tall: true },
  { src: "/img/ops-team.jpg", alt: "A security team standing in formation", caption: "Shift briefing before deployment", category: "operations", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },
  { src: "/img/ops-drill.jpg", alt: "Security personnel during a formation drill", caption: "Drill square, Kokrajhar training ground", category: "training", credit: "Beijing Patrol", licence: "CC BY 2.0" },
  { src: "/img/ops-parade.jpg", alt: "Guards in formation during morning parade", caption: "Morning turnout inspection", category: "training", credit: "Beijing Patrol", licence: "CC BY 2.0" },
  { src: "/img/ops-fire-training.jpg", alt: "Fire safety training with an extinguisher", caption: "Quarterly fire response refresher", category: "training", credit: "BLM Oregon & Washington", licence: "CC BY-SA 2.0", tall: true },
  { src: "/img/ops-cctv.jpg", alt: "Close-up of a CCTV surveillance camera", caption: "Perimeter camera commissioning", category: "operations", credit: "Ivan Radic", licence: "CC BY 2.0" },
  { src: "/img/ops-cctv2.jpg", alt: "A 24-hour CCTV surveillance sign and camera", caption: "Twenty-four hour monitored site", category: "operations", credit: "stwn", licence: "CC BY-SA 2.0" },
  { src: "/img/ops-control-room.jpg", alt: "Operators watching screens in a control room", caption: "Control room, night watch", category: "operations", credit: "West Midlands Police", licence: "CC BY-SA 2.0", tall: true },
  { src: "/img/ops-bank.jpg", alt: "A security guard posted outside a bank", caption: "Branch posting, opening drill", category: "operations", credit: "Brad & Ying", licence: "CC BY 2.0" },

  { src: "/img/gallery/aronai.jpg", alt: "An Aronai, the traditional woven Bodo scarf", caption: "The Aronai — the woven band our identity is drawn from", category: "bodoland", credit: "Wikimedia Commons", licence: "CC BY 4.0", tall: true },
  { src: "/img/gallery/aronai-2.jpg", alt: "Detail of Aronai weaving showing diamond motifs", caption: "Diamond motif, hand-loomed", category: "bodoland", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },
  { src: "/img/gallery/bagurumba-1.jpg", alt: "Bodo women performing the Bagurumba dance", caption: "Bagurumba — the butterfly dance", category: "community", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },
  { src: "/img/gallery/bagurumba-2.jpg", alt: "Bagurumba dancers in traditional dokhona", caption: "Festival ground deployment, Bwisagu week", category: "community", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },
  { src: "/img/gallery/bagurumba-3.jpg", alt: "A Bagurumba performance in progress", caption: "Crowd management at a cultural meet", category: "community", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0", tall: true },
  { src: "/img/gallery/bwisagu.jpg", alt: "Bwisagu festival dance performance", caption: "Bwisagu — the Bodo new year", category: "community", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },
  { src: "/img/gallery/bardoi-sikhla.jpg", alt: "Bodo girls performing the Bardoi Sikhla dance", caption: "Bardoi Sikhla, harvest season", category: "community", credit: "Wikimedia Commons", licence: "CC BY 2.0" },
  { src: "/img/gallery/bodo-women.jpg", alt: "Bodo women in traditional dokhona", caption: "The recruitment base our lady-guard programme draws on", category: "bodoland", credit: "Wikimedia Commons", licence: "CC BY-SA 3.0" },
  { src: "/img/gallery/bodo-elder.jpg", alt: "An elderly Bodo man", caption: "Kokrajhar district", category: "bodoland", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },
  { src: "/img/gallery/kokrajhar-rail.jpg", alt: "Kokrajhar railway station building", caption: "Kokrajhar station — public installation duty", category: "bodoland", credit: "Wikimedia Commons", licence: "CC0" },
  { src: "/img/gallery/kokrajhar-med.jpg", alt: "Kokrajhar Medical College and cancer care centre", caption: "Kokrajhar Medical College", category: "bodoland", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },
  { src: "/img/gallery/kokrajhar-eve.jpg", alt: "Evening at Kokrajhar Medical College", caption: "Evening handover, hospital posting", category: "operations", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },
  { src: "/img/gallery/manas.jpg", alt: "Manas National Park landscape", caption: "Manas — the northern edge of our coverage", category: "bodoland", credit: "Wikimedia Commons", licence: "CC BY 3.0", tall: true },
  { src: "/img/gallery/manas-2.jpg", alt: "Grassland and forest in Manas National Park", caption: "Grassland boundary, Baksa district", category: "bodoland", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },
  { src: "/img/gallery/rubber.jpg", alt: "Rubber sheets drying in Kokrajhar district", caption: "Rubber sheets drying — plantation client site", category: "operations", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },
  { src: "/img/gallery/marigold.jpg", alt: "Marigolds in bloom in Kokrajhar", caption: "Horticulture upkeep, Kokrajhar", category: "community", credit: "Wikimedia Commons", licence: "CC BY 4.0" },
  { src: "/img/services/mall.jpg", alt: "Interior of a shopping mall", caption: "Retail floor, closing sweep", category: "operations", credit: "shankar s.", licence: "CC BY 2.0" },
  { src: "/img/services/warehouse.jpg", alt: "Warehouse and logistics facility", caption: "Dock supervision, distribution centre", category: "operations", credit: "tm-md", licence: "CC BY 2.0" },
  { src: "/img/services/housekeeping.jpg", alt: "Housekeeping staff at work", caption: "Housekeeping cycle, morning", category: "operations", credit: "vastateparksstaff", licence: "CC BY 2.0" },
];

export function photosIn(category?: string): Photo[] {
  const c = (category ?? "").trim().toLowerCase();
  if (!c || c === "all") return gallery;
  return gallery.filter((p) => p.category === c);
}

export type Client = {
  name: string;
  sector: string;
  since: string;
  sites: number;
};

/** Sector descriptions rather than real trademarks — see the README. */
export const clients: Client[] = [
  { name: "Regional cooperative bank", sector: "Banking & finance", since: "2013", sites: 11 },
  { name: "District multi-speciality hospital", sector: "Healthcare", since: "2016", sites: 3 },
  { name: "Degree college, Chirang", sector: "Education", since: "2017", sites: 2 },
  { name: "Rice milling cluster, Gossaigaon", sector: "Manufacturing", since: "2009", sites: 6 },
  { name: "Tea estate group, Udalguri", sector: "Plantations", since: "2018", sites: 4 },
  { name: "Retail chain, Lower Assam", sector: "Retail", since: "2019", sites: 14 },
  { name: "Distribution warehouse operator", sector: "Logistics", since: "2020", sites: 5 },
  { name: "Housing society federation", sector: "Residential", since: "2015", sites: 9 },
  { name: "Public sector undertaking, BTR", sector: "Government & PSU", since: "2021", sites: 7 },
  { name: "Hotel and resort group", sector: "Hospitality", since: "2019", sites: 3 },
  { name: "Infrastructure contractor", sector: "Construction", since: "2022", sites: 8 },
  { name: "Higher secondary school network", sector: "Education", since: "2014", sites: 6 },
  { name: "Cold storage operator, Dhubri", sector: "Logistics", since: "2021", sites: 2 },
  { name: "Diagnostic chain, Bongaigaon", sector: "Healthcare", since: "2023", sites: 4 },
  { name: "Fuel station network", sector: "Retail", since: "2017", sites: 12 },
  { name: "Agro processing unit", sector: "Manufacturing", since: "2020", sites: 2 },
];

export type Vacancy = {
  id: string;
  title: string;
  type: string;
  location: string;
  openings: number;
  pay: string;
  experience: string;
  summary: string;
  requirements: string[];
};

export const vacancies: Vacancy[] = [
  {
    id: "sg-kkj",
    title: "Security Guard",
    type: "Full-time",
    location: "Kokrajhar & Chirang",
    openings: 60,
    pay: "As per Assam minimum wage + EPF, ESI, bonus",
    experience: "Freshers welcome",
    summary: "Gate, floor and perimeter duty on commercial, industrial and institutional sites. Twenty-one day paid induction before first posting.",
    requirements: ["Age 21–45, physically fit", "Class VIII pass or above", "Height 168 cm and above (relaxable for ST candidates)", "Aadhaar, address proof and two references", "Willing to work rotating shifts"],
  },
  {
    id: "lg-btr",
    title: "Lady Security Guard",
    type: "Full-time",
    location: "All five BTR districts",
    openings: 35,
    pay: "As per Assam minimum wage + EPF, ESI, bonus",
    experience: "Freshers welcome",
    summary: "Frisking, hostel, ward and retail floor duty. Postings are only made to sites with separate rest and changing facilities.",
    requirements: ["Age 20–45, physically fit", "Class VIII pass or above", "Aadhaar, address proof and two references", "Day-shift and general-shift postings available", "Local candidates from BTR districts preferred"],
  },
  {
    id: "sup-btr",
    title: "Security Supervisor",
    type: "Full-time",
    location: "Kokrajhar, Baksa, Udalguri",
    openings: 12,
    pay: "₹16,000 – ₹21,000 per month",
    experience: "2+ years in guarding",
    summary: "Runs the muster, the shift handover and the site register for a cluster of postings. First escalation point for the guards on site.",
    requirements: ["Two years or more as a security guard", "Class X pass", "Able to write a clear incident report in Assamese or English", "Two-wheeler licence preferred", "Ex-servicemen and ex-police strongly encouraged"],
  },
  {
    id: "fo-btr",
    title: "Field Officer",
    type: "Full-time",
    location: "Kokrajhar (roving)",
    openings: 5,
    pay: "₹22,000 – ₹28,000 per month + travel",
    experience: "3+ years in security operations",
    summary: "Owns a district cluster: surprise checks, reliever placement, client liaison and monthly compliance reporting.",
    requirements: ["Three years in security or facility operations", "Graduate preferred, Class XII minimum", "Valid two-wheeler or four-wheeler licence", "Comfortable with night surprise checks", "Fluent in Bodo and Assamese"],
  },
  {
    id: "cro-kkj",
    title: "Control Room Operator",
    type: "Full-time",
    location: "Kokrajhar HQ",
    openings: 6,
    pay: "₹15,000 – ₹19,000 per month",
    experience: "1+ year preferred",
    summary: "Works the beat check-in board, logs incidents and drives the escalation ladder on the night shift.",
    requirements: ["Class XII pass with basic computer skills", "Comfortable on rotating night shifts", "Clear telephone manner in Bodo, Assamese and Hindi", "Able to maintain an accurate written log", "CCTV monitoring experience an advantage"],
  },
  {
    id: "hk-btr",
    title: "Housekeeping Staff",
    type: "Full-time",
    location: "Kokrajhar, Bongaigaon",
    openings: 40,
    pay: "As per Assam minimum wage + EPF, ESI, bonus",
    experience: "Freshers welcome",
    summary: "Daily and periodic cleaning cycles on office, hospital and institutional sites, working to a signed checklist.",
    requirements: ["Age 18–50, physically fit", "No formal education requirement", "Aadhaar and address proof", "Training provided on machines and chemicals", "Male and female candidates both welcome"],
  },
  {
    id: "drv-btr",
    title: "Driver (LMV / HMV)",
    type: "Full-time",
    location: "Kokrajhar, Guwahati",
    openings: 8,
    pay: "₹14,000 – ₹20,000 per month",
    experience: "2+ years driving",
    summary: "Client vehicle, ambulance and logistics duty. Licence is verified with the issuing RTO before placement.",
    requirements: ["Valid LMV or HMV licence, minimum two years old", "Clean police record", "Passes a practical assessment on the vehicle class", "Knowledge of BTR and Lower Assam routes", "Willing to work extended duty when required"],
  },
  {
    id: "tech-kkj",
    title: "Electronic Security Technician",
    type: "Full-time",
    location: "Kokrajhar HQ",
    openings: 4,
    pay: "₹18,000 – ₹26,000 per month",
    experience: "1+ year in CCTV/networking",
    summary: "Installs and commissions CCTV, access control and fire alarm systems, and supports the control room feed.",
    requirements: ["ITI or diploma in electronics/electrical", "Hands-on with IP cameras, NVRs and cabling", "Basic networking — IP addressing, switches, PoE", "Comfortable with height and ladder work", "Willing to travel across BTR districts"],
  },
];

export function vacancyById(id: string): Vacancy | undefined {
  return vacancies.find((v) => v.id === id);
}

export function totalOpenings(): number {
  return vacancies.reduce((n, v) => n + v.openings, 0);
}

export type TrainingModule = {
  code: string;
  title: string;
  days: string;
  body: string;
};

/** The twenty-one day induction programme. */
export const syllabus: TrainingModule[] = [
  { code: "M1", title: "Bearing, uniform and conduct", days: "Days 1–3", body: "Turnout, saluting, standing a post, addressing clients and the public, and the conduct rules that get a guard removed from site." },
  { code: "M2", title: "Access and visitor control", days: "Days 4–6", body: "Visitor registers, gate passes, material movement, vehicle checks, frisking protocol and the correct way to refuse entry." },
  { code: "M3", title: "Patrolling and observation", days: "Days 7–9", body: "Beat discipline, checkpoint punching, randomising a round, what to look at on a perimeter and how to describe it afterwards." },
  { code: "M4", title: "Fire response and evacuation", days: "Days 10–12", body: "Extinguisher classes and live use, hydrant and hose drill, raising an alarm, assembly points and assisting an evacuation." },
  { code: "M5", title: "First aid and medical emergency", days: "Days 13–14", body: "Bleeding control, CPR basics, fracture immobilisation, heatstroke and snakebite response, and calling an ambulance correctly." },
  { code: "M6", title: "Incident reporting", days: "Days 15–16", body: "Writing an occurrence entry, a shift handover and an incident report that will still make sense to a client or a court six months later." },
  { code: "M7", title: "Law, rights and de-escalation", days: "Days 17–18", body: "Powers and limits of a private guard, detention and citizen's arrest, evidence preservation, and de-escalating an angry crowd." },
  { code: "M8", title: "Site-specific attachment", days: "Days 19–21", body: "Supervised duty on the actual posting alongside an experienced guard, ending in a sign-off by the field officer before independent deployment." },
];

export const educationOptions = [
  "Below Class VIII",
  "Class VIII",
  "Class X",
  "Class XII",
  "Diploma / ITI",
  "Graduate",
  "Post-graduate",
] as const;

export const startWhenOptions = [
  "Immediately",
  "Within a month",
  "Within three months",
  "Just planning",
] as const;
