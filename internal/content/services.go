package content

import "strings"

// Division groups services into the four business lines NBSS sells.
type Division struct {
	Slug   string
	Name   string
	Kicker string
	Blurb  string
	Icon   string
	Cover  string
	Accent string // css custom-property suffix: green | gold | rust | sky
}

// Divisions is ordered; the order drives navigation and the services page.
var Divisions = []Division{
	{
		Slug:   "security",
		Name:   "Security Services",
		Kicker: "Manned guarding",
		Blurb:  "Uniformed, verified and drilled personnel on your gate, your floor and your perimeter — armed, unarmed, male, female and canine.",
		Icon:   "shield",
		Cover:  "/static/img/hero-guard.jpg",
		Accent: "green",
	},
	{
		Slug:   "facility",
		Name:   "Facility Management",
		Kicker: "Soft services",
		Blurb:  "Housekeeping, waste segregation, pest control and grounds upkeep, run to a published schedule and audited on the same visit as your guarding.",
		Icon:   "broom",
		Cover:  "/static/img/services/housekeeping.jpg",
		Accent: "gold",
	},
	{
		Slug:   "manpower",
		Name:   "Manpower & Staffing",
		Kicker: "Contract workforce",
		Blurb:  "Front office, drivers, loaders, technicians and skilled hands supplied on our roll — payroll, statutory filing and compliance stay with us.",
		Icon:   "people",
		Cover:  "/static/img/services/warehouse.jpg",
		Accent: "rust",
	},
	{
		Slug:   "electronic",
		Name:   "Electronic Security",
		Kicker: "Systems & monitoring",
		Blurb:  "CCTV, access control, fire detection and alarm integration, wired back to a control room that is staffed at three in the morning.",
		Icon:   "camera",
		Cover:  "/static/img/ops-cctv.jpg",
		Accent: "sky",
	},
}

// Service is a single line item in the catalogue.
type Service struct {
	Slug     string
	Name     string
	Division string
	Summary  string
	Detail   string
	Icon     string
	Image    string
	Scope    []string // what is included
	Fit      []string // who this is for
	Featured bool
}

// Services is the full catalogue. Slugs are stable and used as URLs.
var Services = []Service{
	// ---------------------------------------------------------------- security
	{
		Slug: "corporate-security", Name: "Corporate & Office Security", Division: "security",
		Summary: "Reception-facing guards and floor marshals for offices, branch premises and corporate parks.",
		Detail:  "A corporate posting is as much about bearing as it is about vigilance — your guard is the first person a client meets. We post personnel who can hold a visitor register, work a boom barrier, run a courier check and still greet a director by name. Visitor movement is logged, contractor entry is gated on a work permit, and after-hours access is recorded against a named approver.",
		Icon:    "building", Image: "/static/img/services/office.jpg", Featured: true,
		Scope: []string{"Visitor registration and photo-badge issue", "Access control at lobby, lift and floor level", "Courier, parcel and material gate-pass control", "After-hours and weekend entry logging", "Fire-warden duty and evacuation marshalling", "Daily occurrence register and shift handover"},
		Fit:   []string{"Corporate offices", "Bank and insurance branch premises", "Co-working and business parks", "Regional and zonal offices"},
	},
	{
		Slug: "industrial-security", Name: "Industrial & Factory Security", Division: "security",
		Summary: "Perimeter, gate and material-movement control for plants, mills and processing units.",
		Detail:  "Industrial loss rarely walks in through the front gate — it leaves through it, on a truck, with paperwork that nearly matches. Our industrial postings are built around weighbridge supervision, gate-pass reconciliation, scrap-yard watch and shift-change frisking, with a documented perimeter beat on a randomised interval so the round cannot be timed by anyone watching.",
		Icon:    "factory", Image: "/static/img/services/construction.jpg", Featured: true,
		Scope: []string{"Manned main gate with inward and outward gate-pass control", "Weighbridge supervision and tare reconciliation", "Randomised perimeter beats with checkpoint punching", "Shift-change frisking of workmen", "Scrap yard and stores watch", "Contractor labour headcount at entry and exit"},
		Fit:   []string{"Rice, oil and flour mills", "Food and agro processing units", "Cement, steel and fabrication yards", "Packaging and light manufacturing"},
	},
	{
		Slug: "bank-atm-security", Name: "Bank & ATM Security", Division: "security",
		Summary: "Branch guarding, ATM site cover and cash-counter watch under RBI-aligned protocol.",
		Detail:  "Bank postings run on protocol, not initiative. Opening and closing are done in pairs against a written sequence, the strong-room corridor is under continuous watch during banking hours, and the alarm test is logged daily rather than assumed. Guards are briefed on shutter drill, hostage protocol and the branch's specific silent-alarm arrangement before their first shift.",
		Icon:    "bank", Image: "/static/img/ops-bank.jpg", Featured: true,
		Scope: []string{"Two-person branch opening and closing drill", "Cash counter and strong-room corridor watch", "Customer frisking and bag deposit at entry", "Daily alarm and shutter test with signed log", "ATM site guarding and cash-loading cover", "Armed guard option for high-value branches"},
		Fit:   []string{"Scheduled commercial bank branches", "Cooperative banks and credit societies", "Standalone and offsite ATM kiosks", "Microfinance and NBFC collection centres"},
	},
	{
		Slug: "cash-in-transit", Name: "Cash Escort & Transit Security", Division: "security",
		Summary: "Armed escort for cash, valuables and high-value consignment movement.",
		Detail:  "Cash movement is planned as a route, not a trip. We fix pickup and drop windows, vary the road taken, keep the escort in radio contact with the control room at defined intervals, and hand over against a signed custody sheet at both ends. Route plans are held by the duty manager and are not shared with the crew until departure.",
		Icon:    "truck", Image: "/static/img/ops-drill.jpg",
		Scope: []string{"Licensed armed escort personnel", "Varied routing with fixed check-in intervals", "Dual-custody handover against signed sheet", "Control-room tracking for the full movement", "Coordination with the local police station on request", "Incident and deviation report within the same shift"},
		Fit:   []string{"Bank cash replenishment runs", "Retail daily collection movement", "Jewellery and bullion transport", "Payroll disbursement to remote sites"},
	},
	{
		Slug: "retail-mall-security", Name: "Retail & Shopping Mall Security", Division: "security",
		Summary: "Shrinkage control, crowd flow and closing-time discipline for stores and malls.",
		Detail:  "Retail security is loss prevention with a smile fixed on. Our floor personnel work fitting-room counts, tag-check at exit, trolley and bag control, and the closing sweep. On mall sites we add parking marshalling, escalator and atrium watch, and a documented lost-child protocol that the customer-service desk is trained on alongside our guards.",
		Icon:    "cart", Image: "/static/img/services/mall.jpg", Featured: true,
		Scope: []string{"Entry bag deposit and exit tag verification", "Fitting-room item count", "Floor patrol focused on high-shrinkage categories", "Parking marshalling and vehicle flow", "Lost-child and medical-emergency protocol", "Closing sweep and shutter handover"},
		Fit:   []string{"Shopping malls and arcades", "Supermarkets and hypermarkets", "Jewellery, electronics and apparel stores", "Fuel stations and convenience retail"},
	},
	{
		Slug: "hospital-security", Name: "Hospital & Healthcare Security", Division: "security",
		Summary: "Calm, trained cover for casualty, wards, pharmacy and mortuary areas.",
		Detail:  "A hospital guard's hardest hour is the one after a bad admission. Casualty postings are briefed on de-escalation, attendant-pass discipline and how to hold a corridor without raising the temperature of a frightened family. Ward, pharmacy, blood bank and mortuary duties run on visiting-hour control and restricted-area passes rather than on argument.",
		Icon:    "cross", Image: "/static/img/services/hospital.jpg", Featured: true,
		Scope: []string{"Casualty and emergency-entrance control", "Attendant pass issue and visiting-hour enforcement", "De-escalation training for agitated attendants", "Pharmacy, blood bank and stores watch", "Mortuary and body-handover supervision", "Ambulance bay and parking clearance"},
		Fit:   []string{"Multi-speciality and district hospitals", "Nursing homes and clinics", "Diagnostic centres and blood banks", "Medical college campuses"},
	},
	{
		Slug: "education-security", Name: "School, College & Campus Security", Division: "security",
		Summary: "Gate control, hostel watch and examination duty for educational institutions.",
		Detail:  "A campus posting is a child-safety posting. Every guard on a school or hostel site clears an enhanced verification, and lady guards handle girls' hostel gates and examination frisking. Gate duty is built around the release protocol — a child leaves with a listed guardian or does not leave — plus vehicle discipline at the drop-off and a documented outsider-challenge routine.",
		Icon:    "book", Image: "/static/img/gallery/kokrajhar-med.jpg", Featured: true,
		Scope: []string{"Enhanced verification for all campus-posted staff", "Guardian-verified child release protocol", "Girls' hostel gate manned by lady guards", "Examination-hall frisking and material control", "School bus loading and drop-off marshalling", "Night hostel rounds with checkpoint punching"},
		Fit:   []string{"Schools and higher secondary institutions", "Degree and technical colleges", "University campuses and hostels", "Coaching centres and examination venues"},
	},
	{
		Slug: "residential-security", Name: "Residential & Township Security", Division: "security",
		Summary: "Gate, visitor and vendor control for apartments, colonies and gated townships.",
		Detail:  "Residential guarding lives or dies on the visitor register. We run resident-confirmed visitor entry, a domestic-help and vendor pass system with photographs, vehicle sticker checks and a night round that actually reaches the back boundary. Society committees get a monthly summary of entries, incidents and beat compliance.",
		Icon:    "home", Image: "/static/img/services/office.jpg",
		Scope: []string{"Resident-confirmed visitor entry", "Photo-pass system for domestic help and vendors", "Vehicle sticker verification and parking control", "Night rounds covering the full boundary", "Common-area and clubhouse watch", "Monthly incident and compliance report to the committee"},
		Fit:   []string{"Apartment complexes and housing societies", "Gated townships and colonies", "Staff quarters and residential campuses", "Individual bungalows and farmhouses"},
	},
	{
		Slug: "hotel-hospitality-security", Name: "Hotel & Hospitality Security", Division: "security",
		Summary: "Discreet lobby, banquet and guest-floor cover that does not feel like security.",
		Detail:  "Hospitality guarding is deliberately quiet. Personnel are groomed and briefed to guest-facing standards, work the lobby and porch without crowding arrivals, and manage banquet and function-hall crowds by anticipating rather than intervening. Guest-floor rounds, key-control discipline and back-of-house material gate-pass run in the background.",
		Icon:    "bell", Image: "/static/img/services/mall.jpg",
		Scope: []string{"Lobby, porch and driveway cover", "Banquet and function-hall crowd management", "Guest-floor rounds and key-control discipline", "Back-of-house material gate-pass control", "Staff entry frisking and locker checks", "Liaison with police for guest verification"},
		Fit:   []string{"Hotels, resorts and guest houses", "Banquet halls and convention venues", "Restaurants and bar operations", "Homestays and tourist lodges"},
	},
	{
		Slug: "warehouse-security", Name: "Warehouse & Logistics Security", Division: "security",
		Summary: "Dock discipline, seal verification and stock-gate control for godowns and depots.",
		Detail:  "In a warehouse, the security failure is almost always paperwork. Our godown postings verify seals at arrival and departure, match the gate pass to the invoice and the vehicle number to the manifest, supervise loading bays during dispatch, and count contractor labour in and out. Any seal discrepancy stops the vehicle and raises a written report before it moves.",
		Icon:    "box", Image: "/static/img/services/warehouse.jpg",
		Scope: []string{"Seal verification at inward and outward gate", "Gate pass, invoice and manifest three-way match", "Loading and unloading bay supervision", "Contractor labour headcount control", "Stock-area and cold-room access restriction", "Vehicle and driver detail logging"},
		Fit:   []string{"Distribution centres and depots", "Cold storage and agri godowns", "FMCG and e-commerce warehouses", "Transport yards and container depots"},
	},
	{
		Slug: "construction-site-security", Name: "Construction Site Security", Division: "security",
		Summary: "Material, machinery and labour-gate control for active project sites.",
		Detail:  "A live construction site loses steel, cable and diesel, mostly at night and mostly in small quantities. We man the material gate against the challan, log machinery movement, run night rounds over an unlit and changing site plan, and control labour entry against the contractor's headcount. Safety-gear compliance at the gate is part of the posting where the client asks for it.",
		Icon:    "helmet", Image: "/static/img/services/construction.jpg",
		Scope: []string{"Material inward challan verification", "Machinery and equipment movement log", "Night patrol over unlit and changing site plans", "Labour entry and exit headcount by contractor", "Diesel and fuel-issue watch", "Safety-gear compliance check at the gate"},
		Fit:   []string{"Building and infrastructure projects", "Road, bridge and embankment works", "Solar and transmission line projects", "Renovation and fit-out sites"},
	},
	{
		Slug: "event-security", Name: "Event & Crowd Management", Division: "security",
		Summary: "Gate, stage, VIP and crowd cover for festivals, functions and public events.",
		Detail:  "Event security is planned in the week before, not on the day. We walk the venue, mark entry and exit lanes, fix the barricade line, agree the stage and green-room cordon, and write an evacuation route that the organiser signs. On the day we deploy gate frisking, ticket or pass verification, queue management, lost-property handling and a named commander who owns every decision.",
		Icon:    "flag", Image: "/static/img/gallery/bagurumba-1.jpg", Featured: true,
		Scope: []string{"Pre-event venue survey and deployment plan", "Entry frisking and pass or ticket verification", "Barricade line and queue management", "Stage, green-room and VIP cordon", "Parking marshalling and traffic lanes", "Written evacuation route and named event commander"},
		Fit:   []string{"Bwisagu and festival grounds", "Weddings and social functions", "Political and public meetings", "Sports meets, fairs and exhibitions"},
	},
	{
		Slug: "armed-guard-services", Name: "Armed Guard Services", Division: "security",
		Summary: "Licensed armed personnel for high-value premises and cash-handling sites.",
		Detail:  "Armed deployment is licence-bound and audited. Every armed guard holds a valid arms licence and a documented range record, weapons are issued and returned against a register at each shift, and the posting is reviewed with the client and the local police station before commencement. We deploy armed personnel only where the threat assessment supports it.",
		Icon:    "shield-alt", Image: "/static/img/ops-parade.jpg",
		Scope: []string{"Licensed personnel with current range records", "Weapon issue and return register per shift", "Documented threat assessment before deployment", "Local police station intimation and liaison", "Quarterly re-qualification firing", "Strict escalation-of-force briefing"},
		Fit:   []string{"High-value bank branches", "Bullion, jewellery and cash premises", "Fuel and explosive storage sites", "Sensitive government installations"},
	},
	{
		Slug: "lady-security-guards", Name: "Lady Security Guards", Division: "security",
		Summary: "Trained women guards for frisking, hostel, retail and campus duty.",
		Detail:  "Our lady-guard programme has run since 2015 and is now the fastest-growing part of the roll. Women guards handle female frisking at gates and examination halls, girls' hostel and ward duty, retail fitting-room checks and event entry lanes. Site agreements specify separate rest and changing facilities as a precondition of deployment — we will not post where that is not provided.",
		Icon:    "person", Image: "/static/img/gallery/bodo-women.jpg", Featured: true,
		Scope: []string{"Female frisking at gates and examination halls", "Girls' hostel and female ward duty", "Retail fitting-room and floor checks", "Event and function entry lanes", "Separate rest and changing facilities mandated", "Same twenty-one day induction and refresher cycle"},
		Fit:   []string{"Schools, colleges and hostels", "Hospitals and nursing homes", "Retail and shopping centres", "Public events and examination venues"},
	},
	{
		Slug: "personal-security-officers", Name: "Personal Security Officers", Division: "security",
		Summary: "Close-protection officers and bouncers for individuals and functions.",
		Detail:  "Close protection is quiet, planned work: advance route checks, arrival and departure sequencing, venue reconnaissance and a low profile. Officers are selected for judgement and discretion rather than size, briefed individually on the principal's routine, and rotated to avoid pattern. Bouncer detachments for functions are deployed as a briefed team under a named leader.",
		Icon:    "user-shield", Image: "/static/img/ops-team.jpg",
		Scope: []string{"Advance route and venue reconnaissance", "Arrival and departure sequencing", "Discreet, plain-clothes or uniformed option", "Individual briefing on the principal's routine", "Bouncer detachments under a named team leader", "Rotation to avoid predictable patterns"},
		Fit:   []string{"Business owners and executives", "Public figures and visiting dignitaries", "Weddings and private functions", "Clubs, bars and ticketed venues"},
	},
	{
		Slug: "tea-estate-security", Name: "Tea Estate & Plantation Security", Division: "security",
		Summary: "Garden, factory and labour-line cover built for plantation operating rhythm.",
		Detail:  "A tea estate is a factory, a farm and a village at once, and its security load swings with the plucking calendar. We cover the leaf weighment point, the factory gate, the fuel and fertiliser store and the labour lines, run boundary rounds against green-leaf theft, and scale the deployment up for the season and back down afterwards without renegotiating the contract each time.",
		Icon:    "leaf", Image: "/static/img/gallery/rubber.jpg",
		Scope: []string{"Leaf weighment point supervision", "Factory gate and finished-stock control", "Boundary rounds against green-leaf theft", "Fuel, fertiliser and pesticide store watch", "Labour line and ration issue supervision", "Seasonal scale-up and scale-down of strength"},
		Fit:   []string{"Tea gardens and estates", "Rubber and areca plantations", "Agri-processing and cold chain units", "Nurseries and seed farms"},
	},
	{
		Slug: "government-establishment-security", Name: "Government & PSU Security", Division: "security",
		Summary: "Tender-compliant guarding for offices, institutions and public installations.",
		Detail:  "Government contracts are won and kept on documentation. We deploy against the tender's manpower schedule, maintain the attendance, wage and statutory registers that the department will inspect, and file the compliance returns on the department's own cycle. Personnel on public-facing counters are briefed on the office's grievance and visitor procedure.",
		Icon:    "landmark", Image: "/static/img/gallery/kokrajhar-rail.jpg",
		Scope: []string{"Deployment strictly to the tender manpower schedule", "Attendance, wage and statutory registers maintained on site", "Compliance returns filed on the department cycle", "Public counter and grievance-desk briefing", "Records room and store access control", "Council, board and institutional premises cover"},
		Fit:   []string{"BTC and state government offices", "Public sector undertakings and boards", "Public institutions and museums", "Water, power and transport installations"},
	},
	{
		Slug: "dog-squad", Name: "K9 Dog Squad", Division: "security",
		Summary: "Handler-led detection and patrol dogs for sweeps, events and night cover.",
		Detail:  "Dogs are deployed with their own handler, never reassigned between handlers, and worked in short cycles to keep detection reliable. We use them for pre-event venue sweeps, warehouse and perimeter night patrol, and explosive or narcotic search where the client's risk assessment calls for it. Kennelling, veterinary care and handler welfare are our cost, not yours.",
		Icon:    "paw", Image: "/static/img/ops-fire-training.jpg",
		Scope: []string{"Dedicated handler pairing, never rotated", "Pre-event and pre-visit venue sweeps", "Perimeter and warehouse night patrol", "Explosive and narcotic detection on request", "Short working cycles to preserve reliability", "Kennelling and veterinary care included"},
		Fit:   []string{"Large events and VIP visits", "Warehouses and industrial perimeters", "Educational campuses on examination days", "Government and high-risk installations"},
	},

	// ---------------------------------------------------------------- facility
	{
		Slug: "housekeeping-services", Name: "Housekeeping Services", Division: "facility",
		Summary: "Daily, periodic and deep-cleaning cycles on a published, auditable schedule.",
		Detail:  "Housekeeping fails when it is invisible until it is bad. We publish a schedule — daily cycles, weekly periodics and monthly deep work — put it on the wall, sign it off shift by shift, and audit it on the same field visit as your guarding. Consumables, machines and chemicals can be on our supply or yours, priced separately either way.",
		Icon:    "broom", Image: "/static/img/services/housekeeping.jpg", Featured: true,
		Scope: []string{"Daily cleaning cycles with signed checklists", "Weekly periodic and monthly deep cleaning", "Washroom hygiene rounds and consumable refill", "Machine scrubbing, buffing and floor polishing", "Pantry, cafeteria and common-area upkeep", "Supervisor-led audit on every field visit"},
		Fit:   []string{"Corporate offices and branches", "Hospitals and clinics", "Malls, showrooms and hotels", "Educational and institutional campuses"},
	},
	{
		Slug: "solid-waste-management", Name: "Solid Waste Management", Division: "facility",
		Summary: "Segregation at source, collection, and documented handover to authorised handlers.",
		Detail:  "Waste is a compliance exposure before it is a housekeeping task. We run segregation at source into wet, dry and hazardous streams, collect on a fixed round, maintain the quantity register, and hand over to authorised recyclers and disposal agencies against documentation you can produce in an inspection. Biomedical waste is handled strictly through licensed channels.",
		Icon:    "recycle", Image: "/static/img/services/housekeeping.jpg",
		Scope: []string{"Wet, dry and hazardous segregation at source", "Fixed-round collection and bin management", "Quantity register maintained per stream", "Documented handover to authorised handlers", "Biomedical waste via licensed channels only", "Composting and recycling coordination"},
		Fit:   []string{"Hospitals and diagnostic centres", "Townships and housing societies", "Institutional and office campuses", "Markets, malls and food courts"},
	},
	{
		Slug: "pest-control", Name: "Pest & Rodent Control", Division: "facility",
		Summary: "Scheduled treatment cycles for offices, kitchens, godowns and residences.",
		Detail:  "Pest control on a security contract is convenient rather than clever, but doing it on a fixed cycle with a treatment log is what actually keeps a godown clean. We run general disinfestation, rodent baiting with mapped station numbers, termite treatment and mosquito fogging, with the chemical, dosage and date recorded for every visit.",
		Icon:    "bug", Image: "/static/img/services/warehouse.jpg",
		Scope: []string{"General disinfestation on a fixed cycle", "Numbered and mapped rodent bait stations", "Anti-termite pre- and post-construction treatment", "Mosquito and fly fogging", "Kitchen and food-area safe-chemical protocol", "Chemical, dosage and date logged per visit"},
		Fit:   []string{"Food processing and kitchens", "Warehouses and cold storage", "Hospitals and hotels", "Offices and residential townships"},
	},
	{
		Slug: "horticulture-landscaping", Name: "Horticulture & Landscaping", Division: "facility",
		Summary: "Gardening, lawn upkeep and plantation maintenance for campuses and townships.",
		Detail:  "Grounds are the part of a facility every visitor sees first. Our horticulture teams handle lawn mowing and edging, hedge and topiary trimming, seasonal planting, irrigation upkeep and indoor plant rotation, on a calendar tied to the local growing season rather than a generic annual plan.",
		Icon:    "plant", Image: "/static/img/gallery/marigold.jpg",
		Scope: []string{"Lawn mowing, edging and weed control", "Hedge, shrub and topiary trimming", "Seasonal flowering and bed preparation", "Irrigation and sprinkler upkeep", "Indoor plant supply and rotation", "Tree pruning and monsoon-season safety checks"},
		Fit:   []string{"Corporate and institutional campuses", "Townships and housing societies", "Hotels, resorts and guest houses", "Government offices and public grounds"},
	},
	{
		Slug: "facade-tank-cleaning", Name: "Facade & Water Tank Cleaning", Division: "facility",
		Summary: "Periodic external glass, facade and overhead tank cleaning with safety cover.",
		Detail:  "This is the periodic work that gets deferred until it becomes a problem. We run facade and external glass cleaning with trained rope-access or cradle teams under a written safety plan, and overhead and underground tank cleaning with desilting, scrubbing, disinfection and a post-clean water test report handed to the client.",
		Icon:    "droplet", Image: "/static/img/services/office.jpg",
		Scope: []string{"External glass and facade cleaning", "Trained rope-access or cradle operation", "Written height-work safety plan per job", "Overhead and underground tank desilting", "Scrubbing, disinfection and chlorination", "Post-clean water test report"},
		Fit:   []string{"Office towers and glass facades", "Hotels, malls and hospitals", "Housing societies and townships", "Institutional and industrial buildings"},
	},

	// ---------------------------------------------------------------- manpower
	{
		Slug: "manpower-staffing", Name: "Contract Manpower & Staffing", Division: "manpower",
		Summary: "Workforce supplied on the NBSS roll — payroll, statutory filing and compliance included.",
		Detail:  "You specify the skill, the strength and the shift pattern; the people come on our roll. That means EPF, ESI, bonus, gratuity provisioning, leave, wage registers and inspection-ready compliance sit with us, and you receive one invoice with the statutory build-up shown line by line. Replacement for absence is our obligation, not a negotiation.",
		Icon:    "people", Image: "/static/img/services/warehouse.jpg", Featured: true,
		Scope: []string{"Recruitment, verification and onboarding", "Payroll processed and paid by the 7th", "EPF, ESI, bonus and leave administered by us", "Wage and attendance registers kept inspection-ready", "Guaranteed replacement against absence", "Single invoice with the statutory build-up shown"},
		Fit:   []string{"Manufacturing and processing units", "Warehouses and logistics operations", "Hospitals and hospitality", "Government and institutional contracts"},
	},
	{
		Slug: "front-office-staffing", Name: "Front Office & Receptionists", Division: "manpower",
		Summary: "Groomed, bilingual reception, telephone and visitor-desk staff.",
		Detail:  "Front-desk hiring is a communication hire, not a headcount hire. We screen for spoken Bodo, Assamese, Hindi and English as the site requires, train on visitor-management software, telephone handling and appointment discipline, and provide a trained relief so the desk is never unattended during lunch or leave.",
		Icon:    "headset", Image: "/static/img/services/hospital.jpg",
		Scope: []string{"Bodo, Assamese, Hindi and English screening", "Visitor management software training", "Telephone and appointment handling", "Courier, meeting-room and pantry coordination", "Grooming and uniform standard maintained", "Trained relief for lunch and leave cover"},
		Fit:   []string{"Corporate offices and clinics", "Hotels and showrooms", "Educational institutions", "Government and public offices"},
	},
	{
		Slug: "drivers-fleet-staffing", Name: "Drivers & Fleet Manpower", Division: "manpower",
		Summary: "Verified light and heavy vehicle drivers with licence and record checks.",
		Detail:  "Every driver is placed only after licence verification with the issuing RTO, a police record check and a practical driving assessment on the class of vehicle they will actually handle. Where the client wants it, we add a duty-hour log and a monthly fuel and maintenance summary so vehicle cost stops being a mystery line item.",
		Icon:    "wheel", Image: "/static/img/services/warehouse.jpg",
		Scope: []string{"Licence verification with the issuing RTO", "Police record check and reference check", "Practical assessment on the actual vehicle class", "Light, heavy and commercial categories", "Duty-hour and trip logging", "Monthly fuel and maintenance summary"},
		Fit:   []string{"Corporate and executive transport", "Ambulance and hospital fleets", "Logistics and distribution fleets", "Institutional and school transport"},
	},
	{
		Slug: "skilled-technical-manpower", Name: "Skilled & Technical Manpower", Division: "manpower",
		Summary: "Electricians, plumbers, technicians and helpers for building operations.",
		Detail:  "Building operations fall over when the maintenance hand is a phone call away instead of on site. We place licensed electricians, plumbers, AC and DG technicians, lift attendants and general helpers, on shift or on call, with a preventive maintenance checklist and a breakdown log that makes the next budget conversation easier.",
		Icon:    "wrench", Image: "/static/img/services/construction.jpg",
		Scope: []string{"Licensed electricians and wiremen", "Plumbers and sanitary technicians", "AC, DG set and pump-room technicians", "Lift attendants and building helpers", "Preventive maintenance checklists", "Breakdown log and monthly summary"},
		Fit:   []string{"Office and commercial buildings", "Hospitals and hotels", "Malls and multiplexes", "Industrial and institutional campuses"},
	},

	// -------------------------------------------------------------- electronic
	{
		Slug: "cctv-surveillance", Name: "CCTV & Video Surveillance", Division: "electronic",
		Summary: "Camera layout, installation and monitoring wired into the NBSS control room.",
		Detail:  "A camera nobody watches is a camera that only helps after the loss. We survey the site, design coverage around actual entry, cash and stock points rather than wall convenience, install and commission, and — where the client wants it — take the feed into the Kokrajhar control room so an alarm is seen live at three in the morning instead of found at nine.",
		Icon:    "camera", Image: "/static/img/ops-cctv.jpg", Featured: true,
		Scope: []string{"Site survey and coverage design", "IP and analogue camera supply and installation", "NVR/DVR configuration and retention setup", "Optional live monitoring from the NBSS control room", "Motion and line-crossing alarm rules", "Footage retrieval support for incidents and police"},
		Fit:   []string{"Bank branches and ATM sites", "Warehouses and industrial units", "Retail, malls and showrooms", "Campuses, townships and offices"},
	},
	{
		Slug: "access-control-systems", Name: "Access Control & Attendance", Division: "electronic",
		Summary: "Card, biometric and boom-barrier control integrated with the visitor register.",
		Detail:  "Access control is only as good as the exception handling. We install card, biometric and boom-barrier systems, then define who authorises an override, how it is logged and who reviews the log — because in practice every site has visitors, deliveries and forgotten cards. The same system doubles as an attendance source when the client wants it.",
		Icon:    "key", Image: "/static/img/ops-control-room.jpg",
		Scope: []string{"Card, PIN and biometric readers", "Boom barrier and turnstile integration", "Zone-wise and time-wise access rules", "Written override authorisation and logging", "Attendance export for payroll", "Integration with the manned visitor register"},
		Fit:   []string{"Corporate offices and data rooms", "Manufacturing and restricted zones", "Hospitals and laboratories", "Gated townships and parking"},
	},
	{
		Slug: "fire-safety-systems", Name: "Fire Detection & Safety Systems", Division: "electronic",
		Summary: "Alarm and extinguisher systems, plus the drills that make them work.",
		Detail:  "Fire systems are bought once and forgotten until an inspection. We supply and install detection and alarm panels, position and refill extinguishers, mark and keep clear the evacuation routes, and — the part that actually matters — run quarterly evacuation drills with your staff and our guards together, timed and recorded.",
		Icon:    "fire", Image: "/static/img/ops-fire-training.jpg",
		Scope: []string{"Smoke and heat detection with alarm panels", "Extinguisher supply, placement and refilling", "Hydrant and hose-reel checks", "Evacuation route marking and signage", "Quarterly timed evacuation drills", "Fire-warden training for client staff"},
		Fit:   []string{"Industrial and processing units", "Hospitals and educational campuses", "Hotels, malls and offices", "Warehouses and godowns"},
	},
	{
		Slug: "control-room-monitoring", Name: "24×7 Control Room & Monitoring", Division: "electronic",
		Summary: "Beat check-ins, alarm response and escalation from a room that is never empty.",
		Detail:  "The Kokrajhar control room is the spine of every NBSS contract. Sites check in on a fixed beat; a missed check-in escalates to the area field officer within ten minutes and to the duty manager within twenty. Alarms, incidents and deviations are logged with timestamps, and clients get a monthly report of every event on their site — including the ones that turned out to be nothing.",
		Icon:    "radio", Image: "/static/img/ops-control-room.jpg", Featured: true,
		Scope: []string{"Fixed-interval beat check-in from every site", "Ten and twenty minute escalation ladder", "Live alarm and CCTV event response", "Timestamped incident and deviation log", "Emergency liaison with police and fire services", "Monthly per-site event report to the client"},
		Fit:   []string{"Every NBSS contract, by default", "Multi-site clients needing one view", "Remote and unmanned installations", "High-value and high-risk premises"},
	},
}

// Sector is an industry vertical shown on the sectors strip.
type Sector struct {
	Slug  string
	Name  string
	Blurb string
	Image string
}

// Sectors are the verticals NBSS explicitly sells into.
var Sectors = []Sector{
	{Slug: "bfsi", Name: "Banking & Finance", Blurb: "Branches, ATMs, cash movement and collection centres under RBI-aligned protocol.", Image: "/static/img/ops-bank.jpg"},
	{Slug: "healthcare", Name: "Healthcare", Blurb: "Casualty, wards, pharmacy and biomedical waste, handled without raising the temperature.", Image: "/static/img/services/hospital.jpg"},
	{Slug: "education", Name: "Education", Blurb: "Campus gates, hostels and examination duty with enhanced-verification personnel.", Image: "/static/img/gallery/kokrajhar-med.jpg"},
	{Slug: "retail", Name: "Retail & Malls", Blurb: "Shrinkage control, crowd flow, parking and the closing sweep.", Image: "/static/img/services/mall.jpg"},
	{Slug: "industry", Name: "Manufacturing", Blurb: "Weighbridge, gate pass, scrap yard and shift-change discipline.", Image: "/static/img/services/construction.jpg"},
	{Slug: "plantations", Name: "Tea & Plantations", Blurb: "Leaf weighment, factory gate and labour lines, scaled to the plucking calendar.", Image: "/static/img/gallery/rubber.jpg"},
	{Slug: "government", Name: "Government & PSU", Blurb: "Tender-compliant deployment with inspection-ready registers.", Image: "/static/img/gallery/kokrajhar-rail.jpg"},
	{Slug: "logistics", Name: "Logistics & Warehousing", Blurb: "Seal verification, dock supervision and three-way manifest matching.", Image: "/static/img/services/warehouse.jpg"},
	{Slug: "hospitality", Name: "Hospitality", Blurb: "Lobby, banquet and guest-floor cover that stays out of the guest's way.", Image: "/static/img/gallery/manas.jpg"},
	{Slug: "residential", Name: "Residential", Blurb: "Visitor confirmation, vendor passes and a night round that reaches the back wall.", Image: "/static/img/services/office.jpg"},
	{Slug: "events", Name: "Events & Festivals", Blurb: "Barricade lines, frisking lanes and a named commander who owns the day.", Image: "/static/img/gallery/bagurumba-1.jpg"},
	{Slug: "infrastructure", Name: "Construction & Infra", Blurb: "Material challans, machinery logs and night patrol over a changing site plan.", Image: "/static/img/services/construction.jpg"},
}

// ServiceBySlug returns a service and whether it was found.
func ServiceBySlug(slug string) (Service, bool) {
	for _, s := range Services {
		if s.Slug == slug {
			return s, true
		}
	}
	return Service{}, false
}

// DivisionBySlug returns a division and whether it was found.
func DivisionBySlug(slug string) (Division, bool) {
	for _, d := range Divisions {
		if d.Slug == slug {
			return d, true
		}
	}
	return Division{}, false
}

// ServicesIn returns every service belonging to a division, in catalogue order.
func ServicesIn(division string) []Service {
	out := make([]Service, 0, len(Services))
	for _, s := range Services {
		if s.Division == division {
			out = append(out, s)
		}
	}
	return out
}

// FeaturedServices returns the services flagged for the homepage grid.
func FeaturedServices() []Service {
	out := make([]Service, 0, 12)
	for _, s := range Services {
		if s.Featured {
			out = append(out, s)
		}
	}
	return out
}

// RelatedServices returns up to n other services from the same division.
func RelatedServices(s Service, n int) []Service {
	out := make([]Service, 0, n)
	for _, c := range Services {
		if c.Division != s.Division || c.Slug == s.Slug {
			continue
		}
		out = append(out, c)
		if len(out) == n {
			break
		}
	}
	return out
}

// SearchServices does a simple case-insensitive substring match over the fields
// a visitor is likely to type. It is deliberately dumb: the catalogue is thirty
// items long, so an index would cost more than it saves.
func SearchServices(q string) []Service {
	q = strings.ToLower(strings.TrimSpace(q))
	if q == "" {
		return nil
	}
	out := make([]Service, 0, 8)
	for _, s := range Services {
		hay := strings.ToLower(s.Name + " " + s.Summary + " " + s.Division + " " +
			strings.Join(s.Fit, " ") + " " + strings.Join(s.Scope, " "))
		if strings.Contains(hay, q) {
			out = append(out, s)
		}
	}
	return out
}
