/**
 * Global company facts, used by the header, footer, JSON-LD and metadata.
 *
 * All editorial content lives in `src/content` as typed data rather than in a
 * CMS. The copy changes rarely, so keeping it here gives compile-time safety,
 * zero-latency rendering and a fully static build.
 */

export type Link = { label: string; url: string };

export type Credential = {
  label: string;
  number: string;
  body: string;
  note: string;
};

export const site = {
  name: "National Bodo Security Services",
  shortName: "NBSS",
  tagline: "Trained in Bodoland. Trusted across the Northeast.",
  descriptor:
    "A PSARA-licensed private security, facility management and manpower agency headquartered in Kokrajhar, the seat of the Bodoland Territorial Region.",
  founded: 2009,
  phone: "+91 98640 12345",
  phoneAlt: "+91 94351 67890",
  emergency: "+91 90850 00911",
  email: "contact@nbss.co.in",
  emailHr: "careers@nbss.co.in",
  address: {
    line1: "NBSS House, Jwhwlao Dwimalu Road",
    line2: "Near Bharat Petrol Pump, Ward No. 4",
    city: "Kokrajhar",
    state: "Assam (Bodoland Territorial Region)",
    pin: "783370",
    mapUrl:
      "https://www.openstreetmap.org/?mlat=26.4009&mlon=90.2711#map=14/26.4009/90.2711",
    lat: "26.4009",
    lng: "90.2711",
  },
  hours: [
    "Corporate office — Mon to Sat, 09:30 to 18:00",
    "Control room & deployment desk — 24 × 7 × 365",
  ],
  social: [
    { label: "Facebook", url: "#" },
    { label: "Instagram", url: "#" },
    { label: "LinkedIn", url: "#" },
    { label: "YouTube", url: "#" },
  ] satisfies Link[],
  licenses: [
    {
      label: "PSARA Licence",
      number: "PSARA/ASM/BTR/2009/0417",
      body: "Controlling Authority, Government of Assam",
      note: "Private Security Agencies (Regulation) Act, 2005",
    },
    {
      label: "ISO 9001:2015",
      number: "QMS/IN/22/8841",
      body: "Quality Management System",
      note: "Guarding, facility & manpower operations",
    },
    {
      label: "ESIC Registration",
      number: "11000456780000999",
      body: "Employees' State Insurance Corporation",
      note: "Every deployed person covered",
    },
    {
      label: "EPFO Registration",
      number: "ASGHT2209841000",
      body: "Employees' Provident Fund Organisation",
      note: "Monthly ECR filed before the 15th",
    },
    {
      label: "GSTIN",
      number: "18AABCN4417Q1ZP",
      body: "Goods & Services Tax",
      note: "Assam — state code 18",
    },
    {
      label: "Labour Licence",
      number: "CLRA/KKJ/2019/226",
      body: "Contract Labour (R&A) Act, 1970",
      note: "Renewed annually",
    },
  ] satisfies Credential[],
} as const;

/** Strips a phone number down to something a `tel:` href accepts. */
export function tel(value: string): string {
  return value.replace(/[\s\-()]/g, "");
}

export type Stat = {
  value: string;
  suffix: string;
  label: string;
  note: string;
};

export const stats: Stat[] = [
  { value: "1800", suffix: "+", label: "Trained personnel", note: "On the active deployment roll" },
  { value: "240", suffix: "+", label: "Client sites", note: "Guarded across the Northeast" },
  { value: "8", suffix: "", label: "Districts covered", note: "Five BTR districts plus three" },
  { value: "16", suffix: " yrs", label: "In operation", note: "Registered in 2009" },
  { value: "24", suffix: "×7", label: "Control room", note: "Never unstaffed, never outsourced" },
  { value: "96", suffix: "%", label: "Contract renewal", note: "Rolling three-year average" },
];

export type Pillar = {
  index: string;
  title: string;
  body: string;
  icon: string;
};

export const pillars: Pillar[] = [
  {
    index: "01",
    title: "Recruited from the region we protect",
    body: "Our guards come from Kokrajhar, Chirang, Baksa, Udalguri and Tamulpur. They know the roads, the dialects and the neighbours. A stranger at the gate is spotted by someone who actually knows who belongs there.",
    icon: "roots",
  },
  {
    index: "02",
    title: "Verified before they ever wear the uniform",
    body: "Aadhaar and address verification, police clearance from the home thana, two independent references and a medical fitness check. No candidate is deployed on a client site until the file is closed.",
    icon: "shield-check",
  },
  {
    index: "03",
    title: "Twenty-one days of drill, then never finished",
    body: "Foundation training covers access control, fire response, first aid, frisking protocol, incident reporting and conduct. Refresher drills run every quarter at the Kokrajhar training ground.",
    icon: "drill",
  },
  {
    index: "04",
    title: "Wages paid by the 7th, statutorily and in full",
    body: "EPF, ESI, bonus and leave encashment are calculated on the declared wage, not a fiction. A guard who is paid properly and on time is a guard who stays awake at 03:00.",
    icon: "rupee",
  },
  {
    index: "05",
    title: "A control room that answers on the second ring",
    body: "Every site checks in on a fixed beat. Missed check-ins escalate to the area field officer within ten minutes and to the duty manager within twenty. Escalation is a procedure, not a phone tree.",
    icon: "radio",
  },
  {
    index: "06",
    title: "One contract, the whole building",
    body: "Guarding, housekeeping, waste handling, electronic surveillance and skilled manpower under a single agreement, a single invoice and a single point of accountability.",
    icon: "layers",
  },
];

export type District = {
  name: string;
  region: string;
  sites: string;
  core: boolean;
};

export const coverage: District[] = [
  { name: "Kokrajhar", region: "Bodoland Territorial Region", sites: "HQ + 68 sites", core: true },
  { name: "Chirang", region: "Bodoland Territorial Region", sites: "31 sites", core: true },
  { name: "Baksa", region: "Bodoland Territorial Region", sites: "27 sites", core: true },
  { name: "Udalguri", region: "Bodoland Territorial Region", sites: "24 sites", core: true },
  { name: "Tamulpur", region: "Bodoland Territorial Region", sites: "16 sites", core: true },
  { name: "Bongaigaon", region: "Lower Assam", sites: "22 sites", core: false },
  { name: "Dhubri", region: "Lower Assam", sites: "18 sites", core: false },
  { name: "Kamrup (Guwahati)", region: "Lower Assam", sites: "34 sites", core: false },
];

/** District names accepted by the quote form, plus the catch-all option. */
export const districtOptions: string[] = [
  ...coverage.map((d) => d.name),
  "Elsewhere in the Northeast",
];

export type Milestone = { year: string; body: string };

export const timeline: Milestone[] = [
  { year: "2009", body: "Registered at Kokrajhar with 42 guards, two supervisors and a single Bolero. First contract: night guarding for a cluster of four rice mills on the Gossaigaon road." },
  { year: "2012", body: "PSARA licence granted by the Controlling Authority, Government of Assam. Formal twenty-one day induction syllabus written and adopted." },
  { year: "2015", body: "First lady-guard batch commissioned — twenty-four women trained for school, hospital and retail frisking duty." },
  { year: "2018", body: "Facility management division opened: housekeeping, waste handling and horticulture added to the guarding contract." },
  { year: "2020", body: "Kokrajhar control room commissioned. Beat check-ins, incident logging and escalation moved off paper registers." },
  { year: "2022", body: "Electronic security division launched — CCTV, access control and fire alarm integration for BFSI and industrial clients." },
  { year: "2024", body: "Crossed 1,500 personnel on roll. ISO 9001:2015 certification awarded for guarding and facility operations." },
  { year: "2026", body: "Guwahati branch office opened to serve Lower Assam clients without diluting the Bodoland recruitment base." },
];

export type Person = { name: string; role: string; bio: string };

export const leadership: Person[] = [
  { name: "Khampa Basumatary", role: "Managing Director", bio: "Founded NBSS in 2009 after fourteen years with a national guarding major in Guwahati. Signs off on every district-level deployment plan personally." },
  { name: "Rwmwi Narzary", role: "Director — Operations", bio: "Runs the control room, the beat system and the escalation matrix. Ex-Assam Police, retired as Sub-Inspector from the Kokrajhar district reserve." },
  { name: "Daimalu Boro", role: "Head — Training & Compliance", bio: "Owns the induction syllabus and the quarterly refresher calendar. Certified fire-safety and first-response instructor." },
  { name: "Swrang Mushahary", role: "Head — Facility Management", bio: "Built the housekeeping and waste-handling division from a two-site pilot into a 400-person operation." },
  { name: "Anjali Brahma", role: "Head — Human Resources", bio: "Verification, payroll, EPF/ESI filing and the lady-guard recruitment programme. Nothing gets deployed without her clearance." },
  { name: "Pranjal Basumatary", role: "Head — Electronic Security", bio: "Designs CCTV, access-control and fire-alarm layouts, and integrates them into the NBSS control room feed." },
];

export type Testimonial = {
  quote: string;
  author: string;
  company: string;
  sector: string;
};

export const testimonials: Testimonial[] = [
  {
    quote: "We moved three branches to NBSS after a cash-escort scare with our previous agency. Four years on, the muster is full every single morning — including the two branches that are an hour off the highway.",
    author: "Branch Operations Manager",
    company: "A scheduled commercial bank, Kokrajhar",
    sector: "Banking & finance",
  },
  {
    quote: "Their lady guards handle the girls' hostel gate and the examination-hall frisking. Parents ask about it at admission time, and we have an answer we are comfortable giving.",
    author: "Administrative Officer",
    company: "A degree college, Chirang",
    sector: "Education",
  },
  {
    quote: "Plucking season doubles our headcount overnight and the gate load with it. NBSS scales the deployment up in a week and back down without an argument over the bill.",
    author: "Estate Manager",
    company: "A tea estate, Udalguri",
    sector: "Plantations",
  },
  {
    quote: "One contract covers our guards, the housekeeping team and the waste segregation. One invoice, one field officer to call. That alone saved my department a working day a month.",
    author: "Facility Head",
    company: "A multi-speciality hospital, Bongaigaon",
    sector: "Healthcare",
  },
  {
    quote: "The night shift log is filled in properly, in handwriting we can read, with the actual time of each round. That sounds small until you have audited an agency that does not do it.",
    author: "Plant Security Officer",
    company: "A food processing unit, Bongaigaon",
    sector: "Manufacturing",
  },
];

export type FAQ = { q: string; a: string };

export const faqs: FAQ[] = [
  {
    q: "How quickly can guards be deployed at a new site?",
    a: "A standard commercial site inside the five BTR districts is surveyed within 48 hours and manned within seven working days. Armed deployment, dog squad and sites outside our core districts take two to three weeks because of licensing and relocation.",
  },
  {
    q: "Is NBSS licensed under PSARA?",
    a: "Yes. We hold a Private Security Agencies (Regulation) Act licence issued by the Controlling Authority, Government of Assam, along with ESIC, EPFO, GST and Contract Labour registrations. Copies are shared with the contract.",
  },
  {
    q: "How are your guards verified?",
    a: "Aadhaar and permanent address verification, police clearance from the home police station, two independent references and a medical fitness certificate. The file is closed before the uniform is issued, and re-verification runs every two years.",
  },
  {
    q: "What does a guard actually cost per month?",
    a: "Billing is built up from the Assam minimum wage for the applicable skill category, plus EPF, ESI, bonus, leave, uniform and the agency service charge, plus GST. We publish the build-up line by line in the quotation — there are no bundled or hidden heads.",
  },
  {
    q: "Can we get female security guards?",
    a: "Yes. We have run a dedicated lady-guard programme since 2015 for schools, colleges, hospitals, retail and event frisking duty, with separate rest and changing facilities specified in the site agreement.",
  },
  {
    q: "Do you handle housekeeping and waste along with guarding?",
    a: "Yes — that is the point of the facility management division. Guarding, housekeeping, solid waste handling, pest control, horticulture and skilled manpower can run on one agreement, one invoice and one field officer.",
  },
  {
    q: "What happens if a guard does not report for duty?",
    a: "The relieving guard's absence is flagged at shift change. The area field officer places a reliever from the district float within four hours, and the shortfall is credited on the next invoice. Absence is our cost, not yours.",
  },
  {
    q: "Do you work outside Bodoland?",
    a: "We deploy across the five BTR districts plus Bongaigaon, Dhubri and Kamrup (Guwahati). Requests from elsewhere in the Northeast are taken case by case — we will say no rather than take a site we cannot supervise properly.",
  },
];
