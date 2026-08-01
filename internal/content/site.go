// Package content holds the editorial content of the NBSS site.
//
// Everything here is plain Go data. There is no CMS and no database behind the
// public pages: the marketing copy changes rarely, so keeping it in typed
// structs gives us compile-time safety and zero-latency rendering.
package content

// Site carries the global company facts used in headers, footers and schema.org
// markup.
type Site struct {
	Name       string
	ShortName  string
	Expansion  string
	Tagline    string
	Descriptor string
	Founded    int
	Phone      string
	PhoneAlt   string
	Emergency  string
	Email      string
	EmailHR    string
	Address    Address
	Hours      []string
	Social     []Link
	Licenses   []Credential
}

// Address is the registered office of the agency.
type Address struct {
	Line1    string
	Line2    string
	City     string
	District string
	State    string
	Pin      string
	MapURL   string
	Lat      string
	Lng      string
}

// Link is a labelled URL, used for social profiles and footer navigation.
type Link struct {
	Label string
	URL   string
	Icon  string
}

// Credential is a licence, registration or certification the agency holds.
type Credential struct {
	Label  string
	Number string
	Body   string
	Note   string
}

// SiteInfo is the single source of truth for company-wide facts.
var SiteInfo = Site{
	Name:       "National Bodo Security Services",
	ShortName:  "NBSS",
	Expansion:  "National Bodo Security Services",
	Tagline:    "Trained in Bodoland. Trusted across the Northeast.",
	Descriptor: "A PSARA-licensed private security, facility management and manpower agency headquartered in Kokrajhar, the seat of the Bodoland Territorial Region.",
	Founded:    2009,
	Phone:      "+91 98640 12345",
	PhoneAlt:   "+91 94351 67890",
	Emergency:  "+91 90850 00911",
	Email:      "contact@nbss.co.in",
	EmailHR:    "careers@nbss.co.in",
	Address: Address{
		Line1:    "NBSS House, Jwhwlao Dwimalu Road",
		Line2:    "Near Bharat Petrol Pump, Ward No. 4",
		City:     "Kokrajhar",
		District: "Kokrajhar",
		State:    "Assam (Bodoland Territorial Region)",
		Pin:      "783370",
		MapURL:   "https://www.openstreetmap.org/?mlat=26.4009&mlon=90.2711#map=14/26.4009/90.2711",
		Lat:      "26.4009",
		Lng:      "90.2711",
	},
	Hours: []string{
		"Corporate office — Mon to Sat, 09:30 to 18:00",
		"Control room & deployment desk — 24 × 7 × 365",
	},
	Social: []Link{
		{Label: "Facebook", URL: "#", Icon: "facebook"},
		{Label: "Instagram", URL: "#", Icon: "instagram"},
		{Label: "LinkedIn", URL: "#", Icon: "linkedin"},
		{Label: "YouTube", URL: "#", Icon: "youtube"},
	},
	Licenses: []Credential{
		{Label: "PSARA Licence", Number: "PSARA/ASM/BTR/2009/0417", Body: "Controlling Authority, Government of Assam", Note: "Private Security Agencies (Regulation) Act, 2005"},
		{Label: "ISO 9001:2015", Number: "QMS/IN/22/8841", Body: "Quality Management System", Note: "Guarding, facility & manpower operations"},
		{Label: "ESIC Registration", Number: "11000456780000999", Body: "Employees' State Insurance Corporation", Note: "Every deployed person covered"},
		{Label: "EPFO Registration", Number: "ASGHT2209841000", Body: "Employees' Provident Fund Organisation", Note: "Monthly ECR filed before the 15th"},
		{Label: "GSTIN", Number: "18AABCN4417Q1ZP", Body: "Goods & Services Tax", Note: "Assam — state code 18"},
		{Label: "Labour Licence", Number: "CLRA/KKJ/2019/226", Body: "Contract Labour (R&A) Act, 1970", Note: "Renewed annually"},
	},
}

// Stat is a headline number shown on the homepage counter strip.
type Stat struct {
	Value  string
	Suffix string
	Label  string
	Note   string
}

// Stats are the six figures the agency leads with.
var Stats = []Stat{
	{Value: "1800", Suffix: "+", Label: "Trained personnel", Note: "On the active deployment roll"},
	{Value: "240", Suffix: "+", Label: "Client sites", Note: "Guarded across the Northeast"},
	{Value: "8", Suffix: "", Label: "Districts covered", Note: "Five BTR districts plus three"},
	{Value: "16", Suffix: " yrs", Label: "In operation", Note: "Registered in 2009"},
	{Value: "24", Suffix: "×7", Label: "Control room", Note: "Never unstaffed, never outsourced"},
	{Value: "96", Suffix: "%", Label: "Contract renewal", Note: "Rolling three-year average"},
}

// Pillar is one of the reasons-to-choose blocks.
type Pillar struct {
	Index string
	Title string
	Body  string
	Icon  string
}

// Pillars back the "Why NBSS" section.
var Pillars = []Pillar{
	{
		Index: "01",
		Title: "Recruited from the region we protect",
		Body:  "Our guards come from Kokrajhar, Chirang, Baksa, Udalguri and Tamulpur. They know the roads, the dialects and the neighbours. A stranger at the gate is spotted by someone who actually knows who belongs there.",
		Icon:  "roots",
	},
	{
		Index: "02",
		Title: "Verified before they ever wear the uniform",
		Body:  "Aadhaar and address verification, police clearance from the home thana, two independent references and a medical fitness check. No candidate is deployed on a client site until the file is closed.",
		Icon:  "shield-check",
	},
	{
		Index: "03",
		Title: "Twenty-one days of drill, then never finished",
		Body:  "Foundation training covers access control, fire response, first aid, frisking protocol, incident reporting and conduct. Refresher drills run every quarter at the Kokrajhar training ground.",
		Icon:  "drill",
	},
	{
		Index: "04",
		Title: "Wages paid by the 7th, statutorily and in full",
		Body:  "EPF, ESI, bonus and leave encashment are calculated on the declared wage, not a fiction. A guard who is paid properly and on time is a guard who stays awake at 03:00.",
		Icon:  "rupee",
	},
	{
		Index: "05",
		Title: "A control room that answers on the second ring",
		Body:  "Every site checks in on a fixed beat. Missed check-ins escalate to the area field officer within ten minutes and to the duty manager within twenty. Escalation is a procedure, not a phone tree.",
		Icon:  "radio",
	},
	{
		Index: "06",
		Title: "One contract, the whole building",
		Body:  "Guarding, housekeeping, waste handling, electronic surveillance and skilled manpower under a single agreement, a single invoice and a single point of accountability.",
		Icon:  "layers",
	},
}

// District is one administrative area in the coverage map.
type District struct {
	Name   string
	Region string
	Sites  string
	Core   bool
}

// Coverage lists where NBSS actually deploys.
var Coverage = []District{
	{Name: "Kokrajhar", Region: "Bodoland Territorial Region", Sites: "HQ + 68 sites", Core: true},
	{Name: "Chirang", Region: "Bodoland Territorial Region", Sites: "31 sites", Core: true},
	{Name: "Baksa", Region: "Bodoland Territorial Region", Sites: "27 sites", Core: true},
	{Name: "Udalguri", Region: "Bodoland Territorial Region", Sites: "24 sites", Core: true},
	{Name: "Tamulpur", Region: "Bodoland Territorial Region", Sites: "16 sites", Core: true},
	{Name: "Bongaigaon", Region: "Lower Assam", Sites: "22 sites", Core: false},
	{Name: "Dhubri", Region: "Lower Assam", Sites: "18 sites", Core: false},
	{Name: "Kamrup (Guwahati)", Region: "Lower Assam", Sites: "34 sites", Core: false},
}

// Milestone is one entry on the company timeline.
type Milestone struct {
	Year string
	Body string
}

// Timeline is the abridged company history shown on the About page.
var Timeline = []Milestone{
	{Year: "2009", Body: "Registered at Kokrajhar with 42 guards, two supervisors and a single Bolero. First contract: night guarding for a cluster of four rice mills on the Gossaigaon road."},
	{Year: "2012", Body: "PSARA licence granted by the Controlling Authority, Government of Assam. Formal twenty-one day induction syllabus written and adopted."},
	{Year: "2015", Body: "First lady-guard batch commissioned — twenty-four women trained for school, hospital and retail frisking duty."},
	{Year: "2018", Body: "Facility management division opened: housekeeping, waste handling and horticulture added to the guarding contract."},
	{Year: "2020", Body: "Kokrajhar control room commissioned. Beat check-ins, incident logging and escalation moved off paper registers."},
	{Year: "2022", Body: "Electronic security division launched — CCTV, access control and fire alarm integration for BFSI and industrial clients."},
	{Year: "2024", Body: "Crossed 1,500 personnel on roll. ISO 9001:2015 certification awarded for guarding and facility operations."},
	{Year: "2026", Body: "Guwahati branch office opened to serve Lower Assam clients without diluting the Bodoland recruitment base."},
}

// Person is a member of the leadership team.
type Person struct {
	Name  string
	Role  string
	Bio   string
	Photo string
}

// Leadership is the managing team shown on the About page.
var Leadership = []Person{
	{Name: "Khampa Basumatary", Role: "Managing Director", Bio: "Founded NBSS in 2009 after fourteen years with a national guarding major in Guwahati. Signs off on every district-level deployment plan personally.", Photo: ""},
	{Name: "Rwmwi Narzary", Role: "Director — Operations", Bio: "Runs the control room, the beat system and the escalation matrix. Ex-Assam Police, retired as Sub-Inspector from the Kokrajhar district reserve.", Photo: ""},
	{Name: "Daimalu Boro", Role: "Head — Training & Compliance", Bio: "Owns the induction syllabus and the quarterly refresher calendar. Certified fire-safety and first-response instructor.", Photo: ""},
	{Name: "Swrang Mushahary", Role: "Head — Facility Management", Bio: "Built the housekeeping and waste-handling division from a two-site pilot into a 400-person operation.", Photo: ""},
	{Name: "Anjali Brahma", Role: "Head — Human Resources", Bio: "Verification, payroll, EPF/ESI filing and the lady-guard recruitment programme. Nothing gets deployed without her clearance.", Photo: ""},
	{Name: "Pranjal Basumatary", Role: "Head — Electronic Security", Bio: "Designs CCTV, access-control and fire-alarm layouts, and integrates them into the NBSS control room feed.", Photo: ""},
}

// Testimonial is a client quote.
type Testimonial struct {
	Quote   string
	Author  string
	Role    string
	Company string
	Sector  string
}

// Testimonials appear on the homepage and the clients page.
var Testimonials = []Testimonial{
	{
		Quote:   "We moved three branches to NBSS after a cash-escort scare with our previous agency. Four years on, the muster is full every single morning — including the two branches that are an hour off the highway.",
		Author:  "Branch Operations Manager",
		Role:    "Regional Office",
		Company: "A scheduled commercial bank, Kokrajhar",
		Sector:  "Banking & finance",
	},
	{
		Quote:   "Their lady guards handle the girls' hostel gate and the examination-hall frisking. Parents ask about it at admission time, and we have an answer we are comfortable giving.",
		Author:  "Administrative Officer",
		Role:    "Campus Administration",
		Company: "A degree college, Chirang",
		Sector:  "Education",
	},
	{
		Quote:   "Plucking season doubles our headcount overnight and the gate load with it. NBSS scales the deployment up in a week and back down without an argument over the bill.",
		Author:  "Estate Manager",
		Role:    "Garden Operations",
		Company: "A tea estate, Udalguri",
		Sector:  "Plantations",
	},
	{
		Quote:   "One contract covers our guards, the housekeeping team and the waste segregation. One invoice, one field officer to call. That alone saved my department a working day a month.",
		Author:  "Facility Head",
		Role:    "Administration",
		Company: "A multi-speciality hospital, Bongaigaon",
		Sector:  "Healthcare",
	},
	{
		Quote:   "The night shift log is filled in properly, in handwriting we can read, with the actual time of each round. That sounds small until you have audited an agency that does not do it.",
		Author:  "Plant Security Officer",
		Role:    "Industrial Security",
		Company: "A food processing unit, Bongaigaon",
		Sector:  "Manufacturing",
	},
}

// FAQ is a question and answer shown on the contact page.
type FAQ struct {
	Q string
	A string
}

// FAQs answer the questions prospects actually ask first.
var FAQs = []FAQ{
	{
		Q: "How quickly can guards be deployed at a new site?",
		A: "A standard commercial site inside the five BTR districts is surveyed within 48 hours and manned within seven working days. Armed deployment, dog squad and sites outside our core districts take two to three weeks because of licensing and relocation.",
	},
	{
		Q: "Is NBSS licensed under PSARA?",
		A: "Yes. We hold a Private Security Agencies (Regulation) Act licence issued by the Controlling Authority, Government of Assam, along with ESIC, EPFO, GST and Contract Labour registrations. Copies are shared with the contract.",
	},
	{
		Q: "How are your guards verified?",
		A: "Aadhaar and permanent address verification, police clearance from the home police station, two independent references and a medical fitness certificate. The file is closed before the uniform is issued, and re-verification runs every two years.",
	},
	{
		Q: "What does a guard actually cost per month?",
		A: "Billing is built up from the Assam minimum wage for the applicable skill category, plus EPF, ESI, bonus, leave, uniform and the agency service charge, plus GST. We publish the build-up line by line in the quotation — there are no bundled or hidden heads.",
	},
	{
		Q: "Can we get female security guards?",
		A: "Yes. We have run a dedicated lady-guard programme since 2015 for schools, colleges, hospitals, retail and event frisking duty, with separate rest and changing facilities specified in the site agreement.",
	},
	{
		Q: "Do you handle housekeeping and waste along with guarding?",
		A: "Yes — that is the point of the facility management division. Guarding, housekeeping, solid waste handling, pest control, horticulture and skilled manpower can run on one agreement, one invoice and one field officer.",
	},
	{
		Q: "What happens if a guard does not report for duty?",
		A: "The relieving guard's absence is flagged at shift change. The area field officer places a reliever from the district float within four hours, and the shortfall is credited on the next invoice. Absence is our cost, not yours.",
	},
	{
		Q: "Do you work outside Bodoland?",
		A: "We deploy across the five BTR districts plus Bongaigaon, Dhubri and Kamrup (Guwahati). Requests from elsewhere in the Northeast are taken case by case — we will say no rather than take a site we cannot supervise properly.",
	},
}
