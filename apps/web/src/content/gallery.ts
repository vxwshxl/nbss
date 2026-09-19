/** Gallery photographs, vacancies and the training programme. */

export type Photo = {
  src: string;
  alt: string;
  caption: string;
  category: "operations" | "training" | "bodoland" | "community";
  credit: string;
  /** Absent on NBSS's own photographs — there is no third-party licence to name. */
  licence?: string;
  /** True for photographs supplied by NBSS, as opposed to licensed stock. */
  own?: boolean;
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

const NBSS = "National Bodo Security Service";

/**
 * NBSS's own photographs lead the array so they surface first in every filtered
 * view and in the homepage strip. The licensed stock photographs that follow
 * carry a mandatory attribution line — see CREDITS.md.
 */
export const gallery: Photo[] = [
  // ------------------------------------------------- supplied by the client
  {
    src: "/img/nbss/parade-salute.jpg",
    alt: "NBSS guards standing at attention in formation, saluting during evening parade",
    caption: "Evening parade — turnout and salute",
    category: "training",
    credit: NBSS,
    own: true,
    tall: true,
  },
  {
    src: "/img/nbss/guards-on-duty.jpg",
    alt: "Three NBSS guards in uniform and reflective harness on duty at the entrance of a public building",
    caption: "Gate duty at a public building, Kokrajhar",
    category: "operations",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/parade-night.jpg",
    alt: "A large formation of NBSS guards saluting while an officer takes the parade",
    caption: "Parade inspection, full strength on the ground",
    category: "training",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/parade-ranks.jpg",
    alt: "NBSS guards drawn up in ranks with batons during parade drill",
    caption: "Drill ranks — bearing, spacing and discipline",
    category: "training",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/training-classroom.jpg",
    alt: "NBSS guards seated for a classroom training session",
    caption: "Classroom session, guards on the mat",
    category: "training",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/training-briefing.jpg",
    alt: "An Assam police officer briefing NBSS guards during an emergency response training session",
    caption: "Emergency response briefing with SDRF Assam",
    category: "training",
    credit: NBSS,
    own: true,
    tall: true,
  },
  {
    src: "/img/nbss/training-demo.jpg",
    alt: "SDRF Assam instructors demonstrating rescue equipment to NBSS guards",
    caption: "Rescue equipment demonstration, SDRF Assam",
    category: "training",
    credit: NBSS,
    own: true,
  },

  // ---------------------------------------------- licensed stock, attributed
  { src: "/img/hero-guard.jpg", alt: "A uniformed security guard on duty at a campus gate", caption: "Gate duty, morning shift", category: "operations", credit: "liber(the poet)", licence: "CC BY-SA 2.0" },
  { src: "/img/ops-team.jpg", alt: "A security team standing in formation", caption: "Shift briefing before deployment", category: "operations", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },
  { src: "/img/ops-fire-training.jpg", alt: "Fire safety training with an extinguisher", caption: "Fire response training", category: "training", credit: "BLM Oregon & Washington", licence: "CC BY-SA 2.0" },
  { src: "/img/ops-bank.jpg", alt: "A security guard posted outside a bank", caption: "Branch posting, opening drill", category: "operations", credit: "Brad & Ying", licence: "CC BY 2.0" },
  { src: "/img/services/mall.jpg", alt: "Interior of a shopping mall", caption: "Retail floor, closing sweep", category: "operations", credit: "shankar s.", licence: "CC BY 2.0" },
  { src: "/img/services/warehouse.jpg", alt: "Warehouse and logistics facility", caption: "Dock supervision, warehouse posting", category: "operations", credit: "tm-md", licence: "CC BY 2.0" },
  { src: "/img/gallery/kokrajhar-eve.jpg", alt: "Evening at Kokrajhar Medical College", caption: "Evening handover, hospital posting", category: "operations", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },

  { src: "/img/gallery/aronai.jpg", alt: "An Aronai, the traditional woven Bodo scarf", caption: "The Aronai — the woven band our identity is drawn from", category: "bodoland", credit: "Wikimedia Commons", licence: "CC BY 4.0", tall: true },
  { src: "/img/gallery/aronai-2.jpg", alt: "Detail of Aronai weaving showing diamond motifs", caption: "Diamond motif, hand-loomed", category: "bodoland", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },
  { src: "/img/gallery/bodo-women.jpg", alt: "Bodo women in traditional dokhona", caption: "The community our women guards are recruited from", category: "bodoland", credit: "Wikimedia Commons", licence: "CC BY-SA 3.0" },
  { src: "/img/gallery/bodo-elder.jpg", alt: "An elderly Bodo man", caption: "Kokrajhar district", category: "bodoland", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },
  { src: "/img/gallery/kokrajhar-rail.jpg", alt: "Kokrajhar railway station building", caption: "Kokrajhar station", category: "bodoland", credit: "Wikimedia Commons", licence: "CC0" },
  { src: "/img/gallery/kokrajhar-med.jpg", alt: "Kokrajhar Medical College and cancer care centre", caption: "Kokrajhar Medical College", category: "bodoland", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },
  { src: "/img/gallery/manas.jpg", alt: "Manas National Park landscape", caption: "Manas — the northern edge of the region", category: "bodoland", credit: "Wikimedia Commons", licence: "CC BY 3.0", tall: true },
  { src: "/img/gallery/manas-2.jpg", alt: "Grassland and forest in Manas National Park", caption: "Grassland boundary, Baksa district", category: "bodoland", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },

  { src: "/img/gallery/bagurumba-1.jpg", alt: "Bodo women performing the Bagurumba dance", caption: "Bagurumba — the butterfly dance", category: "community", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },
  { src: "/img/gallery/bagurumba-2.jpg", alt: "Bagurumba dancers in traditional dokhona", caption: "Festival ground, Bwisagu week", category: "community", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },
  { src: "/img/gallery/bagurumba-3.jpg", alt: "A Bagurumba performance in progress", caption: "Crowd management at a cultural meet", category: "community", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0", tall: true },
  { src: "/img/gallery/bwisagu.jpg", alt: "Bwisagu festival dance performance", caption: "Bwisagu — the Bodo new year", category: "community", credit: "Wikimedia Commons", licence: "CC BY-SA 4.0" },
  { src: "/img/gallery/bardoi-sikhla.jpg", alt: "Bodo girls performing the Bardoi Sikhla dance", caption: "Bardoi Sikhla, harvest season", category: "community", credit: "Wikimedia Commons", licence: "CC BY 2.0" },
  { src: "/img/gallery/marigold.jpg", alt: "Marigolds in bloom in Kokrajhar", caption: "Kokrajhar in bloom", category: "community", credit: "Wikimedia Commons", licence: "CC BY 4.0" },
];

export function photosIn(category?: string): Photo[] {
  const c = (category ?? "").trim().toLowerCase();
  if (!c || c === "all") return gallery;
  return gallery.filter((p) => p.category === c);
}

/** NBSS's own photographs, for the places that should never show stock. */
export function ownPhotos(): Photo[] {
  return gallery.filter((p) => p.own);
}

export type Vacancy = {
  id: string;
  title: string;
  type: string;
  location: string;
  pay: string;
  experience: string;
  summary: string;
  requirements: string[];
};

/**
 * Roles NBSS recruits for. No opening counts and no salary bands are published
 * here — neither has been confirmed by the client, and a wrong figure on a job
 * page is the kind of thing a candidate travels a long way on.
 */
export const vacancies: Vacancy[] = [
  {
    id: "security-guard",
    title: "Security Guard",
    type: "Full-time",
    location: "Kokrajhar, Chirang, Baksa, Udalguri and nearby districts",
    pay: "As per applicable wage, with ESI and EPF as applicable",
    experience: "Freshers welcome",
    summary:
      "Gate, floor and perimeter duty at offices, institutions, banks, hospitals, factories and commercial premises. Training is provided before your first posting.",
    requirements: [
      "Physically fit and willing to work rotating shifts",
      "Able to produce Aadhaar and address proof",
      "Police verification will be completed before deployment",
      "Basic reading and writing for the duty register",
      "Local candidates from the BTC districts preferred",
    ],
  },
  {
    id: "lady-security-guard",
    title: "Lady Security Guard",
    type: "Full-time",
    location: "Kokrajhar and nearby districts",
    pay: "As per applicable wage, with ESI and EPF as applicable",
    experience: "Freshers welcome",
    summary:
      "Frisking, hostel, ward, retail floor and event entry duty. Postings are made to sites where separate rest and changing facilities are available.",
    requirements: [
      "Physically fit and willing to work assigned shifts",
      "Able to produce Aadhaar and address proof",
      "Police verification will be completed before deployment",
      "Day and general shift postings available",
      "Local candidates from the BTC districts preferred",
    ],
  },
  {
    id: "security-supervisor",
    title: "Security Supervisor",
    type: "Full-time",
    location: "Kokrajhar, Chirang, Baksa, Udalguri",
    pay: "As per role and experience, with ESI and EPF as applicable",
    experience: "Prior guarding experience required",
    summary:
      "Runs the muster, the shift handover and the site register for a cluster of postings, and is the first escalation point for the guards on site.",
    requirements: [
      "Previous experience as a security guard",
      "Able to write a clear incident report in Assamese, Bodo or English",
      "Comfortable conducting shift-change and turnout checks",
      "Two-wheeler licence preferred",
      "Ex-servicemen and ex-police strongly encouraged",
    ],
  },
  {
    id: "field-officer",
    title: "Field Officer",
    type: "Full-time",
    location: "Kokrajhar (roving across districts)",
    pay: "As per role and experience, with ESI and EPF as applicable",
    experience: "Experience in security operations required",
    summary:
      "Owns a district cluster: surprise checks, replacement placement, client liaison and reporting back to the office on how each site is actually running.",
    requirements: [
      "Experience in security or site operations",
      "Valid two-wheeler or four-wheeler licence",
      "Comfortable with night surprise checks",
      "Fluent in Bodo and Assamese",
      "Able to handle client conversations directly",
    ],
  },
];

export function vacancyById(id: string): Vacancy | undefined {
  return vacancies.find((v) => v.id === id);
}

export type TrainingModule = {
  code: string;
  title: string;
  body: string;
};

/** The six training areas named in the company profile. */
export const syllabus: TrainingModule[] = [
  {
    code: "01",
    title: "Basic security & guarding duties",
    body: "Standing a post, holding a visitor register, checking a gate pass, challenging an outsider, and the conduct rules that get a guard removed from a site.",
  },
  {
    code: "02",
    title: "Physical fitness and parade",
    body: "Turnout, drill, saluting and bearing. Parade is where discipline is visible, and it is the part a client sees at the gate every morning.",
  },
  {
    code: "03",
    title: "Fire safety & emergency response",
    body: "Extinguisher classes and use, raising an alarm, assembly points, and assisting an evacuation without adding to the panic.",
  },
  {
    code: "04",
    title: "First-aid support",
    body: "Bleeding control, basic resuscitation, fracture immobilisation and calling for an ambulance correctly — enough to be useful in the minutes before help arrives.",
  },
  {
    code: "05",
    title: "Access control and gate management",
    body: "Visitor entry, material and vehicle movement, frisking protocol, and the correct — and calm — way to refuse entry to someone who should not have it.",
  },
  {
    code: "06",
    title: "Crowd control & discipline",
    body: "Queue and barricade handling, de-escalating an angry group, and keeping a lane open at an event or a hospital entrance when it matters most.",
  },
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
