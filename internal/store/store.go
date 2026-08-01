// Package store persists the submissions that come off the public forms.
//
// The whole site is read-mostly, and the write volume for a regional security
// agency is a handful of enquiries a day. A JSON file guarded by a mutex is
// therefore the right amount of database: no driver, no migration, no cgo, and
// the operator can read the file with `cat`. Swapping this for SQLite or
// Postgres later means reimplementing this one interface.
package store

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

// Kind distinguishes the three submission types sharing one file.
type Kind string

const (
	KindEnquiry     Kind = "enquiry"
	KindQuote       Kind = "quote"
	KindApplication Kind = "application"
)

// Status tracks where the sales or HR team has taken a submission.
type Status string

const (
	StatusNew      Status = "new"
	StatusContacted Status = "contacted"
	StatusClosed   Status = "closed"
)

// Submission is one record from any of the public forms. Fields that do not
// apply to a given Kind are simply left empty rather than modelled separately —
// the admin view is a single list and benefits from one shape.
type Submission struct {
	ID        string    `json:"id"`
	Kind      Kind      `json:"kind"`
	Status    Status    `json:"status"`
	CreatedAt time.Time `json:"created_at"`

	Name    string `json:"name"`
	Email   string `json:"email,omitempty"`
	Phone   string `json:"phone"`
	Company string `json:"company,omitempty"`
	Subject string `json:"subject,omitempty"`
	Message string `json:"message,omitempty"`

	// Quote-specific.
	Service   string `json:"service,omitempty"`
	SiteType  string `json:"site_type,omitempty"`
	District  string `json:"district,omitempty"`
	Headcount string `json:"headcount,omitempty"`
	StartWhen string `json:"start_when,omitempty"`

	// Application-specific.
	VacancyID    string `json:"vacancy_id,omitempty"`
	VacancyTitle string `json:"vacancy_title,omitempty"`
	Age          string `json:"age,omitempty"`
	Education    string `json:"education,omitempty"`
	Experience   string `json:"experience,omitempty"`

	// Request metadata, useful for spam triage.
	UserAgent string `json:"user_agent,omitempty"`
	RemoteIP  string `json:"remote_ip,omitempty"`
}

// Store is a concurrency-safe, file-backed collection of submissions.
type Store struct {
	mu   sync.RWMutex
	path string
	subs []Submission
	seq  int
}

// ErrNotFound is returned when an ID does not exist.
var ErrNotFound = errors.New("submission not found")

// Open loads the store at path, creating the parent directory and an empty file
// if they do not exist yet.
func Open(path string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}
	s := &Store{path: path}

	b, err := os.ReadFile(path)
	switch {
	case errors.Is(err, os.ErrNotExist):
		return s, s.flush() // materialise an empty file so ops can see it exists
	case err != nil:
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	if len(b) > 0 {
		if err := json.Unmarshal(b, &s.subs); err != nil {
			return nil, fmt.Errorf("parse %s: %w", path, err)
		}
	}
	// Rebuild the sequence from what is on disk so IDs never collide after a
	// restart.
	for _, sub := range s.subs {
		var n int
		if _, err := fmt.Sscanf(sub.ID, "NBSS-%d", &n); err == nil && n > s.seq {
			s.seq = n
		}
	}
	return s, nil
}

// Add assigns an ID and timestamp, appends the submission and writes through to
// disk. The stored copy is returned so the caller can show the reference number.
func (s *Store) Add(sub Submission) (Submission, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.seq++
	sub.ID = fmt.Sprintf("NBSS-%05d", s.seq)
	sub.CreatedAt = time.Now()
	if sub.Status == "" {
		sub.Status = StatusNew
	}
	s.subs = append(s.subs, sub)

	if err := s.flush(); err != nil {
		// Roll back the in-memory append so memory and disk cannot diverge.
		s.subs = s.subs[:len(s.subs)-1]
		s.seq--
		return Submission{}, err
	}
	return sub, nil
}

// List returns submissions newest-first, optionally filtered by kind.
// An empty kind returns everything.
func (s *Store) List(kind Kind) []Submission {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make([]Submission, 0, len(s.subs))
	for _, sub := range s.subs {
		if kind == "" || sub.Kind == kind {
			out = append(out, sub)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

// SetStatus moves a submission through the triage states.
func (s *Store) SetStatus(id string, status Status) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.subs {
		if s.subs[i].ID != id {
			continue
		}
		prev := s.subs[i].Status
		s.subs[i].Status = status
		if err := s.flush(); err != nil {
			s.subs[i].Status = prev
			return err
		}
		return nil
	}
	return ErrNotFound
}

// Counts returns the number of submissions per kind, plus a "new" total.
func (s *Store) Counts() map[string]int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	c := map[string]int{"total": len(s.subs)}
	for _, sub := range s.subs {
		c[string(sub.Kind)]++
		if sub.Status == StatusNew {
			c["new"]++
		}
	}
	return c
}

// flush writes the whole slice to disk atomically. Callers must hold the write
// lock. Rewriting the entire file is fine at this volume and removes any chance
// of a partially-appended record.
func (s *Store) flush() error {
	b, err := json.MarshalIndent(s.subs, "", "  ")
	if err != nil {
		return fmt.Errorf("encode submissions: %w", err)
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return fmt.Errorf("write temp file: %w", err)
	}
	if err := os.Rename(tmp, s.path); err != nil {
		return fmt.Errorf("replace %s: %w", s.path, err)
	}
	return nil
}
