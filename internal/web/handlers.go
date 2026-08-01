package web

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"

	"github.com/nbss/website/internal/content"
	"github.com/nbss/website/internal/store"
)

// ------------------------------------------------------------------- pages

type homeData struct {
	Stats     []content.Stat
	Divisions []content.Division
	Featured  []content.Service
	Pillars   []content.Pillar
	Sectors   []content.Sector
	Quotes    []content.Testimonial
	Coverage  []content.District
	Photos    []content.Photo
}

func (s *Server) handleHome(w http.ResponseWriter, r *http.Request) {
	d := homeData{
		Stats:     content.Stats,
		Divisions: content.Divisions,
		Featured:  content.FeaturedServices(),
		Pillars:   content.Pillars,
		Sectors:   content.Sectors,
		Quotes:    content.Testimonials,
		Coverage:  content.Coverage,
		Photos:    content.PhotosIn("operations")[:6],
	}
	s.render(w, r, http.StatusOK, "home", s.newPage(r, "home",
		content.SiteInfo.ShortName+" — Security, Facility & Manpower Services in Bodoland",
		content.SiteInfo.Descriptor, d))
}

type aboutData struct {
	Timeline []content.Milestone
	Team     []content.Person
	Licenses []content.Credential
	Stats    []content.Stat
	Coverage []content.District
	Pillars  []content.Pillar
}

func (s *Server) handleAbout(w http.ResponseWriter, r *http.Request) {
	d := aboutData{
		Timeline: content.Timeline,
		Team:     content.Leadership,
		Licenses: content.SiteInfo.Licenses,
		Stats:    content.Stats,
		Coverage: content.Coverage,
		Pillars:  content.Pillars,
	}
	s.render(w, r, http.StatusOK, "about", s.newPage(r, "about",
		"About NBSS — sixteen years of guarding in the Bodoland Territorial Region",
		"How National Bodo Security Services recruits, verifies, trains and supervises the people it puts on your gate.", d))
}

type servicesData struct {
	Divisions []content.Division
	Active    string
	Services  []content.Service
	Total     int
}

func (s *Server) handleServices(w http.ResponseWriter, r *http.Request) {
	active := r.URL.Query().Get("division")
	if _, ok := content.DivisionBySlug(active); !ok {
		active = "" // unknown or absent means "show everything"
	}
	d := servicesData{
		Divisions: content.Divisions,
		Active:    active,
		Services:  servicesFor(active),
		Total:     len(content.Services),
	}
	s.render(w, r, http.StatusOK, "services", s.newPage(r, "services",
		"Services — guarding, facility management, manpower and electronic security",
		fmt.Sprintf("%d services across four divisions, delivered from Kokrajhar across the Bodoland Territorial Region and Lower Assam.", len(content.Services)), d))
}

func servicesFor(division string) []content.Service {
	if division == "" {
		return content.Services
	}
	return content.ServicesIn(division)
}

type serviceDetailData struct {
	Service  content.Service
	Division content.Division
	Related  []content.Service
}

func (s *Server) handleServiceDetail(w http.ResponseWriter, r *http.Request) {
	svc, ok := content.ServiceBySlug(r.PathValue("slug"))
	if !ok {
		s.notFound(w, r)
		return
	}
	div, _ := content.DivisionBySlug(svc.Division)
	d := serviceDetailData{Service: svc, Division: div, Related: content.RelatedServices(svc, 4)}

	s.render(w, r, http.StatusOK, "service", s.newPage(r, "services",
		svc.Name+" — NBSS", svc.Summary, d))
}

func (s *Server) handleSectors(w http.ResponseWriter, r *http.Request) {
	s.render(w, r, http.StatusOK, "sectors", s.newPage(r, "sectors",
		"Sectors we serve — from bank branches to tea estates",
		"Twelve verticals NBSS deploys into, and what changes about the posting in each one.",
		content.Sectors))
}

type trainingData struct {
	Syllabus []content.TrainingModule
	Pillars  []content.Pillar
	Photos   []content.Photo
}

func (s *Server) handleTraining(w http.ResponseWriter, r *http.Request) {
	d := trainingData{
		Syllabus: content.Syllabus,
		Pillars:  content.Pillars,
		Photos:   content.PhotosIn("training"),
	}
	s.render(w, r, http.StatusOK, "training", s.newPage(r, "training",
		"Training — the twenty-one day induction and what comes after",
		"Eight modules, twenty-one days, then quarterly refreshers at the Kokrajhar training ground.", d))
}

type clientsData struct {
	Clients []content.Client
	Quotes  []content.Testimonial
	Sectors []content.Sector
}

func (s *Server) handleClients(w http.ResponseWriter, r *http.Request) {
	d := clientsData{Clients: content.Clients, Quotes: content.Testimonials, Sectors: content.Sectors}
	s.render(w, r, http.StatusOK, "clients", s.newPage(r, "clients",
		"Clients — who we guard and what they say",
		"Reference sites across banking, healthcare, education, retail, plantations and government in the Northeast.", d))
}

type galleryData struct {
	Categories []content.GalleryCategory
	Active     string
	Photos     []content.Photo
}

func (s *Server) handleGallery(w http.ResponseWriter, r *http.Request) {
	active := r.URL.Query().Get("cat")
	if active == "" {
		active = "all"
	}
	d := galleryData{Categories: content.GalleryCategories, Active: active, Photos: content.PhotosIn(active)}
	s.render(w, r, http.StatusOK, "gallery", s.newPage(r, "gallery",
		"Gallery — operations, training and the region we come from",
		"Photographs from NBSS operations and from Bodoland, the region that supplies our people.", d))
}

type careersData struct {
	Vacancies []content.Vacancy
	Openings  int
	Syllabus  []content.TrainingModule
}

func (s *Server) handleCareers(w http.ResponseWriter, r *http.Request) {
	d := careersData{Vacancies: content.Vacancies, Openings: content.TotalOpenings(), Syllabus: content.Syllabus}
	s.render(w, r, http.StatusOK, "careers", s.newPage(r, "careers",
		fmt.Sprintf("Careers — %d openings across the Bodoland districts", content.TotalOpenings()),
		"Guards, lady guards, supervisors, field officers, control-room operators, drivers and technicians. Freshers trained and paid from day one.", d))
}

type vacancyData struct {
	Vacancy content.Vacancy
	Others  []content.Vacancy
	Form    *form
}

func (s *Server) handleVacancy(w http.ResponseWriter, r *http.Request) {
	v, ok := content.VacancyByID(r.PathValue("id"))
	if !ok {
		s.notFound(w, r)
		return
	}
	others := make([]content.Vacancy, 0, 3)
	for _, o := range content.Vacancies {
		if o.ID != v.ID {
			others = append(others, o)
		}
		if len(others) == 3 {
			break
		}
	}
	// The application form is rendered inline on first load rather than fetched,
	// so the page works with JavaScript disabled up to the point of submitting.
	blank := &form{Values: map[string]string{"vacancy_id": v.ID}, Errors: map[string]string{}}
	d := vacancyData{Vacancy: v, Others: others, Form: blank}
	s.render(w, r, http.StatusOK, "vacancy", s.newPage(r, "careers",
		v.Title+" — careers at NBSS", v.Summary, d))
}

type contactData struct {
	FAQs      []content.FAQ
	Services  []content.Service
	Divisions []content.Division
	Coverage  []content.District
	// Both forms are rendered inline on first load so the page is usable
	// before htmx has finished booting.
	Enquiry *contactFormData
	Quote   *quoteFormData
}

func (s *Server) handleContact(w http.ResponseWriter, r *http.Request) {
	d := contactData{
		FAQs:      content.FAQs,
		Services:  content.Services,
		Divisions: content.Divisions,
		Coverage:  content.Coverage,
		Enquiry:   &contactFormData{Form: blankForm()},
		Quote:     &quoteFormData{Form: blankForm(), Services: content.Services, Coverage: content.Coverage},
	}
	s.render(w, r, http.StatusOK, "contact", s.newPage(r, "contact",
		"Contact NBSS — Kokrajhar, Bodoland Territorial Region",
		"Talk to the deployment desk. Survey within 48 hours, guards on site within seven working days.", d))
}

// -------------------------------------------------------- HTMX fragments

// handleSearch powers the live service search in the header.
func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	results := content.SearchServices(q)
	if len(results) > 8 {
		results = results[:8]
	}
	s.renderPartial(w, r, "search-results", map[string]any{
		"Query":   strings.TrimSpace(q),
		"Results": results,
	})
}

// handleGalleryFilter swaps the photo grid without a page load. It also pushes
// the new URL so the filtered view is linkable and the back button works.
func (s *Server) handleGalleryFilter(w http.ResponseWriter, r *http.Request) {
	cat := r.URL.Query().Get("cat")
	if cat == "" {
		cat = "all"
	}
	w.Header().Set("HX-Push-Url", "/gallery?cat="+cat)
	s.renderPartial(w, r, "gallery-grid", galleryData{
		Categories: content.GalleryCategories,
		Active:     cat,
		Photos:     content.PhotosIn(cat),
	})
}

// handleServiceFilter swaps the catalogue grid when a division chip is clicked.
func (s *Server) handleServiceFilter(w http.ResponseWriter, r *http.Request) {
	div := r.URL.Query().Get("division")
	if _, ok := content.DivisionBySlug(div); !ok {
		div = ""
	}
	url := "/services"
	if div != "" {
		url += "?division=" + div
	}
	w.Header().Set("HX-Push-Url", url)
	s.renderPartial(w, r, "service-grid", servicesData{
		Divisions: content.Divisions,
		Active:    div,
		Services:  servicesFor(div),
		Total:     len(content.Services),
	})
}

// handleQuoteForm returns a fresh quote form, optionally pre-selecting a
// service. It backs the "Request a quote" button on every service page.
func (s *Server) handleQuoteForm(w http.ResponseWriter, r *http.Request) {
	f := &form{Values: map[string]string{}, Errors: map[string]string{}}
	if svc := r.URL.Query().Get("service"); svc != "" {
		if _, ok := content.ServiceBySlug(svc); ok {
			f.Values["service"] = svc
		}
	}
	s.renderPartial(w, r, "quote-form", quoteFormData{Form: f, Services: content.Services, Coverage: content.Coverage})
}

// handleApplyForm returns the job application form for a vacancy.
func (s *Server) handleApplyForm(w http.ResponseWriter, r *http.Request) {
	v, ok := content.VacancyByID(r.PathValue("id"))
	if !ok {
		http.Error(w, "Unknown vacancy.", http.StatusNotFound)
		return
	}
	f := &form{Values: map[string]string{"vacancy_id": v.ID}, Errors: map[string]string{}}
	s.renderPartial(w, r, "apply-form", applyFormData{Form: f, Vacancy: v})
}

type quoteFormData struct {
	Form     *form
	Services []content.Service
	Coverage []content.District
}

type applyFormData struct {
	Form    *form
	Vacancy content.Vacancy
}

// ---------------------------------------------------------- form submission

func (s *Server) handleContactSubmit(w http.ResponseWriter, r *http.Request) {
	f, err := newForm(r)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	// Silently accept and discard honeypot hits: telling a bot it failed only
	// helps it try again.
	if f.IsBot() {
		s.renderPartial(w, r, "form-success", successData{
			Ref:   "NBSS-00000",
			Title: "Thank you — your message is with us.",
			Body:  "Our deployment desk will call you back on the number you gave.",
		})
		return
	}

	f.Required("name", "Your name").Length("name", "Your name", 2, 80)
	f.Required("phone", "A phone number").Phone("phone", "Phone")
	f.Email("email", "Email")
	f.Length("company", "Organisation", 0, 120)
	f.Required("subject", "A subject").Length("subject", "Subject", 3, 120)
	f.Required("message", "A message").Length("message", "Message", 10, 2000)
	f.Consent("consent", "Please confirm we may contact you about this enquiry.")

	if !f.Valid() {
		w.WriteHeader(http.StatusUnprocessableEntity)
		s.renderPartial(w, r, "contact-form", contactFormData{Form: f})
		return
	}

	sub, err := s.store.Add(store.Submission{
		Kind:      store.KindEnquiry,
		Name:      f.Get("name"),
		Email:     f.Get("email"),
		Phone:     f.Get("phone"),
		Company:   f.Get("company"),
		Subject:   f.Get("subject"),
		Message:   f.Get("message"),
		UserAgent: r.UserAgent(),
		RemoteIP:  clientIP(r),
	})
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.log.Info("enquiry received", "ref", sub.ID, "name", sub.Name)

	s.renderPartial(w, r, "form-success", successData{
		Ref:   sub.ID,
		Title: "Message received — reference " + sub.ID,
		Body:  "The deployment desk answers enquiries within one working day. If it is urgent, call " + content.SiteInfo.Phone + " and quote your reference.",
	})
}

func (s *Server) handleQuoteSubmit(w http.ResponseWriter, r *http.Request) {
	f, err := newForm(r)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	if f.IsBot() {
		s.renderPartial(w, r, "form-success", successData{Ref: "NBSS-00000", Title: "Thank you.", Body: "We will be in touch."})
		return
	}

	districts := make([]string, 0, len(content.Coverage)+1)
	for _, d := range content.Coverage {
		districts = append(districts, d.Name)
	}
	districts = append(districts, "Elsewhere in the Northeast")

	f.Required("name", "Your name").Length("name", "Your name", 2, 80)
	f.Required("phone", "A phone number").Phone("phone", "Phone")
	f.Email("email", "Email")
	f.Required("company", "Your organisation").Length("company", "Organisation", 2, 120)
	f.Required("service", "A service")
	f.Required("district", "A district").OneOf("district", "District", districts...)
	f.Required("site_type", "A site type").Length("site_type", "Site type", 2, 120)
	f.IntRange("headcount", "Number of personnel", 1, 2000)
	f.OneOf("start_when", "Start", "Immediately", "Within a month", "Within three months", "Just planning")
	f.Length("message", "Notes", 0, 2000)
	f.Consent("consent", "Please confirm we may contact you about this requirement.")

	// A service slug must exist in the catalogue — the select is populated from
	// it, so anything else was hand-crafted.
	if svc := f.Get("service"); svc != "" {
		if _, ok := content.ServiceBySlug(svc); !ok {
			f.fail("service", "Please choose a service from the list.")
		}
	}

	if !f.Valid() {
		w.WriteHeader(http.StatusUnprocessableEntity)
		s.renderPartial(w, r, "quote-form", quoteFormData{Form: f, Services: content.Services, Coverage: content.Coverage})
		return
	}

	serviceName := f.Get("service")
	if svc, ok := content.ServiceBySlug(serviceName); ok {
		serviceName = svc.Name
	}

	sub, err := s.store.Add(store.Submission{
		Kind:      store.KindQuote,
		Name:      f.Get("name"),
		Email:     f.Get("email"),
		Phone:     f.Get("phone"),
		Company:   f.Get("company"),
		Service:   serviceName,
		SiteType:  f.Get("site_type"),
		District:  f.Get("district"),
		Headcount: f.Get("headcount"),
		StartWhen: f.Get("start_when"),
		Message:   f.Get("message"),
		UserAgent: r.UserAgent(),
		RemoteIP:  clientIP(r),
	})
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.log.Info("quote requested", "ref", sub.ID, "service", sub.Service, "district", sub.District)

	s.renderPartial(w, r, "form-success", successData{
		Ref:   sub.ID,
		Title: "Quotation request logged — " + sub.ID,
		Body:  "A field officer will call to arrange the site survey. Inside the BTR districts that survey happens within 48 hours, and you get a costed proposal with the statutory build-up shown line by line.",
	})
}

func (s *Server) handleApplySubmit(w http.ResponseWriter, r *http.Request) {
	f, err := newForm(r)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	if f.IsBot() {
		s.renderPartial(w, r, "form-success", successData{Ref: "NBSS-00000", Title: "Thank you.", Body: "Your application is with us."})
		return
	}

	v, ok := content.VacancyByID(f.Get("vacancy_id"))
	if !ok {
		http.Error(w, "Unknown vacancy.", http.StatusBadRequest)
		return
	}

	f.Required("name", "Your name").Length("name", "Your name", 2, 80)
	f.Required("phone", "A phone number").Phone("phone", "Phone")
	f.Email("email", "Email")
	f.Required("age", "Your age").IntRange("age", "Age", 18, 60)
	f.Required("district", "Your district").Length("district", "District", 2, 60)
	f.Required("education", "Your education")
	f.OneOf("education", "Education", "Below Class VIII", "Class VIII", "Class X", "Class XII", "Graduate", "Diploma / ITI", "Post-graduate")
	f.Length("experience", "Experience", 0, 1000)
	f.Consent("consent", "Please confirm the details you have given are correct.")

	if !f.Valid() {
		w.WriteHeader(http.StatusUnprocessableEntity)
		s.renderPartial(w, r, "apply-form", applyFormData{Form: f, Vacancy: v})
		return
	}

	sub, err := s.store.Add(store.Submission{
		Kind:         store.KindApplication,
		Name:         f.Get("name"),
		Email:        f.Get("email"),
		Phone:        f.Get("phone"),
		VacancyID:    v.ID,
		VacancyTitle: v.Title,
		Age:          f.Get("age"),
		District:     f.Get("district"),
		Education:    f.Get("education"),
		Experience:   f.Get("experience"),
		UserAgent:    r.UserAgent(),
		RemoteIP:     clientIP(r),
	})
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.log.Info("application received", "ref", sub.ID, "vacancy", v.Title)

	s.renderPartial(w, r, "form-success", successData{
		Ref:   sub.ID,
		Title: "Application received — " + sub.ID,
		Body:  "Keep this reference. HR shortlists weekly and calls candidates for a verification interview at the Kokrajhar office. Bring Aadhaar, address proof and two references.",
	})
}

type contactFormData struct{ Form *form }

type successData struct {
	Ref   string
	Title string
	Body  string
}

// --------------------------------------------------------------- operations

type adminData struct {
	Submissions []store.Submission
	Counts      map[string]int
	Filter      string
}

func (s *Server) handleAdmin(w http.ResponseWriter, r *http.Request) {
	kind := store.Kind(r.URL.Query().Get("kind"))
	switch kind {
	case store.KindEnquiry, store.KindQuote, store.KindApplication:
	default:
		kind = ""
	}
	d := adminData{
		Submissions: s.store.List(kind),
		Counts:      s.store.Counts(),
		Filter:      string(kind),
	}
	s.render(w, r, http.StatusOK, "admin", s.newPage(r, "", "Operations — submissions", "Internal.", d))
}

func (s *Server) handleAdminStatus(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		s.fail(w, r, err)
		return
	}
	id := r.PostForm.Get("id")
	status := store.Status(r.PostForm.Get("status"))
	switch status {
	case store.StatusNew, store.StatusContacted, store.StatusClosed:
	default:
		http.Error(w, "Unknown status.", http.StatusBadRequest)
		return
	}
	if err := s.store.SetStatus(id, status); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	s.renderPartial(w, r, "status-badge", map[string]any{"ID": id, "Status": string(status)})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"status":"ok","service":"nbss-website","submissions":%d}`, s.store.Counts()["total"])
}

func (s *Server) handleRobots(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	fmt.Fprintf(w, "User-agent: *\nDisallow: /admin\nDisallow: /partials/\nAllow: /\n\nSitemap: %s/sitemap.xml\n",
		strings.TrimRight(s.cfg.BaseURL, "/"))
}

func (s *Server) handleSitemap(w http.ResponseWriter, r *http.Request) {
	base := strings.TrimRight(s.cfg.BaseURL, "/")
	paths := []string{"/", "/about", "/services", "/sectors", "/training", "/clients", "/gallery", "/careers", "/contact"}
	for _, svc := range content.Services {
		paths = append(paths, "/services/"+svc.Slug)
	}
	for _, v := range content.Vacancies {
		paths = append(paths, "/careers/"+v.ID)
	}

	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	io.WriteString(w, `<?xml version="1.0" encoding="UTF-8"?>`+"\n")
	io.WriteString(w, `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`+"\n")
	for _, p := range paths {
		priority := "0.7"
		if p == "/" {
			priority = "1.0"
		}
		fmt.Fprintf(w, "  <url><loc>%s%s</loc><priority>%s</priority></url>\n", base, p, priority)
	}
	io.WriteString(w, "</urlset>\n")
}

// clientIP prefers the proxy header when the app sits behind nginx or Caddy,
// and falls back to the socket address otherwise.
func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		if i := strings.IndexByte(fwd, ','); i > 0 {
			return strings.TrimSpace(fwd[:i])
		}
		return strings.TrimSpace(fwd)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
