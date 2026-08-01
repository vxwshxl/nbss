// Package web wires the HTTP surface: routing, template rendering and the
// handlers behind both the full pages and the HTMX fragments.
package web

import (
	"crypto/subtle"
	"fmt"
	"html/template"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/nbss/website/internal/content"
	"github.com/nbss/website/internal/store"
)

// Config holds everything the server needs from main.
type Config struct {
	Assets     fs.FS  // the embedded (or on-disk) web/ tree
	Dev        bool   // re-parse templates on every request
	AdminUser  string
	AdminPass  string
	BaseURL    string
	Logger     *slog.Logger
}

// Server owns the router and the shared dependencies.
type Server struct {
	cfg   Config
	store *store.Store
	log   *slog.Logger
	mux   *http.ServeMux

	tmplMu sync.RWMutex
	tmpl   map[string]*template.Template
}

// New builds the server and registers every route.
func New(cfg Config, st *store.Store) (*Server, error) {
	s := &Server{
		cfg:   cfg,
		store: st,
		log:   cfg.Logger,
		mux:   http.NewServeMux(),
		tmpl:  map[string]*template.Template{},
	}
	if err := s.parseTemplates(); err != nil {
		return nil, err
	}
	s.routes()
	return s, nil
}

// ServeHTTP applies the middleware chain to the router.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.recoverPanic(s.logRequests(s.securityHeaders(s.mux))).ServeHTTP(w, r)
}

func (s *Server) routes() {
	// Static assets. Served from the same FS as the templates so that the
	// embedded binary and the dev-mode directory behave identically.
	static, err := fs.Sub(s.cfg.Assets, "static")
	if err != nil {
		panic(fmt.Sprintf("web: static subtree missing: %v", err))
	}
	s.mux.Handle("GET /static/", http.StripPrefix("/static/", s.cacheStatic(http.FileServerFS(static))))

	// Public pages. "GET /" is the catch-all: Go's pattern matcher prefers the
	// most specific route, so every registered path still wins over it.
	s.mux.HandleFunc("GET /", s.notFound)
	s.mux.HandleFunc("GET /{$}", s.handleHome)
	s.mux.HandleFunc("GET /about", s.handleAbout)
	s.mux.HandleFunc("GET /services", s.handleServices)
	s.mux.HandleFunc("GET /services/{slug}", s.handleServiceDetail)
	s.mux.HandleFunc("GET /sectors", s.handleSectors)
	s.mux.HandleFunc("GET /training", s.handleTraining)
	s.mux.HandleFunc("GET /clients", s.handleClients)
	s.mux.HandleFunc("GET /gallery", s.handleGallery)
	s.mux.HandleFunc("GET /careers", s.handleCareers)
	s.mux.HandleFunc("GET /careers/{id}", s.handleVacancy)
	s.mux.HandleFunc("GET /contact", s.handleContact)

	// HTMX fragment endpoints.
	s.mux.HandleFunc("GET /partials/search", s.handleSearch)
	s.mux.HandleFunc("GET /partials/gallery", s.handleGalleryFilter)
	s.mux.HandleFunc("GET /partials/services", s.handleServiceFilter)
	s.mux.HandleFunc("GET /partials/quote-form", s.handleQuoteForm)
	s.mux.HandleFunc("GET /partials/apply-form/{id}", s.handleApplyForm)
	s.mux.HandleFunc("POST /partials/contact", s.handleContactSubmit)
	s.mux.HandleFunc("POST /partials/quote", s.handleQuoteSubmit)
	s.mux.HandleFunc("POST /partials/apply", s.handleApplySubmit)

	// Operations.
	s.mux.HandleFunc("GET /admin", s.requireAdmin(s.handleAdmin))
	s.mux.HandleFunc("POST /admin/status", s.requireAdmin(s.handleAdminStatus))
	s.mux.HandleFunc("GET /healthz", s.handleHealth)
	s.mux.HandleFunc("GET /sitemap.xml", s.handleSitemap)
	s.mux.HandleFunc("GET /robots.txt", s.handleRobots)
}

// ---------------------------------------------------------------- templates

// funcs are the helpers available inside every template.
var funcs = template.FuncMap{
	"year":  func() int { return time.Now().Year() },
	"upper": strings.ToUpper,
	"lower": strings.ToLower,
	"add":   func(a, b int) int { return a + b },
	"seq": func(n int) []int {
		out := make([]int, n)
		for i := range out {
			out[i] = i
		}
		return out
	},
	// pad renders 1 as "01" for the numbered section eyebrows.
	"pad": func(n int) string { return fmt.Sprintf("%02d", n) },
	// list builds an inline slice; the template builtin `slice` cuts an
	// existing one rather than constructing a new literal.
	"list": func(items ...string) []string { return items },
	// tel strips a phone number down to something a tel: href accepts.
	"tel": func(s string) string {
		return strings.NewReplacer(" ", "", "-", "", "(", "", ")", "").Replace(s)
	},
	"date":     func(t time.Time) string { return t.Format("02 Jan 2006, 15:04") },
	"dateOnly": func(t time.Time) string { return t.Format("02 Jan 2006") },
	"dict": func(kv ...any) (map[string]any, error) {
		if len(kv)%2 != 0 {
			return nil, fmt.Errorf("dict needs an even number of arguments")
		}
		m := make(map[string]any, len(kv)/2)
		for i := 0; i < len(kv); i += 2 {
			key, ok := kv[i].(string)
			if !ok {
				return nil, fmt.Errorf("dict keys must be strings")
			}
			m[key] = kv[i+1]
		}
		return m, nil
	},
}

// parseTemplates builds one template set per page. Each set contains the base
// layout, every partial and exactly one page, which lets pages override blocks
// without name collisions.
func (s *Server) parseTemplates() error {
	pages, err := fs.Glob(s.cfg.Assets, "templates/pages/*.html")
	if err != nil {
		return fmt.Errorf("glob pages: %w", err)
	}
	if len(pages) == 0 {
		return fmt.Errorf("no page templates found under templates/pages")
	}

	built := make(map[string]*template.Template, len(pages)+8)
	for _, page := range pages {
		name := strings.TrimSuffix(page[strings.LastIndex(page, "/")+1:], ".html")
		t, err := template.New("base.html").Funcs(funcs).ParseFS(s.cfg.Assets,
			"templates/layouts/base.html",
			"templates/partials/*.html",
			page,
		)
		if err != nil {
			return fmt.Errorf("parse page %s: %w", name, err)
		}
		built[name] = t
	}

	// Fragments are rendered without the layout, so they get their own set.
	frag, err := template.New("fragments").Funcs(funcs).ParseFS(s.cfg.Assets, "templates/partials/*.html")
	if err != nil {
		return fmt.Errorf("parse partials: %w", err)
	}
	built["__fragments"] = frag

	s.tmplMu.Lock()
	s.tmpl = built
	s.tmplMu.Unlock()
	return nil
}

// pageData is the envelope handed to every full-page template.
type pageData struct {
	Site        content.Site
	Title       string
	Description string
	Nav         string // which primary nav item is current
	Path        string
	Canonical   string
	Data        any
}

func (s *Server) newPage(r *http.Request, nav, title, desc string, data any) pageData {
	return pageData{
		Site:        content.SiteInfo,
		Title:       title,
		Description: desc,
		Nav:         nav,
		Path:        r.URL.Path,
		Canonical:   strings.TrimRight(s.cfg.BaseURL, "/") + r.URL.Path,
		Data:        data,
	}
}

// render writes a full page. In dev mode templates are re-read first so a save
// is visible on refresh without restarting the binary.
func (s *Server) render(w http.ResponseWriter, r *http.Request, status int, page string, data pageData) {
	if s.cfg.Dev {
		if err := s.parseTemplates(); err != nil {
			s.fail(w, r, fmt.Errorf("reload templates: %w", err))
			return
		}
	}
	s.tmplMu.RLock()
	t, ok := s.tmpl[page]
	s.tmplMu.RUnlock()
	if !ok {
		s.fail(w, r, fmt.Errorf("unknown page template %q", page))
		return
	}

	// Render into a buffer first: a template error halfway through would
	// otherwise leave a half-written 200 on the wire.
	var buf strings.Builder
	if err := t.ExecuteTemplate(&buf, "base.html", data); err != nil {
		s.fail(w, r, fmt.Errorf("execute %s: %w", page, err))
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	io.WriteString(w, buf.String())
}

// renderPartial writes a single named template — the HTMX response path.
func (s *Server) renderPartial(w http.ResponseWriter, r *http.Request, name string, data any) {
	if s.cfg.Dev {
		if err := s.parseTemplates(); err != nil {
			s.fail(w, r, fmt.Errorf("reload templates: %w", err))
			return
		}
	}
	s.tmplMu.RLock()
	t := s.tmpl["__fragments"]
	s.tmplMu.RUnlock()

	var buf strings.Builder
	if err := t.ExecuteTemplate(&buf, name, data); err != nil {
		s.fail(w, r, fmt.Errorf("execute partial %s: %w", name, err))
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	io.WriteString(w, buf.String())
}

// --------------------------------------------------------------- middleware

func (s *Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		// Everything — fonts, htmx, css, images — is served from this origin,
		// so the policy can be strict. 'unsafe-inline' covers the small inline
		// style attributes used for staggered animation delays.
		h.Set("Content-Security-Policy",
			"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "+
				"script-src 'self'; font-src 'self'; form-action 'self'; base-uri 'self'; frame-ancestors 'none'")
		next.ServeHTTP(w, r)
	})
}

func (s *Server) cacheStatic(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.cfg.Dev {
			w.Header().Set("Cache-Control", "no-store")
		} else {
			w.Header().Set("Cache-Control", "public, max-age=604800")
		}
		next.ServeHTTP(w, r)
	})
}

// statusRecorder captures the response code for the access log.
type statusRecorder struct {
	http.ResponseWriter
	code int
}

func (sr *statusRecorder) WriteHeader(c int) {
	sr.code = c
	sr.ResponseWriter.WriteHeader(c)
}

func (s *Server) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/static/") {
			next.ServeHTTP(w, r) // asset noise drowns out anything useful
			return
		}
		start := time.Now()
		sr := &statusRecorder{ResponseWriter: w, code: http.StatusOK}
		next.ServeHTTP(sr, r)
		s.log.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", sr.code,
			"htmx", r.Header.Get("HX-Request") == "true",
			"dur", time.Since(start).Round(100*time.Microsecond).String(),
		)
	})
}

func (s *Server) recoverPanic(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				s.log.Error("panic recovered", "path", r.URL.Path, "panic", rec)
				w.Header().Set("Connection", "close")
				s.fail(w, r, fmt.Errorf("panic: %v", rec))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// requireAdmin gates the operations pages behind HTTP basic auth. Comparisons
// are constant-time so the credentials cannot be probed by timing.
func (s *Server) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, pass, ok := r.BasicAuth()
		userOK := subtle.ConstantTimeCompare([]byte(user), []byte(s.cfg.AdminUser)) == 1
		passOK := subtle.ConstantTimeCompare([]byte(pass), []byte(s.cfg.AdminPass)) == 1
		if !ok || !userOK || !passOK {
			w.Header().Set("WWW-Authenticate", `Basic realm="NBSS operations", charset="UTF-8"`)
			http.Error(w, "Authentication required.", http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

// ------------------------------------------------------------------ errors

func (s *Server) fail(w http.ResponseWriter, r *http.Request, err error) {
	s.log.Error("server error", "path", r.URL.Path, "err", err)
	// An HTMX request expects a fragment, not a full error page.
	if r.Header.Get("HX-Request") == "true" {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusInternalServerError)
		io.WriteString(w, `<div class="form-note form-note--error">Something went wrong at our end. Please call `+
			content.SiteInfo.Phone+` and we will take the details by phone.</div>`)
		return
	}
	http.Error(w, "Internal server error", http.StatusInternalServerError)
}

func (s *Server) notFound(w http.ResponseWriter, r *http.Request) {
	data := s.newPage(r, "", "Page not found", "The page you asked for is not here.", nil)
	s.render(w, r, http.StatusNotFound, "404", data)
}
