package web

import (
	"html"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"

	nbss "github.com/nbss/website"
	"github.com/nbss/website/internal/content"
	"github.com/nbss/website/internal/store"
)

func newTestServer(t *testing.T) *Server {
	t.Helper()

	assets, err := nbss.Assets()
	if err != nil {
		t.Fatalf("assets: %v", err)
	}
	st, err := store.Open(filepath.Join(t.TempDir(), "submissions.json"))
	if err != nil {
		t.Fatalf("store: %v", err)
	}
	srv, err := New(Config{
		Assets:    assets,
		AdminUser: "admin",
		AdminPass: "secret",
		BaseURL:   "https://nbss.example",
		Logger:    slog.New(slog.NewTextHandler(io.Discard, nil)),
	}, st)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return srv
}

func get(t *testing.T, srv *Server, path string) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
	return w
}

func postForm(t *testing.T, srv *Server, path string, v url.Values) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest("POST", path, strings.NewReader(v.Encode()))
	r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	r.Header.Set("HX-Request", "true")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, r)
	return w
}

// TestEveryPageRenders walks every URL the sitemap advertises. A template that
// references a field that no longer exists fails here rather than in front of
// a visitor.
func TestEveryPageRenders(t *testing.T) {
	srv := newTestServer(t)

	paths := []string{"/", "/about", "/services", "/sectors", "/training",
		"/clients", "/gallery", "/careers", "/contact", "/healthz",
		"/robots.txt", "/sitemap.xml"}
	for _, s := range content.Services {
		paths = append(paths, "/services/"+s.Slug)
	}
	for _, v := range content.Vacancies {
		paths = append(paths, "/careers/"+v.ID)
	}

	for _, p := range paths {
		t.Run(p, func(t *testing.T) {
			w := get(t, srv, p)
			if w.Code != http.StatusOK {
				t.Fatalf("status = %d; want 200", w.Code)
			}
			body := w.Body.String()
			if strings.Contains(body, "<no value>") {
				t.Error("body contains \"<no value>\" — a template read a missing field")
			}
			if strings.Contains(body, "ZgotmplZ") {
				t.Error("body contains ZgotmplZ — an unsafe URL was interpolated")
			}
		})
	}
}

func TestUnknownPathsReturn404(t *testing.T) {
	srv := newTestServer(t)
	for _, p := range []string{"/nope", "/services/not-a-service", "/careers/not-a-job"} {
		if w := get(t, srv, p); w.Code != http.StatusNotFound {
			t.Errorf("%s: status = %d; want 404", p, w.Code)
		}
	}
}

func TestAdminRequiresAuth(t *testing.T) {
	srv := newTestServer(t)

	if w := get(t, srv, "/admin"); w.Code != http.StatusUnauthorized {
		t.Errorf("unauthenticated status = %d; want 401", w.Code)
	}

	r := httptest.NewRequest("GET", "/admin", nil)
	r.SetBasicAuth("admin", "secret")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Errorf("authenticated status = %d; want 200", w.Code)
	}

	r = httptest.NewRequest("GET", "/admin", nil)
	r.SetBasicAuth("admin", "wrong")
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("wrong password status = %d; want 401", w.Code)
	}
}

func TestContactSubmissionRoundTrip(t *testing.T) {
	srv := newTestServer(t)

	// Invalid: comes back as 422 with the form re-rendered and values kept.
	bad := postForm(t, srv, "/partials/contact", url.Values{
		"name": {"A"}, "phone": {"123"}, "subject": {"Hi"}, "message": {"short"},
	})
	if bad.Code != http.StatusUnprocessableEntity {
		t.Fatalf("invalid submission status = %d; want 422", bad.Code)
	}
	if !strings.Contains(bad.Body.String(), "10-digit") {
		t.Error("re-rendered form is missing the phone error")
	}

	// Valid: stored, and the reference number is shown back.
	good := postForm(t, srv, "/partials/contact", url.Values{
		"name": {"Rwmwi Narzary"}, "phone": {"9864012345"},
		"subject": {"Night guarding"}, "message": {"We need four night guards."},
		"consent": {"yes"},
	})
	if good.Code != http.StatusOK {
		t.Fatalf("valid submission status = %d; want 200", good.Code)
	}
	if !strings.Contains(good.Body.String(), "NBSS-00001") {
		t.Error("success panel is missing the reference number")
	}
	if n := len(srv.store.List(store.KindEnquiry)); n != 1 {
		t.Errorf("stored %d enquiries; want 1", n)
	}
}

func TestHoneypotSubmissionIsNotStored(t *testing.T) {
	srv := newTestServer(t)

	w := postForm(t, srv, "/partials/contact", url.Values{
		"name": {"bot"}, "phone": {"9800000000"}, "website": {"http://spam.example"},
	})
	// The bot gets a normal-looking success page and nothing is written.
	if w.Code != http.StatusOK {
		t.Errorf("status = %d; want 200", w.Code)
	}
	if n := len(srv.store.List("")); n != 0 {
		t.Errorf("stored %d submissions from a honeypot hit; want 0", n)
	}
}

func TestQuoteRejectsUnknownServiceSlug(t *testing.T) {
	srv := newTestServer(t)

	w := postForm(t, srv, "/partials/quote", url.Values{
		"name": {"Test"}, "phone": {"9864012345"}, "company": {"Acme"},
		"service": {"not-a-real-service"}, "district": {"Chirang"},
		"site_type": {"Yard"}, "consent": {"yes"},
	})
	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d; want 422", w.Code)
	}
	if n := len(srv.store.List("")); n != 0 {
		t.Errorf("stored %d submissions; want 0", n)
	}
}

func TestApplyRejectsUnknownVacancy(t *testing.T) {
	srv := newTestServer(t)

	w := postForm(t, srv, "/partials/apply", url.Values{
		"vacancy_id": {"no-such-job"}, "name": {"Test"}, "phone": {"9864012345"},
		"age": {"25"}, "district": {"Baksa"}, "education": {"Class X"}, "consent": {"yes"},
	})
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d; want 400", w.Code)
	}
}

func TestSearchFragment(t *testing.T) {
	srv := newTestServer(t)

	hit := get(t, srv, "/partials/search?q=tea+estate")
	if !strings.Contains(hit.Body.String(), "Tea Estate") {
		t.Error("search for \"tea estate\" did not return the plantation service")
	}

	miss := get(t, srv, "/partials/search?q=zzzzzz")
	if !strings.Contains(miss.Body.String(), "Nothing matches") {
		t.Error("empty search did not render the no-results state")
	}

	// An empty query renders nothing at all rather than the whole catalogue.
	if body := get(t, srv, "/partials/search?q=").Body.String(); strings.TrimSpace(body) != "" {
		t.Errorf("empty query returned %d bytes; want an empty fragment", len(body))
	}
}

func TestFilterFragmentsPushURL(t *testing.T) {
	srv := newTestServer(t)

	w := get(t, srv, "/partials/services?division=facility")
	if got := w.Header().Get("HX-Push-Url"); got != "/services?division=facility" {
		t.Errorf("HX-Push-Url = %q; want /services?division=facility", got)
	}
	for _, s := range content.ServicesIn("facility") {
		// Names carry ampersands, which the template escapes on the way out.
		if !strings.Contains(w.Body.String(), html.EscapeString(s.Name)) {
			t.Errorf("filtered grid is missing %q", s.Name)
		}
	}

	g := get(t, srv, "/partials/gallery?cat=training")
	if got := g.Header().Get("HX-Push-Url"); got != "/gallery?cat=training" {
		t.Errorf("HX-Push-Url = %q; want /gallery?cat=training", got)
	}
}

func TestSecurityHeaders(t *testing.T) {
	srv := newTestServer(t)
	h := get(t, srv, "/").Header()

	for key, want := range map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":        "DENY",
		"Referrer-Policy":        "strict-origin-when-cross-origin",
	} {
		if got := h.Get(key); got != want {
			t.Errorf("%s = %q; want %q", key, got, want)
		}
	}
	if csp := h.Get("Content-Security-Policy"); !strings.Contains(csp, "default-src 'self'") {
		t.Errorf("CSP = %q; want a self-only default-src", csp)
	}
}

func TestSitemapListsEveryService(t *testing.T) {
	srv := newTestServer(t)
	body := get(t, srv, "/sitemap.xml").Body.String()

	for _, s := range content.Services {
		if !strings.Contains(body, "https://nbss.example/services/"+s.Slug) {
			t.Errorf("sitemap is missing /services/%s", s.Slug)
		}
	}
}

func TestStaticAssetsAreServed(t *testing.T) {
	srv := newTestServer(t)
	for _, p := range []string{
		"/static/css/nbss.css",
		"/static/js/htmx.min.js",
		"/static/js/app.js",
		"/static/fonts/fonts.css",
		"/static/img/favicon.svg",
		"/static/img/hero-guard.jpg",
	} {
		if w := get(t, srv, p); w.Code != http.StatusOK {
			t.Errorf("%s: status = %d; want 200", p, w.Code)
		}
	}
}
