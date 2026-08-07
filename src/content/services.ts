/**
 * The service catalogue.
 *
 * This mirrors the "Our Services" section of the company profile exactly: NBSS
 * supplies trained security personnel, and these are the nine kinds of site it
 * supplies them to. There is deliberately no facility-management, contract-
 * staffing or electronic-security division here — the client's profile does not
 * claim any of those, so the site does not advertise them.
 */

export type Accent = "green" | "gold" | "rust" | "sky";

export type Service = {
  slug: string;
  name: string;
  summary: string;
  detail: string;
  icon: string;
  image: string;
  accent: Accent;
  /** What the posting covers. */
  scope: string[];
  /** The kinds of premises this posting is deployed at. */
  fit: string[];
  featured?: boolean;
};

export const services: Service[] = [
  {
    slug: "education-security",
    name: "Schools, Colleges & Universities",
    summary: "Gate control, campus watch and examination duty for educational institutions.",
    detail:
      "A campus posting is a child-safety posting before it is anything else. Guards on school, college and university sites are police-verified like every other person on our roll, and are briefed on the one rule that matters at a school gate: a child leaves with a listed guardian or does not leave. Women guards handle girls' hostel gates and examination-hall frisking. Vehicle discipline at drop-off and pick-up is part of the duty, not an extra.",
    icon: "book",
    image: "/img/gallery/kokrajhar-med.jpg",
    accent: "green",
    featured: true,
    scope: [
      "Main gate and visitor entry control",
      "Guardian-verified student release at closing",
      "Women guards for girls' hostel and frisking duty",
      "Examination-hall entry and material control",
      "School bus and drop-off marshalling",
      "Night rounds on hostel and campus boundary",
    ],
    fit: [
      "Schools and higher secondary institutions",
      "Degree and technical colleges",
      "University campuses and hostels",
      "Coaching centres and examination venues",
    ],
  },
  {
    slug: "hospital-security",
    name: "Hospitals & Nursing Homes",
    summary: "Calm, trained cover for casualty, wards, pharmacy and reception areas.",
    detail:
      "A hospital guard's hardest hour is the one after a bad admission. Casualty postings are briefed on de-escalation and on holding a corridor without raising the temperature of a frightened family. Ward, pharmacy and stores duty runs on attendant passes and visiting-hour discipline rather than on argument. Guards are trained in first-aid support, which on a hospital site is occasionally the difference that counts.",
    icon: "cross",
    image: "/img/services/hospital.jpg",
    accent: "rust",
    featured: true,
    scope: [
      "Casualty and emergency-entrance control",
      "Attendant pass issue and visiting-hour enforcement",
      "De-escalation with agitated attendants",
      "Pharmacy, stores and records access control",
      "Ambulance bay and parking clearance",
      "Women guards for female ward duty",
    ],
    fit: [
      "Multi-speciality and district hospitals",
      "Nursing homes and clinics",
      "Diagnostic centres and blood banks",
      "Medical college campuses",
    ],
  },
  {
    slug: "government-security",
    name: "Government Offices & PSUs",
    summary: "Disciplined, documented guarding for departments, boards and public installations.",
    detail:
      "Government postings are held to the department's paperwork, not to ours. We deploy to the sanctioned manpower schedule, keep the attendance and wage records the department will ask to inspect, and brief personnel on the office's own visitor and grievance procedure before the first shift. Registration under the Government of Assam, GST and labour compliance are in place, and documents are shared when a contract is being finalised.",
    icon: "landmark",
    image: "/img/nbss/guards-on-duty.jpg",
    accent: "gold",
    featured: true,
    scope: [
      "Deployment to the sanctioned manpower schedule",
      "Attendance and wage registers kept on site",
      "Public counter and visitor-desk briefing",
      "Records room and store access control",
      "Council, board and institutional premises cover",
      "Compliance documents available on request",
    ],
    fit: [
      "BTC and state government offices",
      "Public sector undertakings and boards",
      "Public institutions and district offices",
      "Water, power and transport installations",
    ],
  },
  {
    slug: "bank-atm-security",
    name: "Banks & ATMs",
    summary: "Branch guarding, cash-counter watch and ATM site cover under written protocol.",
    detail:
      "Bank postings run on protocol, not initiative. Opening and closing follow a written sequence, the cash counter and strong-room corridor stay under watch through banking hours, and the alarm check is done and logged daily rather than assumed. Every guard on a bank posting is police-verified and briefed on the branch's specific shutter and alarm arrangement before standing the first shift.",
    icon: "bank",
    image: "/img/ops-bank.jpg",
    accent: "sky",
    featured: true,
    scope: [
      "Written branch opening and closing drill",
      "Cash counter and strong-room corridor watch",
      "Customer bag deposit and entry control",
      "Daily alarm and shutter check with signed log",
      "ATM site guarding and cash-loading cover",
      "Queue and crowd handling on collection days",
    ],
    fit: [
      "Commercial and cooperative bank branches",
      "Standalone and offsite ATM kiosks",
      "Credit societies and microfinance centres",
      "Cash collection and disbursement points",
    ],
  },
  {
    slug: "hotel-resort-security",
    name: "Hotels & Resorts",
    summary: "Discreet lobby, banquet and guest-floor cover that does not feel like security.",
    detail:
      "Hospitality guarding is deliberately quiet. Personnel are groomed and briefed to guest-facing standards, work the lobby and porch without crowding arrivals, and handle banquet and function crowds by anticipating rather than intervening. Guest-floor rounds, key discipline and back-of-house material checks run in the background where the guest does not see them.",
    icon: "bell",
    image: "/img/gallery/manas.jpg",
    accent: "gold",
    scope: [
      "Lobby, porch and driveway cover",
      "Banquet and function-hall crowd management",
      "Guest-floor rounds and key-control discipline",
      "Back-of-house material movement checks",
      "Staff entry frisking and locker checks",
      "Parking and vehicle flow at arrival",
    ],
    fit: [
      "Hotels, resorts and guest houses",
      "Banquet halls and convention venues",
      "Restaurants and bar operations",
      "Tourist lodges and homestays",
    ],
  },
  {
    slug: "retail-mall-security",
    name: "Shopping Malls & Showrooms",
    summary: "Loss prevention, crowd flow and closing-time discipline for retail floors.",
    detail:
      "Retail security is loss prevention with a smile fixed on. Floor personnel work bag deposit at entry, tag checks at exit, fitting-room counts and the closing sweep. On mall sites we add parking marshalling, escalator and atrium watch, and a lost-child routine the customer-service desk is briefed on alongside our guards.",
    icon: "cart",
    image: "/img/services/mall.jpg",
    accent: "rust",
    featured: true,
    scope: [
      "Entry bag deposit and exit verification",
      "Fitting-room and high-value counter watch",
      "Floor patrol during trading hours",
      "Parking marshalling and vehicle flow",
      "Lost-child and medical-emergency routine",
      "Closing sweep and shutter handover",
    ],
    fit: [
      "Shopping malls and arcades",
      "Supermarkets and department stores",
      "Jewellery, electronics and apparel showrooms",
      "Fuel stations and convenience retail",
    ],
  },
  {
    slug: "industrial-warehouse-security",
    name: "Companies, Factories & Warehouses",
    summary: "Gate, perimeter and material-movement control for offices, plants and godowns.",
    detail:
      "Industrial loss rarely walks in through the front gate — it leaves through it, on a truck, with paperwork that nearly matches. Our postings on company premises, factories and warehouses are built around gate-pass control, material inward and outward checks, shift-change discipline and a perimeter round that is not run to a timetable anyone watching can predict.",
    icon: "factory",
    image: "/img/services/warehouse.jpg",
    accent: "green",
    featured: true,
    scope: [
      "Manned main gate with inward and outward gate passes",
      "Material and vehicle movement verification",
      "Perimeter beats on a varied interval",
      "Shift-change frisking of workmen",
      "Stores, scrap yard and loading bay watch",
      "Contractor labour headcount at entry and exit",
    ],
    fit: [
      "Corporate and branch offices",
      "Factories, mills and processing units",
      "Warehouses, godowns and cold storage",
      "Transport yards and distribution depots",
    ],
  },
  {
    slug: "construction-residential-security",
    name: "Construction Sites & Apartments",
    summary: "Material and machinery watch on live sites; visitor and vendor control at home.",
    detail:
      "A live construction site loses steel, cable and diesel, mostly at night and mostly in small quantities. We man the material gate against the challan, log machinery movement and patrol an unlit, changing site plan. Residential postings are the mirror image of the same discipline: resident-confirmed visitor entry, photo passes for domestic help and vendors, and a night round that actually reaches the back boundary.",
    icon: "helmet",
    image: "/img/services/construction.jpg",
    accent: "gold",
    scope: [
      "Material inward challan verification",
      "Machinery and equipment movement log",
      "Night patrol over unlit and changing site plans",
      "Labour entry and exit headcount",
      "Resident-confirmed visitor entry at apartments",
      "Photo-pass control for domestic help and vendors",
    ],
    fit: [
      "Building and infrastructure projects",
      "Road, bridge and embankment works",
      "Apartment complexes and housing societies",
      "Gated colonies and staff quarters",
    ],
  },
  {
    slug: "event-vip-protection",
    name: "Events & VIP Protection",
    summary: "Gate, barricade, stage and close-protection cover for functions and public events.",
    detail:
      "Event security is planned in the week before, not on the day. We walk the venue, mark entry and exit lanes, fix the barricade line, agree the stage and green-room cordon, and write an evacuation route the organiser signs off. On the day we deploy frisking lanes, pass verification, queue management and a named commander who owns every decision. Close-protection officers for individuals are selected for judgement and discretion rather than size.",
    icon: "flag",
    image: "/img/gallery/bagurumba-1.jpg",
    accent: "sky",
    featured: true,
    scope: [
      "Pre-event venue survey and deployment plan",
      "Entry frisking and pass or ticket verification",
      "Barricade line and queue management",
      "Stage, green-room and VIP cordon",
      "Close-protection officers for individuals",
      "Parking marshalling and a written evacuation route",
    ],
    fit: [
      "Festivals, fairs and cultural meets",
      "Weddings and social functions",
      "Political and public meetings",
      "Sports meets and exhibitions",
    ],
  },
];

// ------------------------------------------------------------------ lookups

export function serviceBySlug(slug: string): Service | undefined {
  return services.find((s) => s.slug === slug);
}

export function featuredServices(): Service[] {
  return services.filter((s) => s.featured);
}

export function relatedServices(service: Service, limit = 3): Service[] {
  return services.filter((s) => s.slug !== service.slug).slice(0, limit);
}

/**
 * Case-insensitive substring match over the fields a visitor is likely to type.
 * Deliberately naive: the catalogue is nine items long, so an index would cost
 * more than it saves — and this runs in the browser, so results are instant.
 */
export function searchServices(query: string): Service[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return services.filter((s) =>
    [s.name, s.summary, ...s.fit, ...s.scope].join(" ").toLowerCase().includes(q),
  );
}
