# NBSS — National Bodo Security Services

A complete, production-shaped marketing and operations website for a private
security agency headquartered in **Kokrajhar**, the administrative seat of the
**Bodoland Territorial Region** in Assam, India.

Built with **Go + HTMX**, because Next.js is overkill for a site whose job is to
render fast, work on a weak connection, and take three kinds of form submission.

```
Go 1.24 stdlib only  ·  zero third-party Go dependencies  ·  one binary
htmx 2.0.4 (vendored)  ·  no build step  ·  no node_modules  ·  no CDN calls
```

---

## Quick start

```bash
cd nbss
go run ./cmd/server            # → http://localhost:8080
```

That is the whole setup. There is nothing to install, nothing to compile on the
front end, and no `go get` — the module has **no external dependencies**.

Live-reloading templates while you work:

```bash
make dev                       # or: go run ./cmd/server -dev
```

Ship it:

```bash
make build                     # → ./bin/nbss, a single self-contained file
./bin/nbss -addr :8080
```

### The operations page

Submissions land at **`/admin`**, behind HTTP basic auth.

```
username: admin
password: nbss-kokrajhar        # change this before deploying, see below
```

---

## What "NBSS" means, and what the research turned up

**NBSS = National Bodo Security Services.**

- **Bodo** — a Tibeto-Burman people, among the earliest settlers of Assam, and a
  recognised Scheduled Tribe. Bodo is one of India's scheduled languages.
- **Bodoland** — the **Bodoland Territorial Region (BTR)**, an autonomous area
  covering ~9,600 km² across five districts: **Kokrajhar, Chirang, Baksa,
  Udalguri and Tamulpur**, governed by the Bodoland Territorial Council. Its
  headquarters is Kokrajhar. Population ~3.15 million (2011 census).
- The region is agrarian and industrially underdeveloped, which makes trained,
  statutorily-compliant employment genuinely scarce — the premise the whole site
  is written around.
- A real business by this name (**"National Bodo Security Service"**) is listed
  in Kokrajhar on Jwhwlao Dwimalu Road, near Bharat Petrol Pump. That address is
  echoed in the site content, but everything else is illustrative.
- Private security agencies in India are regulated under the **Private Security
  Agencies (Regulation) Act, 2005 (PSARA)** — state-issued, valid five years,
  requires a tie-up with a recognised training institute. This drives the
  compliance, training and licensing content throughout.

Cultural touchstones used in the design and imagery:

- **Aronai** — the narrow woven Bodo scarf given to honour a guest, bordered
  with nested diamonds. **This motif is the identity of the whole site** (see
  below).
- **Bwisagu** — the Bodo new year festival. **Bagurumba** — the butterfly dance.
- **Manas National Park** — the region's UNESCO site, on the northern edge.

Sources: Wikipedia (Bodoland Territorial Region, Boro culture, Kokrajhar
district), Justdial, PSARA guidance, Bodoland Tourism.

---

## Design

Reference brief was <https://www.nsservices.co.in> — a Pune security/facility/
manpower agency. Its **information architecture** is mirrored (four divisions,
a deep service catalogue, sectors, clients, gallery, careers, contact) but the
visual language is entirely different.

**Direction: "Bodoland field dossier."** Dark, institutional, editorial. Three
ideas carry it:

1. **The Aronai band.** The woven diamond border is redrawn as a tiling SVG and
   used as the structural rule between major regions of every page — under the
   masthead, under each page header, above the footer. It is the one thing a
   visitor should remember, and it is drawn from the culture rather than
   decorating with it.
2. **The dossier grid.** Hairline borders, numbered mono eyebrows
   (`01 —— WHY NBSS`), tabular figures. Information looks filed, not styled.
3. **Duotone photography.** Freely-licensed source photographs vary wildly in
   quality, so every image passes through the same green-black treatment and
   lifts to full colour on hover. Inconsistency becomes intent.

| | |
| --- | --- |
| Display | Bricolage Grotesque 700/800 |
| Body | Instrument Sans |
| Mono | JetBrains Mono — eyebrows, figures, labels |
| Ink | `#0A100D` near-black with a green cast |
| Green | `#19A96E` Bodoland green |
| Gold | `#E2A93C` marigold, from the Kokrajhar bloom |
| Rust | `#D45A3A` Aronai borderwork, used sparingly |

Each of the four divisions re-points `--accent` via `[data-accent]`, so its
cards, icons and photo duotone shift colour without a second stylesheet.

---

## What's in the box

### Pages (12 routes + 39 generated detail pages)

| Route | What it is |
| --- | --- |
| `/` | Hero, stat counters, four divisions, featured services, six pillars, coverage map, sector rail, testimonials, gallery peek |
| `/about` | Company story, mission/vision, 8-entry timeline, leadership, six licences, coverage |
| `/services` | Full catalogue with HTMX division filter + a four-step onboarding explainer |
| `/services/{slug}` | **31 pages** — detail, scope of work, who it's for, inline HTMX quote form, related services |
| `/sectors` | 12 verticals, alternating full-bleed layout |
| `/training` | The 21-day induction syllabus (8 modules) and the 6-step verification process |
| `/clients` | 16 reference sites, testimonials, sector spread |
| `/gallery` | 28 photographs with HTMX category filter and per-image attribution |
| `/careers` | 8 vacancies (170 seats), terms, how to apply |
| `/careers/{id}` | **8 pages** — requirements, benefits, inline application form |
| `/contact` | Contact cards, quote form, enquiry form, 8-question FAQ, coverage |
| `/admin` | Basic-auth submissions inbox with status triage |

Plus `/healthz`, `/robots.txt`, a generated `/sitemap.xml`, and a custom 404.

### HTMX interactions (8 fragment endpoints)

| Interaction | Endpoint | Notes |
| --- | --- | --- |
| Live service search | `GET /partials/search` | 180 ms debounce, `/` keyboard shortcut, empty state |
| Service division filter | `GET /partials/services` | Swaps the grid, pushes the URL so it stays linkable |
| Gallery category filter | `GET /partials/gallery` | Same — back button works |
| Quote form (pre-filled) | `GET /partials/quote-form` | Pre-selects the service you came from |
| Application form | `GET /partials/apply-form/{id}` | |
| Enquiry submit | `POST /partials/contact` | |
| Quote submit | `POST /partials/quote` | |
| Application submit | `POST /partials/apply` | |

Validation failures return **422** with the form re-rendered — every error at
once, values preserved. `app.js` opts that status back into swapping, since htmx
ignores non-2xx bodies by default. Success swaps in a panel with a reference
number and moves focus to it.

Every form is a real `<form>` with a real `action` shape: if htmx never loads,
the page still renders and the content is still readable.

### Content

31 services across 4 divisions · 12 sectors · 8 districts · 8 vacancies ·
8 training modules · 6 pillars · 6 licences · 8 FAQs · 28 captioned photographs.
All of it typed Go structs in `internal/content` — no CMS, no database on the
read path, compile-time safety, zero-latency rendering.

---

## Layout

```
nbss/
├── assets.go                  # go:embed of web/ — lives at the root because
│                              #   embed cannot reference a parent directory
├── cmd/server/main.go         # flags, env, graceful shutdown
├── internal/
│   ├── content/               # all editorial content as typed Go data
│   │   ├── site.go            #   company facts, stats, pillars, team, FAQs
│   │   ├── services.go        #   31 services, 4 divisions, 12 sectors
│   │   └── gallery.go         #   photos, clients, vacancies, syllabus
│   ├── store/store.go         # JSON-backed submissions store (+ tests)
│   └── web/
│       ├── server.go          # routing, template sets, middleware
│       ├── handlers.go        # page + fragment handlers
│       └── forms.go           # chainable validation
└── web/
    ├── templates/
    │   ├── layouts/base.html
    │   ├── pages/*.html       # one file per page
    │   └── partials/*.html    # chrome, icons, fragments, shared blocks
    └── static/
        ├── css/nbss.css       # the whole design system, one file
        ├── js/{htmx.min.js, app.js}
        ├── fonts/             # self-hosted woff2 subsets
        └── img/               # 31 photographs
```

### Design decisions worth knowing

**Why no database.** Write volume for a regional agency is a handful of
enquiries a day. A JSON file behind a mutex, written atomically via
temp-file-and-rename, is the right amount of database: no driver, no migration,
no cgo, and the operator can read it with `cat`. Swapping in SQLite later means
reimplementing one small interface in `internal/store`.

**Why templates are parsed per page.** Each page gets its own
`template.Template` containing the layout, every partial, and exactly one page
file. Pages can then define `content` without colliding, and a broken template
fails at startup rather than mid-request.

**Why rendering goes through a buffer.** A template error halfway through would
otherwise leave a half-written `200` on the wire. Render to a buffer, then
commit the status.

**Why a honeypot and not a CAPTCHA.** A hidden field costs nothing, catches
most scripted submitters, and does not cost conversions. Honeypot hits get a
normal-looking success page and are silently discarded — telling a bot it failed
only helps it try again.

**Security.** Strict CSP (`default-src 'self'`) is possible because nothing is
loaded from a CDN — fonts, htmx, images are all same-origin. Plus nosniff,
`X-Frame-Options: DENY`, a referrer policy, constant-time admin auth comparison,
`html/template` contextual escaping throughout, and server-side allow-listing of
every select/radio value (a forged `service` slug is rejected, not stored).

---

## Configuration

Flags, or the matching env var. Flags win.

| Flag | Env | Default | |
| --- | --- | --- | --- |
| `-addr` | `NBSS_ADDR` | `:8080` | listen address |
| `-data` | `NBSS_DATA` | `data/submissions.json` | submissions file |
| `-base-url` | `NBSS_BASE_URL` | `http://localhost:8080` | canonical links, sitemap |
| `-admin-user` | `NBSS_ADMIN_USER` | `admin` | |
| `-admin-pass` | `NBSS_ADMIN_PASS` | `nbss-kokrajhar` | **change before deploying** |
| `-dev` | `NBSS_DEV=1` | off | read `web/` from disk, re-parse per request |

```bash
NBSS_ADMIN_PASS='<something-real>' \
NBSS_BASE_URL='https://nbss.co.in' \
./bin/nbss -addr :8080
```

`-dev` must be run from the repository root, since it reads `web/` relatively.
Without it, everything is served from inside the binary.

---

## Testing

```bash
make test          # go test ./...
make check         # gofmt + vet + test
make cover         # coverage report in the browser
```

Covered: every page and every generated detail page renders without a missing
field; 404s; basic-auth on `/admin`; all three form round trips including the
422 path; honeypot discard; forged service slug and unknown vacancy rejection;
search hit/miss/empty; `HX-Push-Url` on both filters; security headers; sitemap
completeness; static asset serving; ID sequencing across a restart; and
concurrent writes to the store.

---

## Deploying

```bash
make build-linux                          # static linux/amd64 binary
scp bin/nbss-linux-amd64 server:/opt/nbss/nbss
```

`systemd` unit:

```ini
[Unit]
Description=NBSS website
After=network.target

[Service]
WorkingDirectory=/opt/nbss
ExecStart=/opt/nbss/nbss -addr 127.0.0.1:8080
Environment=NBSS_BASE_URL=https://nbss.co.in
Environment=NBSS_ADMIN_PASS=change-me
Restart=always
User=nbss

[Install]
WantedBy=multi-user.target
```

Put nginx or Caddy in front for TLS. The app reads `X-Forwarded-For` for the
client IP it records against submissions.

Or use the included `Dockerfile` — multi-stage, distroless, non-root, with
`/app/data` as the only volume:

```bash
docker build -t nbss .
docker run -p 8080:8080 -v nbss-data:/app/data \
  -e NBSS_ADMIN_PASS=change-me nbss
```

---

## Accessibility & performance notes

- Skip link, landmark regions, `aria-current` on the active nav item, labelled
  form controls with `aria-invalid` on failure, `role="status"` on live regions.
- Focus is moved to the confirmation panel after a form swap.
- Every animation is behind `prefers-reduced-motion`.
- Fonts are preloaded and self-hosted; images are lazy-loaded below the fold
  with `fetchpriority="high"` on the hero.
- No layout-shift: images carry intrinsic dimensions via aspect-ratio boxes.
- No render-blocking JavaScript — htmx and `app.js` are both `defer`.

---

## Content disclaimer

**This is a demonstration build.** The company story, personnel names, licence
numbers, client list, statistics, testimonials and vacancies are illustrative
and were written for this project. The place names, cultural references,
regional facts and the PSARA regulatory framing are real and researched. The
footer states this on every page.

Photograph credits and licences are in **[CREDITS.md](CREDITS.md)** and are also
printed under each image in the gallery.
