/**
 * Global company facts, used by the header, footer, JSON-LD and metadata.
 *
 * All editorial content lives in `src/content` as typed data rather than in a
 * CMS. The copy changes rarely, so keeping it here gives compile-time safety,
 * zero-latency rendering and a fully static build.
 *
 * EVERY FACT BELOW IS DRAWN FROM THE COMPANY PROFILE SUPPLIED BY THE CLIENT.
 * Nothing here is invented. Where the profile is silent — a founding year, a
 * registration number, an email address, client names, headcounts — the field
 * is absent rather than filled with a plausible placeholder, because a security
 * agency publishing a licence number it does not hold is a legal problem, not a
 * copy problem. Add them here as the client confirms them.
 */

export type Link = { label: string; url: string };

export type Credential = {
  label: string;
  body: string;
  note: string;
};

export const site = {
  name: "National Bodo Security Service",
  shortName: "NBSS",
  tagline: "Your Safety, Our Responsibility.",
  descriptor:
    "A trusted and professionally managed security service provider headquartered in Kokrajhar, Bodoland Territorial Council (BTC), Assam, supplying trained and disciplined security personnel to government, corporate, institutional and commercial clients.",
  phone: "+91 70020 71628",
  address: {
    label: "Registered Office",
    /** Rendered line by line wherever the address appears. */
    lines: ["Kokrajhar", "Bodoland Territorial Council (BTC)", "Assam, India"],
    city: "Kokrajhar",
    state: "Assam",
    region: "Bodoland Territorial Council (BTC)",
    mapUrl:
      "https://www.openstreetmap.org/?mlat=26.4009&mlon=90.2711#map=14/26.4009/90.2711",
    lat: "26.4009",
    lng: "90.2711",
  },
  /**
   * The office window, written once and reused everywhere it is quoted — the
   * footer, the contact page, the service sidebars and the careers pages all
   * read from here rather than repeating the hours in prose, which is how the
   * four copies drifted apart in the first place.
   *
   * Every clock time on this site is India Standard Time and is written in
   * 12-hour form, because that is how the client, the guards and the callers
   * all say it. The zone is printed rather than assumed: the site is read from
   * outside India often enough that "9:00 AM" on its own is a guess.
   */
  officeOpen: "9:00 AM",
  officeClose: "6:00 PM",
  /** Ready-made for the places that quote the window inside a sentence. */
  hoursShort: "Mon–Sat, 9:00 AM – 6:00 PM IST",
  hours: [
    "Office — Mon to Sat, 9:00 AM to 6:00 PM IST",
    "Supervision & deployment desk — 24 × 7",
  ],
  /** IANA zone for every date the site formats. */
  timeZone: "Asia/Kolkata",
  /**
   * Only profiles the client has actually confirmed. Instagram and YouTube are
   * absent rather than pointing at "#", for the same reason the licence numbers
   * are absent: a dead link is worse than no link. Add them here when they exist.
   */
  social: [
    {
      label: "Facebook",
      url: "https://www.facebook.com/p/National-Bodo-security-service-Kokrajhar-61574200313067/",
    },
    { label: "WhatsApp", url: "https://wa.me/917577036205" },
  ] satisfies Link[],
  /**
   * Compliance categories only. The client's profile states what NBSS is
   * registered and compliant under; it gives no registration numbers, so none
   * are printed. Add a `number` field here once the client supplies documents.
   */
  compliance: [
    {
      label: "Registered under Government of Assam",
      body: "Security agency registration",
      note: "Documents shared with the contract on request",
    },
    {
      label: "GST registered",
      body: "Goods & Services Tax",
      note: "Tax invoice raised against every contract",
    },
    {
      label: "Labour law compliance",
      body: "Contract labour and wage regulations",
      note: "Wage and attendance records maintained",
    },
    {
      label: "ESI & EPF facility",
      body: "Employees' State Insurance and Provident Fund",
      note: "Extended to deployed personnel as applicable",
    },
    {
      label: "Police verification",
      body: "Local police station clearance",
      note: "Completed for every guard before deployment",
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

/**
 * Figures that follow directly from the client's profile — the districts it
 * lists, the service categories it lists, the training areas it lists — rather
 * than headcounts and renewal rates nobody has confirmed.
 */
export const stats: Stat[] = [
  { value: "24", suffix: "×7", label: "Monitoring & supervision", note: "Every day of the year" },
  { value: "6", suffix: "+", label: "Districts served", note: "BTC and lower Assam" },
  { value: "100", suffix: "%", label: "Police verified", note: "Every guard, before posting" },
  { value: "9", suffix: "", label: "Sectors covered", note: "Banks to construction sites" },
  { value: "6", suffix: "", label: "Training areas", note: "Completed before first duty" },
];

export type Creed = { title: string; body: string; points?: string[] };

/** The client's stated vision and mission, reproduced. */
export const vision: Creed = {
  title: "Vision",
  body: "To become the most reliable and professional security service provider in Assam and North-East India by ensuring excellence, integrity and client satisfaction.",
};

export const mission: Creed = {
  title: "Mission",
  body: "Four commitments we are judged on, on every site we hold:",
  points: [
    "To provide highly trained and skilled security guards.",
    "To maintain discipline, punctuality and professionalism.",
    "To continuously monitor and improve service quality.",
    "To build long-term relationships based on trust and accountability.",
  ],
};

export type Pillar = {
  index: string;
  title: string;
  body: string;
  icon: string;
};

/** "Why Choose Us?" from the company profile, one pillar per stated point. */
export const pillars: Pillar[] = [
  {
    index: "01",
    title: "Professionally trained security guards",
    body: "Nobody stands at a client gate untrained. Guarding duties, physical fitness and parade, fire safety, first aid, access control and crowd handling are covered before a first posting, and revisited afterwards.",
    icon: "drill",
  },
  {
    index: "02",
    title: "Uniformed and disciplined staff",
    body: "Turnout is inspected, not assumed. Uniform, cap, identity card and bearing are the first thing a visitor to your site sees, and they are the first thing our supervisors check.",
    icon: "shield-check",
  },
  {
    index: "03",
    title: "24 × 7 monitoring and supervision",
    body: "Supervision does not stop when the office closes. Sites are checked around the clock, including the shifts where an unsupervised guard is the whole risk.",
    icon: "radio",
  },
  {
    index: "04",
    title: "Quick replacement and backup support",
    body: "An absent guard is our problem to solve, not yours to chase. We hold backup strength so a gap at shift change is filled rather than explained.",
    icon: "layers",
  },
  {
    index: "05",
    title: "Competitive and transparent pricing",
    body: "The quotation shows what it shows. Wages, statutory heads and the agency charge are set out separately so you can see exactly what the guard receives and what we charge on top.",
    icon: "rupee",
  },
  {
    index: "06",
    title: "Strong local workforce and management",
    body: "Our people are recruited from Kokrajhar and the districts around it. They know the roads, the languages and the neighbours — and a stranger at the gate is spotted by someone who actually knows who belongs.",
    icon: "roots",
  },
];

export type District = {
  name: string;
  region: string;
  core: boolean;
};

/** The districts named in the client's "Client Support & Availability". */
export const coverage: District[] = [
  { name: "Kokrajhar", region: "Bodoland Territorial Council — head office", core: true },
  { name: "Chirang", region: "Bodoland Territorial Council", core: true },
  { name: "Baksa", region: "Bodoland Territorial Council", core: true },
  { name: "Udalguri", region: "Bodoland Territorial Council", core: true },
  { name: "Bongaigaon", region: "Lower Assam", core: false },
  { name: "Barpeta", region: "Lower Assam", core: false },
];

/** District names accepted by the quote form, plus the catch-all option. */
export const districtOptions: string[] = [
  ...coverage.map((d) => d.name),
  "Another nearby district",
];

export type Person = { name: string; role: string; bio: string };

/** The management team as named in the company profile. */
export const leadership: Person[] = [
  {
    name: "Mr. Dhanjit Brahma",
    role: "Director — Owner & Founder",
    bio: "Founded National Bodo Security Service in Kokrajhar and runs it. Deployment decisions, client agreements and the standard the guards are held to all come back to him.",
  },
];

export type FAQ = { q: string; a: string };

export const faqs: FAQ[] = [
  {
    q: "What kind of sites do you provide security for?",
    a: "Government departments, corporate offices, educational institutions, hospitals and nursing homes, industrial units, banks and ATMs, hotels and resorts, shopping malls and showrooms, warehouses, construction sites, residential complexes, and events requiring crowd or VIP cover.",
  },
  {
    q: "Which districts do you operate in?",
    a: "Kokrajhar, Chirang, Baksa, Udalguri, Bongaigaon, Barpeta and other nearby districts. If your site is just outside that list, call us — we will give you a straight answer about whether we can supervise it properly.",
  },
  {
    q: "How are your guards verified?",
    a: "Police verification is completed for every guard before deployment. Identity and address documents are checked as part of the same file.",
  },
  {
    q: "What training do your guards receive?",
    a: "Basic security and guarding duties, physical fitness and parade, fire safety and emergency response, first-aid support, access control and gate management, and crowd control and discipline.",
  },
  {
    q: "Are you legally registered and compliant?",
    a: "NBSS is registered under the Government of Assam and maintains GST and labour compliance. ESI and EPF facilities are extended to deployed personnel as applicable. Documents can be shared on request when a contract is being finalised.",
  },
  {
    q: "What happens if a guard does not report for duty?",
    a: "We hold backup strength for exactly this. A shortfall at shift change is covered by a replacement rather than left open — quick replacement and backup support are part of the service, not an extra.",
  },
  {
    q: "Can we get female security guards?",
    a: "Yes. Women guards are on our roll and are deployed for school, college, hospital, retail and event duty where female frisking or hostel and ward cover is required.",
  },
  {
    q: "How is the service priced?",
    a: "Pricing is competitive and transparent. The quotation sets out the wage, the applicable statutory heads and the agency service charge separately, so there is nothing bundled or hidden. Call 7002071628 to arrange a site visit and a quotation.",
  },
];
