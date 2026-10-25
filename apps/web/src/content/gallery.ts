/** Gallery photographs, vacancies and the training programme. */

export type Photo = {
  src: string;
  alt: string;
  caption: string;
  category: "operations" | "training" | "events" | "team";
  credit: string;
  /** Absent on NBSS's own photographs — there is no third-party licence to name. */
  licence?: string;
  /** True for photographs supplied by NBSS (all of them, today). */
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
  { slug: "events", label: "Events" },
  { slug: "team", label: "Our people" },
];

const NBSS = "National Bodo Security Service";

/**
 * Every photograph here is NBSS's own: our guards, our sites, our training. The
 * first ones are the strongest, because they lead every filtered view and the
 * homepage strip.
 */
export const gallery: Photo[] = [
  // ------------------------------------------------- supplied by the client
  {
    src: "/img/nbss/parade-salute.webp",
    alt: "NBSS guards standing at attention in formation, saluting during evening parade",
    caption: "Evening parade: turnout and salute",
    category: "training",
    credit: NBSS,
    own: true,
    tall: true,
  },
  {
    src: "/img/nbss/guards-on-duty.webp",
    alt: "Three NBSS guards in uniform and reflective harness on duty at the entrance of a public building",
    caption: "Gate duty at a public building, Kokrajhar",
    category: "operations",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/parade-night.webp",
    alt: "A large formation of NBSS guards saluting while an officer takes the parade",
    caption: "Parade inspection, full strength on the ground",
    category: "training",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/parade-ranks.webp",
    alt: "NBSS guards drawn up in ranks with batons during parade drill",
    caption: "Drill ranks: bearing, spacing and discipline",
    category: "training",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/training-classroom.webp",
    alt: "NBSS guards seated for a classroom training session",
    caption: "Classroom session, guards on the mat",
    category: "training",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/training-briefing.webp",
    alt: "An Assam police officer briefing NBSS guards during an emergency response training session",
    caption: "Emergency response briefing with SDRF Assam",
    category: "training",
    credit: NBSS,
    own: true,
    tall: true,
  },
  {
    src: "/img/nbss/training-demo.webp",
    alt: "SDRF Assam instructors demonstrating rescue equipment to NBSS guards",
    caption: "Rescue equipment demonstration, SDRF Assam",
    category: "training",
    credit: NBSS,
    own: true,
  },

  {
    src: "/img/nbss/stadium-night.webp",
    alt: "NBSS guards drawn up on the running track of a floodlit stadium before an event",
    caption: "Stadium duty, the evening before the gates open",
    category: "events",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/assembly-road.webp",
    alt: "More than a hundred NBSS guards assembled in rows on a road",
    caption: "Full strength, assembled before deployment",
    category: "team",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/hall-gate.webp",
    alt: "Three NBSS guards in reflective vests at the steps of a large domed hall",
    caption: "Posted at the steps of a public hall",
    category: "operations",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/guard-portrait.webp",
    alt: "An NBSS guard in full uniform and cap",
    caption: "Turned out for the shift",
    category: "team",
    credit: NBSS,
    own: true,
    tall: true,
  },
  {
    src: "/img/nbss/field-formation.webp",
    alt: "A long line of NBSS guards on a sports ground under a clear sky",
    caption: "On the ground, the whole company",
    category: "training",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/line-women.webp",
    alt: "NBSS guards, women in front, lined up at a building entrance",
    caption: "Women guards, posted at an entrance",
    category: "operations",
    credit: NBSS,
    own: true,
    tall: true,
  },
  {
    src: "/img/nbss/stadium-ranks.webp",
    alt: "NBSS guards in ranks inside a stadium, the stands behind them",
    caption: "Briefing at the stadium, every post assigned",
    category: "events",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/batch-officers.webp",
    alt: "An NBSS batch standing behind its seated officers",
    caption: "A batch with its officers",
    category: "team",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/flag-hoisting.webp",
    alt: "NBSS guards at a flag hoisting in front of a showroom",
    caption: "Flag hoisting at a client's showroom",
    category: "events",
    credit: NBSS,
    own: true,
    tall: true,
  },
  {
    src: "/img/nbss/classroom-recruits.webp",
    alt: "Recruits seated for a classroom session",
    caption: "Recruits, first day in the classroom",
    category: "training",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/vest-team.webp",
    alt: "Five NBSS guards in reflective vests standing indoors",
    caption: "Night team, high-visibility vests on",
    category: "operations",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/woman-guard.webp",
    alt: "A woman NBSS guard on duty at a water park",
    caption: "Poolside post at a water park",
    category: "operations",
    credit: NBSS,
    own: true,
    tall: true,
  },
  {
    src: "/img/nbss/stadium-line.webp",
    alt: "A single line of NBSS guards across a stadium track",
    caption: "One line, every post covered",
    category: "events",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/construction-guard.webp",
    alt: "An NBSS guard in a reflective vest at a construction site",
    caption: "Construction site, material gate",
    category: "operations",
    credit: NBSS,
    own: true,
    tall: true,
  },
  {
    src: "/img/nbss/batch-hall.webp",
    alt: "An NBSS batch in a red-brick hall with an officer seated in front",
    caption: "Passing out, a new batch",
    category: "training",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/waterpark-team.webp",
    alt: "NBSS guards and managers in front of a water park sculpture",
    caption: "With the client's team at a water park",
    category: "operations",
    credit: NBSS,
    own: true,
    tall: true,
  },
  {
    src: "/img/nbss/hall-wide.webp",
    alt: "A domed public hall with NBSS guards posted at the foot of its steps",
    caption: "A public hall, guarded from the steps",
    category: "operations",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/batch-grass.webp",
    alt: "Two rows of NBSS guards standing on grass",
    caption: "Drill, two ranks",
    category: "training",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/formation-trees.webp",
    alt: "NBSS guards in formation under trees",
    caption: "Morning fall-in",
    category: "training",
    credit: NBSS,
    own: true,
    tall: true,
  },
  {
    src: "/img/nbss/classroom-desk.webp",
    alt: "Recruits at a training table with forms and folders",
    caption: "Documents and verification, before any posting",
    category: "training",
    credit: NBSS,
    own: true,
  },
  {
    src: "/img/nbss/flag-day.webp",
    alt: "A flag hoisting ceremony with NBSS guards in the background",
    caption: "Independence Day at a client's site",
    category: "events",
    credit: NBSS,
    own: true,
    tall: true,
  },
  {
    src: "/img/nbss/woman-guard-2.webp",
    alt: "A woman NBSS guard in uniform at her post",
    caption: "On post, eyes on the gate",
    category: "team",
    credit: NBSS,
    own: true,
    tall: true,
  },
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
    body: "Bleeding control, basic resuscitation, fracture immobilisation and calling for an ambulance correctly, enough to be useful in the minutes before help arrives.",
  },
  {
    code: "05",
    title: "Access control and gate management",
    body: "Visitor entry, material and vehicle movement, frisking protocol, and the correct, and calm, way to refuse entry to someone who should not have it.",
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
