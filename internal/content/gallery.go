package content

import "strings"

// Photo is one image in the gallery, with the attribution its licence requires.
type Photo struct {
	Src      string
	Alt      string
	Caption  string
	Category string // operations | training | bodoland | community
	Credit   string
	Licence  string
	Tall     bool // renders across two grid rows
}

// GalleryCategory is a filter chip on the gallery page.
type GalleryCategory struct {
	Slug  string
	Label string
}

// GalleryCategories drives the HTMX filter strip. "all" must stay first.
var GalleryCategories = []GalleryCategory{
	{Slug: "all", Label: "Everything"},
	{Slug: "operations", Label: "Operations"},
	{Slug: "training", Label: "Training"},
	{Slug: "bodoland", Label: "Bodoland"},
	{Slug: "community", Label: "Community"},
}

// Gallery is the full photo set. Attribution is mandatory for the CC BY and
// CC BY-SA images and is rendered under each tile.
var Gallery = []Photo{
	{Src: "/static/img/hero-guard.jpg", Alt: "A uniformed security guard on duty at a campus gate", Caption: "Gate duty, morning shift", Category: "operations", Credit: "liber(the poet)", Licence: "CC BY-SA 2.0", Tall: true},
	{Src: "/static/img/ops-team.jpg", Alt: "A security team standing in formation", Caption: "Shift briefing before deployment", Category: "operations", Credit: "Wikimedia Commons", Licence: "CC BY-SA 4.0"},
	{Src: "/static/img/ops-drill.jpg", Alt: "Security personnel during a formation drill", Caption: "Drill square, Kokrajhar training ground", Category: "training", Credit: "Beijing Patrol", Licence: "CC BY 2.0"},
	{Src: "/static/img/ops-parade.jpg", Alt: "Guards in formation during morning parade", Caption: "Morning turnout inspection", Category: "training", Credit: "Beijing Patrol", Licence: "CC BY 2.0"},
	{Src: "/static/img/ops-fire-training.jpg", Alt: "Fire safety training with an extinguisher", Caption: "Quarterly fire response refresher", Category: "training", Credit: "BLM Oregon & Washington", Licence: "CC BY-SA 2.0", Tall: true},
	{Src: "/static/img/ops-cctv.jpg", Alt: "Close-up of a CCTV surveillance camera", Caption: "Perimeter camera commissioning", Category: "operations", Credit: "Ivan Radic", Licence: "CC BY 2.0"},
	{Src: "/static/img/ops-cctv2.jpg", Alt: "A 24-hour CCTV surveillance sign and camera", Caption: "Twenty-four hour monitored site", Category: "operations", Credit: "stwn", Licence: "CC BY-SA 2.0"},
	{Src: "/static/img/ops-control-room.jpg", Alt: "Operators watching screens in a control room", Caption: "Control room, night watch", Category: "operations", Credit: "West Midlands Police", Licence: "CC BY-SA 2.0", Tall: true},
	{Src: "/static/img/ops-bank.jpg", Alt: "A security guard posted outside a bank", Caption: "Branch posting, opening drill", Category: "operations", Credit: "Brad & Ying", Licence: "CC BY 2.0"},

	{Src: "/static/img/gallery/aronai.jpg", Alt: "An Aronai, the traditional woven Bodo scarf", Caption: "The Aronai — the woven band our identity is drawn from", Category: "bodoland", Credit: "Wikimedia Commons", Licence: "CC BY 4.0", Tall: true},
	{Src: "/static/img/gallery/aronai-2.jpg", Alt: "Detail of Aronai weaving showing diamond motifs", Caption: "Diamond motif, hand-loomed", Category: "bodoland", Credit: "Wikimedia Commons", Licence: "CC BY-SA 4.0"},
	{Src: "/static/img/gallery/bagurumba-1.jpg", Alt: "Bodo women performing the Bagurumba dance", Caption: "Bagurumba — the butterfly dance", Category: "community", Credit: "Wikimedia Commons", Licence: "CC BY-SA 4.0"},
	{Src: "/static/img/gallery/bagurumba-2.jpg", Alt: "Bagurumba dancers in traditional dokhona", Caption: "Festival ground deployment, Bwisagu week", Category: "community", Credit: "Wikimedia Commons", Licence: "CC BY-SA 4.0"},
	{Src: "/static/img/gallery/bagurumba-3.jpg", Alt: "A Bagurumba performance in progress", Caption: "Crowd management at a cultural meet", Category: "community", Credit: "Wikimedia Commons", Licence: "CC BY-SA 4.0", Tall: true},
	{Src: "/static/img/gallery/bwisagu.jpg", Alt: "Bwisagu festival dance performance", Caption: "Bwisagu — the Bodo new year", Category: "community", Credit: "Wikimedia Commons", Licence: "CC BY-SA 4.0"},
	{Src: "/static/img/gallery/bardoi-sikhla.jpg", Alt: "Bodo girls performing the Bardoi Sikhla dance", Caption: "Bardoi Sikhla, harvest season", Category: "community", Credit: "Wikimedia Commons", Licence: "CC BY 2.0"},
	{Src: "/static/img/gallery/bodo-women.jpg", Alt: "Bodo women in traditional dokhona", Caption: "The recruitment base our lady-guard programme draws on", Category: "bodoland", Credit: "Wikimedia Commons", Licence: "CC BY-SA 3.0"},
	{Src: "/static/img/gallery/bodo-elder.jpg", Alt: "An elderly Bodo man", Caption: "Kokrajhar district", Category: "bodoland", Credit: "Wikimedia Commons", Licence: "CC BY-SA 4.0"},
	{Src: "/static/img/gallery/kokrajhar-rail.jpg", Alt: "Kokrajhar railway station building", Caption: "Kokrajhar station — public installation duty", Category: "bodoland", Credit: "Wikimedia Commons", Licence: "CC0"},
	{Src: "/static/img/gallery/kokrajhar-med.jpg", Alt: "Kokrajhar Medical College and cancer care centre", Caption: "Kokrajhar Medical College", Category: "bodoland", Credit: "Wikimedia Commons", Licence: "CC BY-SA 4.0"},
	{Src: "/static/img/gallery/kokrajhar-eve.jpg", Alt: "Evening at Kokrajhar Medical College", Caption: "Evening handover, hospital posting", Category: "operations", Credit: "Wikimedia Commons", Licence: "CC BY-SA 4.0"},
	{Src: "/static/img/gallery/manas.jpg", Alt: "Manas National Park landscape", Caption: "Manas — the northern edge of our coverage", Category: "bodoland", Credit: "Wikimedia Commons", Licence: "CC BY 3.0", Tall: true},
	{Src: "/static/img/gallery/manas-2.jpg", Alt: "Grassland and forest in Manas National Park", Caption: "Grassland boundary, Baksa district", Category: "bodoland", Credit: "Wikimedia Commons", Licence: "CC BY-SA 4.0"},
	{Src: "/static/img/gallery/rubber.jpg", Alt: "Rubber sheets drying in Kokrajhar district", Caption: "Rubber sheets drying — plantation client site", Category: "operations", Credit: "Wikimedia Commons", Licence: "CC BY-SA 4.0"},
	{Src: "/static/img/gallery/marigold.jpg", Alt: "Marigolds in bloom in Kokrajhar", Caption: "Horticulture upkeep, Kokrajhar", Category: "community", Credit: "Wikimedia Commons", Licence: "CC BY 4.0"},
	{Src: "/static/img/services/mall.jpg", Alt: "Interior of a shopping mall", Caption: "Retail floor, closing sweep", Category: "operations", Credit: "shankar s.", Licence: "CC BY 2.0"},
	{Src: "/static/img/services/warehouse.jpg", Alt: "Warehouse and logistics facility", Caption: "Dock supervision, distribution centre", Category: "operations", Credit: "tm-md", Licence: "CC BY 2.0"},
	{Src: "/static/img/services/housekeeping.jpg", Alt: "Housekeeping staff at work", Caption: "Housekeeping cycle, morning", Category: "operations", Credit: "vastateparksstaff", Licence: "CC BY 2.0"},
}

// PhotosIn returns the gallery filtered by category. "all" or "" returns
// everything.
func PhotosIn(category string) []Photo {
	category = strings.ToLower(strings.TrimSpace(category))
	if category == "" || category == "all" {
		return Gallery
	}
	out := make([]Photo, 0, len(Gallery))
	for _, p := range Gallery {
		if p.Category == category {
			out = append(out, p)
		}
	}
	return out
}

// Client is a logo-wall entry. Names are sector descriptions rather than real
// trademarks — see README.
type Client struct {
	Name   string
	Sector string
	Since  string
	Sites  int
}

// Clients is the reference list shown on the clients page.
var Clients = []Client{
	{Name: "Regional cooperative bank", Sector: "Banking & finance", Since: "2013", Sites: 11},
	{Name: "District multi-speciality hospital", Sector: "Healthcare", Since: "2016", Sites: 3},
	{Name: "Degree college, Chirang", Sector: "Education", Since: "2017", Sites: 2},
	{Name: "Rice milling cluster, Gossaigaon", Sector: "Manufacturing", Since: "2009", Sites: 6},
	{Name: "Tea estate group, Udalguri", Sector: "Plantations", Since: "2018", Sites: 4},
	{Name: "Retail chain, Lower Assam", Sector: "Retail", Since: "2019", Sites: 14},
	{Name: "Distribution warehouse operator", Sector: "Logistics", Since: "2020", Sites: 5},
	{Name: "Housing society federation", Sector: "Residential", Since: "2015", Sites: 9},
	{Name: "Public sector undertaking, BTR", Sector: "Government & PSU", Since: "2021", Sites: 7},
	{Name: "Hotel and resort group", Sector: "Hospitality", Since: "2019", Sites: 3},
	{Name: "Infrastructure contractor", Sector: "Construction", Since: "2022", Sites: 8},
	{Name: "Higher secondary school network", Sector: "Education", Since: "2014", Sites: 6},
	{Name: "Cold storage operator, Dhubri", Sector: "Logistics", Since: "2021", Sites: 2},
	{Name: "Diagnostic chain, Bongaigaon", Sector: "Healthcare", Since: "2023", Sites: 4},
	{Name: "Fuel station network", Sector: "Retail", Since: "2017", Sites: 12},
	{Name: "Agro processing unit", Sector: "Manufacturing", Since: "2020", Sites: 2},
}

// Vacancy is an open position on the careers page.
type Vacancy struct {
	ID          string
	Title       string
	Type        string // Full-time | Contract
	Location    string
	Openings    int
	Pay         string
	Experience  string
	Summary     string
	Requirements []string
}

// Vacancies are the currently advertised roles.
var Vacancies = []Vacancy{
	{
		ID: "sg-kkj", Title: "Security Guard", Type: "Full-time", Location: "Kokrajhar & Chirang", Openings: 60,
		Pay: "As per Assam minimum wage + EPF, ESI, bonus", Experience: "Freshers welcome",
		Summary: "Gate, floor and perimeter duty on commercial, industrial and institutional sites. Twenty-one day paid induction before first posting.",
		Requirements: []string{"Age 21–45, physically fit", "Class VIII pass or above", "Height 168 cm and above (relaxable for ST candidates)", "Aadhaar, address proof and two references", "Willing to work rotating shifts"},
	},
	{
		ID: "lg-btr", Title: "Lady Security Guard", Type: "Full-time", Location: "All five BTR districts", Openings: 35,
		Pay: "As per Assam minimum wage + EPF, ESI, bonus", Experience: "Freshers welcome",
		Summary: "Frisking, hostel, ward and retail floor duty. Postings are only made to sites with separate rest and changing facilities.",
		Requirements: []string{"Age 20–45, physically fit", "Class VIII pass or above", "Aadhaar, address proof and two references", "Day-shift and general-shift postings available", "Local candidates from BTR districts preferred"},
	},
	{
		ID: "sup-btr", Title: "Security Supervisor", Type: "Full-time", Location: "Kokrajhar, Baksa, Udalguri", Openings: 12,
		Pay: "₹16,000 – ₹21,000 per month", Experience: "2+ years in guarding",
		Summary: "Runs the muster, the shift handover and the site register for a cluster of postings. First escalation point for the guards on site.",
		Requirements: []string{"Two years or more as a security guard", "Class X pass", "Able to write a clear incident report in Assamese or English", "Two-wheeler licence preferred", "Ex-servicemen and ex-police strongly encouraged"},
	},
	{
		ID: "fo-btr", Title: "Field Officer", Type: "Full-time", Location: "Kokrajhar (roving)", Openings: 5,
		Pay: "₹22,000 – ₹28,000 per month + travel", Experience: "3+ years in security operations",
		Summary: "Owns a district cluster: surprise checks, reliever placement, client liaison and monthly compliance reporting.",
		Requirements: []string{"Three years in security or facility operations", "Graduate preferred, Class XII minimum", "Valid two-wheeler or four-wheeler licence", "Comfortable with night surprise checks", "Fluent in Bodo and Assamese"},
	},
	{
		ID: "cro-kkj", Title: "Control Room Operator", Type: "Full-time", Location: "Kokrajhar HQ", Openings: 6,
		Pay: "₹15,000 – ₹19,000 per month", Experience: "1+ year preferred",
		Summary: "Works the beat check-in board, logs incidents and drives the escalation ladder on the night shift.",
		Requirements: []string{"Class XII pass with basic computer skills", "Comfortable on rotating night shifts", "Clear telephone manner in Bodo, Assamese and Hindi", "Able to maintain an accurate written log", "CCTV monitoring experience an advantage"},
	},
	{
		ID: "hk-btr", Title: "Housekeeping Staff", Type: "Full-time", Location: "Kokrajhar, Bongaigaon", Openings: 40,
		Pay: "As per Assam minimum wage + EPF, ESI, bonus", Experience: "Freshers welcome",
		Summary: "Daily and periodic cleaning cycles on office, hospital and institutional sites, working to a signed checklist.",
		Requirements: []string{"Age 18–50, physically fit", "No formal education requirement", "Aadhaar and address proof", "Training provided on machines and chemicals", "Male and female candidates both welcome"},
	},
	{
		ID: "drv-btr", Title: "Driver (LMV / HMV)", Type: "Full-time", Location: "Kokrajhar, Guwahati", Openings: 8,
		Pay: "₹14,000 – ₹20,000 per month", Experience: "2+ years driving",
		Summary: "Client vehicle, ambulance and logistics duty. Licence is verified with the issuing RTO before placement.",
		Requirements: []string{"Valid LMV or HMV licence, minimum two years old", "Clean police record", "Passes a practical assessment on the vehicle class", "Knowledge of BTR and Lower Assam routes", "Willing to work extended duty when required"},
	},
	{
		ID: "tech-kkj", Title: "Electronic Security Technician", Type: "Full-time", Location: "Kokrajhar HQ", Openings: 4,
		Pay: "₹18,000 – ₹26,000 per month", Experience: "1+ year in CCTV/networking",
		Summary: "Installs and commissions CCTV, access control and fire alarm systems, and supports the control room feed.",
		Requirements: []string{"ITI or diploma in electronics/electrical", "Hands-on with IP cameras, NVRs and cabling", "Basic networking — IP addressing, switches, PoE", "Comfortable with height and ladder work", "Willing to travel across BTR districts"},
	},
}

// VacancyByID returns a vacancy and whether it was found.
func VacancyByID(id string) (Vacancy, bool) {
	for _, v := range Vacancies {
		if v.ID == id {
			return v, true
		}
	}
	return Vacancy{}, false
}

// TotalOpenings sums the advertised seats across all vacancies.
func TotalOpenings() int {
	n := 0
	for _, v := range Vacancies {
		n += v.Openings
	}
	return n
}

// TrainingModule is one block of the induction syllabus.
type TrainingModule struct {
	Code  string
	Title string
	Days  string
	Body  string
}

// Syllabus is the twenty-one day induction programme.
var Syllabus = []TrainingModule{
	{Code: "M1", Title: "Bearing, uniform and conduct", Days: "Days 1–3", Body: "Turnout, saluting, standing a post, addressing clients and the public, and the conduct rules that get a guard removed from site."},
	{Code: "M2", Title: "Access and visitor control", Days: "Days 4–6", Body: "Visitor registers, gate passes, material movement, vehicle checks, frisking protocol and the correct way to refuse entry."},
	{Code: "M3", Title: "Patrolling and observation", Days: "Days 7–9", Body: "Beat discipline, checkpoint punching, randomising a round, what to look at on a perimeter and how to describe it afterwards."},
	{Code: "M4", Title: "Fire response and evacuation", Days: "Days 10–12", Body: "Extinguisher classes and live use, hydrant and hose drill, raising an alarm, assembly points and assisting an evacuation."},
	{Code: "M5", Title: "First aid and medical emergency", Days: "Days 13–14", Body: "Bleeding control, CPR basics, fracture immobilisation, heatstroke and snakebite response, and calling an ambulance correctly."},
	{Code: "M6", Title: "Incident reporting", Days: "Days 15–16", Body: "Writing an occurrence entry, a shift handover and an incident report that will still make sense to a client or a court six months later."},
	{Code: "M7", Title: "Law, rights and de-escalation", Days: "Days 17–18", Body: "Powers and limits of a private guard, detention and citizen's arrest, evidence preservation, and de-escalating an angry crowd."},
	{Code: "M8", Title: "Site-specific attachment", Days: "Days 19–21", Body: "Supervised duty on the actual posting alongside an experienced guard, ending in a sign-off by the field officer before independent deployment."},
}
