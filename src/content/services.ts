/** The service catalogue: four divisions, thirty-one services, twelve sectors. */

export type Accent = "green" | "gold" | "rust" | "sky";

export type Division = {
  slug: string;
  name: string;
  kicker: string;
  blurb: string;
  icon: string;
  cover: string;
  accent: Accent;
};

/** Ordered — this drives the footer nav and the filter chips. */
export const divisions: Division[] = [
  {
    slug: "security",
    name: "Security Services",
    kicker: "Manned guarding",
    blurb:
      "Uniformed, verified and drilled personnel on your gate, your floor and your perimeter — armed, unarmed, male, female and canine.",
    icon: "shield",
    cover: "/img/hero-guard.jpg",
    accent: "green",
  },
  {
    slug: "facility",
    name: "Facility Management",
    kicker: "Soft services",
    blurb:
      "Housekeeping, waste segregation, pest control and grounds upkeep, run to a published schedule and audited on the same visit as your guarding.",
    icon: "broom",
    cover: "/img/services/housekeeping.jpg",
    accent: "gold",
  },
  {
    slug: "manpower",
    name: "Manpower & Staffing",
    kicker: "Contract workforce",
    blurb:
      "Front office, drivers, loaders, technicians and skilled hands supplied on our roll — payroll, statutory filing and compliance stay with us.",
    icon: "people",
    cover: "/img/services/warehouse.jpg",
    accent: "rust",
  },
  {
    slug: "electronic",
    name: "Electronic Security",
    kicker: "Systems & monitoring",
    blurb:
      "CCTV, access control, fire detection and alarm integration, wired back to a control room that is staffed at three in the morning.",
    icon: "camera",
    cover: "/img/ops-cctv.jpg",
    accent: "sky",
  },
];

export type Service = {
  slug: string;
  name: string;
  division: string;
  summary: string;
  detail: string;
  icon: string;
  image: string;
  /** What the posting includes. */
  scope: string[];
  /** Where it is typically deployed. */
  fit: string[];
  featured?: boolean;
};

export const services: Service[] = [
  // ---------------------------------------------------------------- security
  {
    slug: "corporate-security",
    name: "Corporate & Office Security",
    division: "security",
    summary: "Reception-facing guards and floor marshals for offices, branch premises and corporate parks.",
    detail: "A corporate posting is as much about bearing as it is about vigilance — your guard is the first person a client meets. We post personnel who can hold a visitor register, work a boom barrier, run a courier check and still greet a director by name. Visitor movement is logged, contractor entry is gated on a work permit, and after-hours access is recorded against a named approver.",
    icon: "building",
    image: "/img/services/office.jpg",
    featured: true,
    scope: ["Visitor registration and photo-badge issue", "Access control at lobby, lift and floor level", "Courier, parcel and material gate-pass control", "After-hours and weekend entry logging", "Fire-warden duty and evacuation marshalling", "Daily occurrence register and shift handover"],
    fit: ["Corporate offices", "Bank and insurance branch premises", "Co-working and business parks", "Regional and zonal offices"],
  },
  {
    slug: "industrial-security",
    name: "Industrial & Factory Security",
    division: "security",
    summary: "Perimeter, gate and material-movement control for plants, mills and processing units.",
    detail: "Industrial loss rarely walks in through the front gate — it leaves through it, on a truck, with paperwork that nearly matches. Our industrial postings are built around weighbridge supervision, gate-pass reconciliation, scrap-yard watch and shift-change frisking, with a documented perimeter beat on a randomised interval so the round cannot be timed by anyone watching.",
    icon: "factory",
    image: "/img/services/construction.jpg",
    featured: true,
    scope: ["Manned main gate with inward and outward gate-pass control", "Weighbridge supervision and tare reconciliation", "Randomised perimeter beats with checkpoint punching", "Shift-change frisking of workmen", "Scrap yard and stores watch", "Contractor labour headcount at entry and exit"],
    fit: ["Rice, oil and flour mills", "Food and agro processing units", "Cement, steel and fabrication yards", "Packaging and light manufacturing"],
  },
  {
    slug: "bank-atm-security",
    name: "Bank & ATM Security",
    division: "security",
    summary: "Branch guarding, ATM site cover and cash-counter watch under RBI-aligned protocol.",
    detail: "Bank postings run on protocol, not initiative. Opening and closing are done in pairs against a written sequence, the strong-room corridor is under continuous watch during banking hours, and the alarm test is logged daily rather than assumed. Guards are briefed on shutter drill, hostage protocol and the branch's specific silent-alarm arrangement before their first shift.",
    icon: "bank",
    image: "/img/ops-bank.jpg",
    featured: true,
    scope: ["Two-person branch opening and closing drill", "Cash counter and strong-room corridor watch", "Customer frisking and bag deposit at entry", "Daily alarm and shutter test with signed log", "ATM site guarding and cash-loading cover", "Armed guard option for high-value branches"],
    fit: ["Scheduled commercial bank branches", "Cooperative banks and credit societies", "Standalone and offsite ATM kiosks", "Microfinance and NBFC collection centres"],
  },
  {
    slug: "cash-in-transit",
    name: "Cash Escort & Transit Security",
    division: "security",
    summary: "Armed escort for cash, valuables and high-value consignment movement.",
    detail: "Cash movement is planned as a route, not a trip. We fix pickup and drop windows, vary the road taken, keep the escort in radio contact with the control room at defined intervals, and hand over against a signed custody sheet at both ends. Route plans are held by the duty manager and are not shared with the crew until departure.",
    icon: "truck",
    image: "/img/ops-drill.jpg",
    scope: ["Licensed armed escort personnel", "Varied routing with fixed check-in intervals", "Dual-custody handover against signed sheet", "Control-room tracking for the full movement", "Coordination with the local police station on request", "Incident and deviation report within the same shift"],
    fit: ["Bank cash replenishment runs", "Retail daily collection movement", "Jewellery and bullion transport", "Payroll disbursement to remote sites"],
  },
  {
    slug: "retail-mall-security",
    name: "Retail & Shopping Mall Security",
    division: "security",
    summary: "Shrinkage control, crowd flow and closing-time discipline for stores and malls.",
    detail: "Retail security is loss prevention with a smile fixed on. Our floor personnel work fitting-room counts, tag-check at exit, trolley and bag control, and the closing sweep. On mall sites we add parking marshalling, escalator and atrium watch, and a documented lost-child protocol that the customer-service desk is trained on alongside our guards.",
    icon: "cart",
    image: "/img/services/mall.jpg",
    featured: true,
    scope: ["Entry bag deposit and exit tag verification", "Fitting-room item count", "Floor patrol focused on high-shrinkage categories", "Parking marshalling and vehicle flow", "Lost-child and medical-emergency protocol", "Closing sweep and shutter handover"],
    fit: ["Shopping malls and arcades", "Supermarkets and hypermarkets", "Jewellery, electronics and apparel stores", "Fuel stations and convenience retail"],
  },
  {
    slug: "hospital-security",
    name: "Hospital & Healthcare Security",
    division: "security",
    summary: "Calm, trained cover for casualty, wards, pharmacy and mortuary areas.",
    detail: "A hospital guard's hardest hour is the one after a bad admission. Casualty postings are briefed on de-escalation, attendant-pass discipline and how to hold a corridor without raising the temperature of a frightened family. Ward, pharmacy, blood bank and mortuary duties run on visiting-hour control and restricted-area passes rather than on argument.",
    icon: "cross",
    image: "/img/services/hospital.jpg",
    featured: true,
    scope: ["Casualty and emergency-entrance control", "Attendant pass issue and visiting-hour enforcement", "De-escalation training for agitated attendants", "Pharmacy, blood bank and stores watch", "Mortuary and body-handover supervision", "Ambulance bay and parking clearance"],
    fit: ["Multi-speciality and district hospitals", "Nursing homes and clinics", "Diagnostic centres and blood banks", "Medical college campuses"],
  },
  {
    slug: "education-security",
    name: "School, College & Campus Security",
    division: "security",
    summary: "Gate control, hostel watch and examination duty for educational institutions.",
    detail: "A campus posting is a child-safety posting. Every guard on a school or hostel site clears an enhanced verification, and lady guards handle girls' hostel gates and examination frisking. Gate duty is built around the release protocol — a child leaves with a listed guardian or does not leave — plus vehicle discipline at the drop-off and a documented outsider-challenge routine.",
    icon: "book",
    image: "/img/gallery/kokrajhar-med.jpg",
    featured: true,
    scope: ["Enhanced verification for all campus-posted staff", "Guardian-verified child release protocol", "Girls' hostel gate manned by lady guards", "Examination-hall frisking and material control", "School bus loading and drop-off marshalling", "Night hostel rounds with checkpoint punching"],
    fit: ["Schools and higher secondary institutions", "Degree and technical colleges", "University campuses and hostels", "Coaching centres and examination venues"],
  },
  {
    slug: "residential-security",
    name: "Residential & Township Security",
    division: "security",
    summary: "Gate, visitor and vendor control for apartments, colonies and gated townships.",
    detail: "Residential guarding lives or dies on the visitor register. We run resident-confirmed visitor entry, a domestic-help and vendor pass system with photographs, vehicle sticker checks and a night round that actually reaches the back boundary. Society committees get a monthly summary of entries, incidents and beat compliance.",
    icon: "home",
    image: "/img/services/office.jpg",
    scope: ["Resident-confirmed visitor entry", "Photo-pass system for domestic help and vendors", "Vehicle sticker verification and parking control", "Night rounds covering the full boundary", "Common-area and clubhouse watch", "Monthly incident and compliance report to the committee"],
    fit: ["Apartment complexes and housing societies", "Gated townships and colonies", "Staff quarters and residential campuses", "Individual bungalows and farmhouses"],
  },
  {
    slug: "hotel-hospitality-security",
    name: "Hotel & Hospitality Security",
    division: "security",
    summary: "Discreet lobby, banquet and guest-floor cover that does not feel like security.",
    detail: "Hospitality guarding is deliberately quiet. Personnel are groomed and briefed to guest-facing standards, work the lobby and porch without crowding arrivals, and manage banquet and function-hall crowds by anticipating rather than intervening. Guest-floor rounds, key-control discipline and back-of-house material gate-pass run in the background.",
    icon: "bell",
    image: "/img/services/mall.jpg",
    scope: ["Lobby, porch and driveway cover", "Banquet and function-hall crowd management", "Guest-floor rounds and key-control discipline", "Back-of-house material gate-pass control", "Staff entry frisking and locker checks", "Liaison with police for guest verification"],
    fit: ["Hotels, resorts and guest houses", "Banquet halls and convention venues", "Restaurants and bar operations", "Homestays and tourist lodges"],
  },
  {
    slug: "warehouse-security",
    name: "Warehouse & Logistics Security",
    division: "security",
    summary: "Dock discipline, seal verification and stock-gate control for godowns and depots.",
    detail: "In a warehouse, the security failure is almost always paperwork. Our godown postings verify seals at arrival and departure, match the gate pass to the invoice and the vehicle number to the manifest, supervise loading bays during dispatch, and count contractor labour in and out. Any seal discrepancy stops the vehicle and raises a written report before it moves.",
    icon: "box",
    image: "/img/services/warehouse.jpg",
    scope: ["Seal verification at inward and outward gate", "Gate pass, invoice and manifest three-way match", "Loading and unloading bay supervision", "Contractor labour headcount control", "Stock-area and cold-room access restriction", "Vehicle and driver detail logging"],
    fit: ["Distribution centres and depots", "Cold storage and agri godowns", "FMCG and e-commerce warehouses", "Transport yards and container depots"],
  },
  {
    slug: "construction-site-security",
    name: "Construction Site Security",
    division: "security",
    summary: "Material, machinery and labour-gate control for active project sites.",
    detail: "A live construction site loses steel, cable and diesel, mostly at night and mostly in small quantities. We man the material gate against the challan, log machinery movement, run night rounds over an unlit and changing site plan, and control labour entry against the contractor's headcount. Safety-gear compliance at the gate is part of the posting where the client asks for it.",
    icon: "helmet",
    image: "/img/services/construction.jpg",
    scope: ["Material inward challan verification", "Machinery and equipment movement log", "Night patrol over unlit and changing site plans", "Labour entry and exit headcount by contractor", "Diesel and fuel-issue watch", "Safety-gear compliance check at the gate"],
    fit: ["Building and infrastructure projects", "Road, bridge and embankment works", "Solar and transmission line projects", "Renovation and fit-out sites"],
  },
  {
    slug: "event-security",
    name: "Event & Crowd Management",
    division: "security",
    summary: "Gate, stage, VIP and crowd cover for festivals, functions and public events.",
    detail: "Event security is planned in the week before, not on the day. We walk the venue, mark entry and exit lanes, fix the barricade line, agree the stage and green-room cordon, and write an evacuation route that the organiser signs. On the day we deploy gate frisking, ticket or pass verification, queue management, lost-property handling and a named commander who owns every decision.",
    icon: "flag",
    image: "/img/gallery/bagurumba-1.jpg",
    featured: true,
    scope: ["Pre-event venue survey and deployment plan", "Entry frisking and pass or ticket verification", "Barricade line and queue management", "Stage, green-room and VIP cordon", "Parking marshalling and traffic lanes", "Written evacuation route and named event commander"],
    fit: ["Bwisagu and festival grounds", "Weddings and social functions", "Political and public meetings", "Sports meets, fairs and exhibitions"],
  },
  {
    slug: "armed-guard-services",
    name: "Armed Guard Services",
    division: "security",
    summary: "Licensed armed personnel for high-value premises and cash-handling sites.",
    detail: "Armed deployment is licence-bound and audited. Every armed guard holds a valid arms licence and a documented range record, weapons are issued and returned against a register at each shift, and the posting is reviewed with the client and the local police station before commencement. We deploy armed personnel only where the threat assessment supports it.",
    icon: "shield-alt",
    image: "/img/ops-parade.jpg",
    scope: ["Licensed personnel with current range records", "Weapon issue and return register per shift", "Documented threat assessment before deployment", "Local police station intimation and liaison", "Quarterly re-qualification firing", "Strict escalation-of-force briefing"],
    fit: ["High-value bank branches", "Bullion, jewellery and cash premises", "Fuel and explosive storage sites", "Sensitive government installations"],
  },
  {
    slug: "lady-security-guards",
    name: "Lady Security Guards",
    division: "security",
    summary: "Trained women guards for frisking, hostel, retail and campus duty.",
    detail: "Our lady-guard programme has run since 2015 and is now the fastest-growing part of the roll. Women guards handle female frisking at gates and examination halls, girls' hostel and ward duty, retail fitting-room checks and event entry lanes. Site agreements specify separate rest and changing facilities as a precondition of deployment — we will not post where that is not provided.",
    icon: "person",
    image: "/img/gallery/bodo-women.jpg",
    featured: true,
    scope: ["Female frisking at gates and examination halls", "Girls' hostel and female ward duty", "Retail fitting-room and floor checks", "Event and function entry lanes", "Separate rest and changing facilities mandated", "Same twenty-one day induction and refresher cycle"],
    fit: ["Schools, colleges and hostels", "Hospitals and nursing homes", "Retail and shopping centres", "Public events and examination venues"],
  },
  {
    slug: "personal-security-officers",
    name: "Personal Security Officers",
    division: "security",
    summary: "Close-protection officers and bouncers for individuals and functions.",
    detail: "Close protection is quiet, planned work: advance route checks, arrival and departure sequencing, venue reconnaissance and a low profile. Officers are selected for judgement and discretion rather than size, briefed individually on the principal's routine, and rotated to avoid pattern. Bouncer detachments for functions are deployed as a briefed team under a named leader.",
    icon: "user-shield",
    image: "/img/ops-team.jpg",
    scope: ["Advance route and venue reconnaissance", "Arrival and departure sequencing", "Discreet, plain-clothes or uniformed option", "Individual briefing on the principal's routine", "Bouncer detachments under a named team leader", "Rotation to avoid predictable patterns"],
    fit: ["Business owners and executives", "Public figures and visiting dignitaries", "Weddings and private functions", "Clubs, bars and ticketed venues"],
  },
  {
    slug: "tea-estate-security",
    name: "Tea Estate & Plantation Security",
    division: "security",
    summary: "Garden, factory and labour-line cover built for plantation operating rhythm.",
    detail: "A tea estate is a factory, a farm and a village at once, and its security load swings with the plucking calendar. We cover the leaf weighment point, the factory gate, the fuel and fertiliser store and the labour lines, run boundary rounds against green-leaf theft, and scale the deployment up for the season and back down afterwards without renegotiating the contract each time.",
    icon: "leaf",
    image: "/img/gallery/rubber.jpg",
    scope: ["Leaf weighment point supervision", "Factory gate and finished-stock control", "Boundary rounds against green-leaf theft", "Fuel, fertiliser and pesticide store watch", "Labour line and ration issue supervision", "Seasonal scale-up and scale-down of strength"],
    fit: ["Tea gardens and estates", "Rubber and areca plantations", "Agri-processing and cold chain units", "Nurseries and seed farms"],
  },
  {
    slug: "government-establishment-security",
    name: "Government & PSU Security",
    division: "security",
    summary: "Tender-compliant guarding for offices, institutions and public installations.",
    detail: "Government contracts are won and kept on documentation. We deploy against the tender's manpower schedule, maintain the attendance, wage and statutory registers that the department will inspect, and file the compliance returns on the department's own cycle. Personnel on public-facing counters are briefed on the office's grievance and visitor procedure.",
    icon: "landmark",
    image: "/img/gallery/kokrajhar-rail.jpg",
    scope: ["Deployment strictly to the tender manpower schedule", "Attendance, wage and statutory registers maintained on site", "Compliance returns filed on the department cycle", "Public counter and grievance-desk briefing", "Records room and store access control", "Council, board and institutional premises cover"],
    fit: ["BTC and state government offices", "Public sector undertakings and boards", "Public institutions and museums", "Water, power and transport installations"],
  },
  {
    slug: "dog-squad",
    name: "K9 Dog Squad",
    division: "security",
    summary: "Handler-led detection and patrol dogs for sweeps, events and night cover.",
    detail: "Dogs are deployed with their own handler, never reassigned between handlers, and worked in short cycles to keep detection reliable. We use them for pre-event venue sweeps, warehouse and perimeter night patrol, and explosive or narcotic search where the client's risk assessment calls for it. Kennelling, veterinary care and handler welfare are our cost, not yours.",
    icon: "paw",
    image: "/img/ops-fire-training.jpg",
    scope: ["Dedicated handler pairing, never rotated", "Pre-event and pre-visit venue sweeps", "Perimeter and warehouse night patrol", "Explosive and narcotic detection on request", "Short working cycles to preserve reliability", "Kennelling and veterinary care included"],
    fit: ["Large events and VIP visits", "Warehouses and industrial perimeters", "Educational campuses on examination days", "Government and high-risk installations"],
  },

  // ---------------------------------------------------------------- facility
  {
    slug: "housekeeping-services",
    name: "Housekeeping Services",
    division: "facility",
    summary: "Daily, periodic and deep-cleaning cycles on a published, auditable schedule.",
    detail: "Housekeeping fails when it is invisible until it is bad. We publish a schedule — daily cycles, weekly periodics and monthly deep work — put it on the wall, sign it off shift by shift, and audit it on the same field visit as your guarding. Consumables, machines and chemicals can be on our supply or yours, priced separately either way.",
    icon: "broom",
    image: "/img/services/housekeeping.jpg",
    featured: true,
    scope: ["Daily cleaning cycles with signed checklists", "Weekly periodic and monthly deep cleaning", "Washroom hygiene rounds and consumable refill", "Machine scrubbing, buffing and floor polishing", "Pantry, cafeteria and common-area upkeep", "Supervisor-led audit on every field visit"],
    fit: ["Corporate offices and branches", "Hospitals and clinics", "Malls, showrooms and hotels", "Educational and institutional campuses"],
  },
  {
    slug: "solid-waste-management",
    name: "Solid Waste Management",
    division: "facility",
    summary: "Segregation at source, collection, and documented handover to authorised handlers.",
    detail: "Waste is a compliance exposure before it is a housekeeping task. We run segregation at source into wet, dry and hazardous streams, collect on a fixed round, maintain the quantity register, and hand over to authorised recyclers and disposal agencies against documentation you can produce in an inspection. Biomedical waste is handled strictly through licensed channels.",
    icon: "recycle",
    image: "/img/services/housekeeping.jpg",
    scope: ["Wet, dry and hazardous segregation at source", "Fixed-round collection and bin management", "Quantity register maintained per stream", "Documented handover to authorised handlers", "Biomedical waste via licensed channels only", "Composting and recycling coordination"],
    fit: ["Hospitals and diagnostic centres", "Townships and housing societies", "Institutional and office campuses", "Markets, malls and food courts"],
  },
  {
    slug: "pest-control",
    name: "Pest & Rodent Control",
    division: "facility",
    summary: "Scheduled treatment cycles for offices, kitchens, godowns and residences.",
    detail: "Pest control on a security contract is convenient rather than clever, but doing it on a fixed cycle with a treatment log is what actually keeps a godown clean. We run general disinfestation, rodent baiting with mapped station numbers, termite treatment and mosquito fogging, with the chemical, dosage and date recorded for every visit.",
    icon: "bug",
    image: "/img/services/warehouse.jpg",
    scope: ["General disinfestation on a fixed cycle", "Numbered and mapped rodent bait stations", "Anti-termite pre- and post-construction treatment", "Mosquito and fly fogging", "Kitchen and food-area safe-chemical protocol", "Chemical, dosage and date logged per visit"],
    fit: ["Food processing and kitchens", "Warehouses and cold storage", "Hospitals and hotels", "Offices and residential townships"],
  },
  {
    slug: "horticulture-landscaping",
    name: "Horticulture & Landscaping",
    division: "facility",
    summary: "Gardening, lawn upkeep and plantation maintenance for campuses and townships.",
    detail: "Grounds are the part of a facility every visitor sees first. Our horticulture teams handle lawn mowing and edging, hedge and topiary trimming, seasonal planting, irrigation upkeep and indoor plant rotation, on a calendar tied to the local growing season rather than a generic annual plan.",
    icon: "plant",
    image: "/img/gallery/marigold.jpg",
    scope: ["Lawn mowing, edging and weed control", "Hedge, shrub and topiary trimming", "Seasonal flowering and bed preparation", "Irrigation and sprinkler upkeep", "Indoor plant supply and rotation", "Tree pruning and monsoon-season safety checks"],
    fit: ["Corporate and institutional campuses", "Townships and housing societies", "Hotels, resorts and guest houses", "Government offices and public grounds"],
  },
  {
    slug: "facade-tank-cleaning",
    name: "Facade & Water Tank Cleaning",
    division: "facility",
    summary: "Periodic external glass, facade and overhead tank cleaning with safety cover.",
    detail: "This is the periodic work that gets deferred until it becomes a problem. We run facade and external glass cleaning with trained rope-access or cradle teams under a written safety plan, and overhead and underground tank cleaning with desilting, scrubbing, disinfection and a post-clean water test report handed to the client.",
    icon: "droplet",
    image: "/img/services/office.jpg",
    scope: ["External glass and facade cleaning", "Trained rope-access or cradle operation", "Written height-work safety plan per job", "Overhead and underground tank desilting", "Scrubbing, disinfection and chlorination", "Post-clean water test report"],
    fit: ["Office towers and glass facades", "Hotels, malls and hospitals", "Housing societies and townships", "Institutional and industrial buildings"],
  },

  // ---------------------------------------------------------------- manpower
  {
    slug: "manpower-staffing",
    name: "Contract Manpower & Staffing",
    division: "manpower",
    summary: "Workforce supplied on the NBSS roll — payroll, statutory filing and compliance included.",
    detail: "You specify the skill, the strength and the shift pattern; the people come on our roll. That means EPF, ESI, bonus, gratuity provisioning, leave, wage registers and inspection-ready compliance sit with us, and you receive one invoice with the statutory build-up shown line by line. Replacement for absence is our obligation, not a negotiation.",
    icon: "people",
    image: "/img/services/warehouse.jpg",
    featured: true,
    scope: ["Recruitment, verification and onboarding", "Payroll processed and paid by the 7th", "EPF, ESI, bonus and leave administered by us", "Wage and attendance registers kept inspection-ready", "Guaranteed replacement against absence", "Single invoice with the statutory build-up shown"],
    fit: ["Manufacturing and processing units", "Warehouses and logistics operations", "Hospitals and hospitality", "Government and institutional contracts"],
  },
  {
    slug: "front-office-staffing",
    name: "Front Office & Receptionists",
    division: "manpower",
    summary: "Groomed, bilingual reception, telephone and visitor-desk staff.",
    detail: "Front-desk hiring is a communication hire, not a headcount hire. We screen for spoken Bodo, Assamese, Hindi and English as the site requires, train on visitor-management software, telephone handling and appointment discipline, and provide a trained relief so the desk is never unattended during lunch or leave.",
    icon: "headset",
    image: "/img/services/hospital.jpg",
    scope: ["Bodo, Assamese, Hindi and English screening", "Visitor management software training", "Telephone and appointment handling", "Courier, meeting-room and pantry coordination", "Grooming and uniform standard maintained", "Trained relief for lunch and leave cover"],
    fit: ["Corporate offices and clinics", "Hotels and showrooms", "Educational institutions", "Government and public offices"],
  },
  {
    slug: "drivers-fleet-staffing",
    name: "Drivers & Fleet Manpower",
    division: "manpower",
    summary: "Verified light and heavy vehicle drivers with licence and record checks.",
    detail: "Every driver is placed only after licence verification with the issuing RTO, a police record check and a practical driving assessment on the class of vehicle they will actually handle. Where the client wants it, we add a duty-hour log and a monthly fuel and maintenance summary so vehicle cost stops being a mystery line item.",
    icon: "wheel",
    image: "/img/services/warehouse.jpg",
    scope: ["Licence verification with the issuing RTO", "Police record check and reference check", "Practical assessment on the actual vehicle class", "Light, heavy and commercial categories", "Duty-hour and trip logging", "Monthly fuel and maintenance summary"],
    fit: ["Corporate and executive transport", "Ambulance and hospital fleets", "Logistics and distribution fleets", "Institutional and school transport"],
  },
  {
    slug: "skilled-technical-manpower",
    name: "Skilled & Technical Manpower",
    division: "manpower",
    summary: "Electricians, plumbers, technicians and helpers for building operations.",
    detail: "Building operations fall over when the maintenance hand is a phone call away instead of on site. We place licensed electricians, plumbers, AC and DG technicians, lift attendants and general helpers, on shift or on call, with a preventive maintenance checklist and a breakdown log that makes the next budget conversation easier.",
    icon: "wrench",
    image: "/img/services/construction.jpg",
    scope: ["Licensed electricians and wiremen", "Plumbers and sanitary technicians", "AC, DG set and pump-room technicians", "Lift attendants and building helpers", "Preventive maintenance checklists", "Breakdown log and monthly summary"],
    fit: ["Office and commercial buildings", "Hospitals and hotels", "Malls and multiplexes", "Industrial and institutional campuses"],
  },

  // -------------------------------------------------------------- electronic
  {
    slug: "cctv-surveillance",
    name: "CCTV & Video Surveillance",
    division: "electronic",
    summary: "Camera layout, installation and monitoring wired into the NBSS control room.",
    detail: "A camera nobody watches is a camera that only helps after the loss. We survey the site, design coverage around actual entry, cash and stock points rather than wall convenience, install and commission, and — where the client wants it — take the feed into the Kokrajhar control room so an alarm is seen live at three in the morning instead of found at nine.",
    icon: "camera",
    image: "/img/ops-cctv.jpg",
    featured: true,
    scope: ["Site survey and coverage design", "IP and analogue camera supply and installation", "NVR/DVR configuration and retention setup", "Optional live monitoring from the NBSS control room", "Motion and line-crossing alarm rules", "Footage retrieval support for incidents and police"],
    fit: ["Bank branches and ATM sites", "Warehouses and industrial units", "Retail, malls and showrooms", "Campuses, townships and offices"],
  },
  {
    slug: "access-control-systems",
    name: "Access Control & Attendance",
    division: "electronic",
    summary: "Card, biometric and boom-barrier control integrated with the visitor register.",
    detail: "Access control is only as good as the exception handling. We install card, biometric and boom-barrier systems, then define who authorises an override, how it is logged and who reviews the log — because in practice every site has visitors, deliveries and forgotten cards. The same system doubles as an attendance source when the client wants it.",
    icon: "key",
    image: "/img/ops-control-room.jpg",
    scope: ["Card, PIN and biometric readers", "Boom barrier and turnstile integration", "Zone-wise and time-wise access rules", "Written override authorisation and logging", "Attendance export for payroll", "Integration with the manned visitor register"],
    fit: ["Corporate offices and data rooms", "Manufacturing and restricted zones", "Hospitals and laboratories", "Gated townships and parking"],
  },
  {
    slug: "fire-safety-systems",
    name: "Fire Detection & Safety Systems",
    division: "electronic",
    summary: "Alarm and extinguisher systems, plus the drills that make them work.",
    detail: "Fire systems are bought once and forgotten until an inspection. We supply and install detection and alarm panels, position and refill extinguishers, mark and keep clear the evacuation routes, and — the part that actually matters — run quarterly evacuation drills with your staff and our guards together, timed and recorded.",
    icon: "fire",
    image: "/img/ops-fire-training.jpg",
    scope: ["Smoke and heat detection with alarm panels", "Extinguisher supply, placement and refilling", "Hydrant and hose-reel checks", "Evacuation route marking and signage", "Quarterly timed evacuation drills", "Fire-warden training for client staff"],
    fit: ["Industrial and processing units", "Hospitals and educational campuses", "Hotels, malls and offices", "Warehouses and godowns"],
  },
  {
    slug: "control-room-monitoring",
    name: "24×7 Control Room & Monitoring",
    division: "electronic",
    summary: "Beat check-ins, alarm response and escalation from a room that is never empty.",
    detail: "The Kokrajhar control room is the spine of every NBSS contract. Sites check in on a fixed beat; a missed check-in escalates to the area field officer within ten minutes and to the duty manager within twenty. Alarms, incidents and deviations are logged with timestamps, and clients get a monthly report of every event on their site — including the ones that turned out to be nothing.",
    icon: "radio",
    image: "/img/ops-control-room.jpg",
    featured: true,
    scope: ["Fixed-interval beat check-in from every site", "Ten and twenty minute escalation ladder", "Live alarm and CCTV event response", "Timestamped incident and deviation log", "Emergency liaison with police and fire services", "Monthly per-site event report to the client"],
    fit: ["Every NBSS contract, by default", "Multi-site clients needing one view", "Remote and unmanned installations", "High-value and high-risk premises"],
  },
];

export type Sector = {
  slug: string;
  name: string;
  blurb: string;
  image: string;
};

export const sectors: Sector[] = [
  { slug: "bfsi", name: "Banking & Finance", blurb: "Branches, ATMs, cash movement and collection centres under RBI-aligned protocol.", image: "/img/ops-bank.jpg" },
  { slug: "healthcare", name: "Healthcare", blurb: "Casualty, wards, pharmacy and biomedical waste, handled without raising the temperature.", image: "/img/services/hospital.jpg" },
  { slug: "education", name: "Education", blurb: "Campus gates, hostels and examination duty with enhanced-verification personnel.", image: "/img/gallery/kokrajhar-med.jpg" },
  { slug: "retail", name: "Retail & Malls", blurb: "Shrinkage control, crowd flow, parking and the closing sweep.", image: "/img/services/mall.jpg" },
  { slug: "industry", name: "Manufacturing", blurb: "Weighbridge, gate pass, scrap yard and shift-change discipline.", image: "/img/services/construction.jpg" },
  { slug: "plantations", name: "Tea & Plantations", blurb: "Leaf weighment, factory gate and labour lines, scaled to the plucking calendar.", image: "/img/gallery/rubber.jpg" },
  { slug: "government", name: "Government & PSU", blurb: "Tender-compliant deployment with inspection-ready registers.", image: "/img/gallery/kokrajhar-rail.jpg" },
  { slug: "logistics", name: "Logistics & Warehousing", blurb: "Seal verification, dock supervision and three-way manifest matching.", image: "/img/services/warehouse.jpg" },
  { slug: "hospitality", name: "Hospitality", blurb: "Lobby, banquet and guest-floor cover that stays out of the guest's way.", image: "/img/gallery/manas.jpg" },
  { slug: "residential", name: "Residential", blurb: "Visitor confirmation, vendor passes and a night round that reaches the back wall.", image: "/img/services/office.jpg" },
  { slug: "events", name: "Events & Festivals", blurb: "Barricade lines, frisking lanes and a named commander who owns the day.", image: "/img/gallery/bagurumba-1.jpg" },
  { slug: "infrastructure", name: "Construction & Infra", blurb: "Material challans, machinery logs and night patrol over a changing site plan.", image: "/img/services/construction.jpg" },
];

// ------------------------------------------------------------------ lookups

export function serviceBySlug(slug: string): Service | undefined {
  return services.find((s) => s.slug === slug);
}

export function divisionBySlug(slug: string): Division | undefined {
  return divisions.find((d) => d.slug === slug);
}

export function servicesIn(division?: string): Service[] {
  if (!division) return services;
  return services.filter((s) => s.division === division);
}

export function featuredServices(): Service[] {
  return services.filter((s) => s.featured);
}

export function relatedServices(service: Service, limit = 4): Service[] {
  return services
    .filter((s) => s.division === service.division && s.slug !== service.slug)
    .slice(0, limit);
}

/**
 * Case-insensitive substring match over the fields a visitor is likely to type.
 * Deliberately naive: the catalogue is thirty-one items long, so an index would
 * cost more than it saves — and this runs in the browser, so results are instant.
 */
export function searchServices(query: string): Service[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return services.filter((s) =>
    [s.name, s.summary, s.division, ...s.fit, ...s.scope]
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}
