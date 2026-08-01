package store

import (
	"path/filepath"
	"sync"
	"testing"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "submissions.json"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	return s
}

func TestAddAssignsSequentialIDs(t *testing.T) {
	s := newTestStore(t)

	first, err := s.Add(Submission{Kind: KindEnquiry, Name: "A"})
	if err != nil {
		t.Fatalf("Add: %v", err)
	}
	second, err := s.Add(Submission{Kind: KindQuote, Name: "B"})
	if err != nil {
		t.Fatalf("Add: %v", err)
	}

	if first.ID != "NBSS-00001" || second.ID != "NBSS-00002" {
		t.Errorf("IDs = %q, %q; want NBSS-00001, NBSS-00002", first.ID, second.ID)
	}
	if first.Status != StatusNew {
		t.Errorf("Status = %q; want %q", first.Status, StatusNew)
	}
	if first.CreatedAt.IsZero() {
		t.Error("CreatedAt was not stamped")
	}
}

func TestReopenContinuesSequence(t *testing.T) {
	path := filepath.Join(t.TempDir(), "submissions.json")

	s, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	for i := 0; i < 3; i++ {
		if _, err := s.Add(Submission{Kind: KindEnquiry, Name: "x"}); err != nil {
			t.Fatalf("Add: %v", err)
		}
	}

	// A restart must not hand out an ID that already exists on disk.
	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	got, err := reopened.Add(Submission{Kind: KindQuote, Name: "y"})
	if err != nil {
		t.Fatalf("Add after reopen: %v", err)
	}
	if got.ID != "NBSS-00004" {
		t.Errorf("ID after reopen = %q; want NBSS-00004", got.ID)
	}
	if n := len(reopened.List("")); n != 4 {
		t.Errorf("List len = %d; want 4", n)
	}
}

func TestListFiltersByKindAndSortsNewestFirst(t *testing.T) {
	s := newTestStore(t)
	s.Add(Submission{Kind: KindEnquiry, Name: "one"})
	s.Add(Submission{Kind: KindQuote, Name: "two"})
	s.Add(Submission{Kind: KindEnquiry, Name: "three"})

	all := s.List("")
	if len(all) != 3 {
		t.Fatalf("List(all) len = %d; want 3", len(all))
	}
	if all[0].Name != "three" {
		t.Errorf("newest first: got %q; want %q", all[0].Name, "three")
	}

	quotes := s.List(KindQuote)
	if len(quotes) != 1 || quotes[0].Name != "two" {
		t.Errorf("List(quote) = %+v; want just \"two\"", quotes)
	}
}

func TestSetStatus(t *testing.T) {
	s := newTestStore(t)
	sub, _ := s.Add(Submission{Kind: KindEnquiry, Name: "A"})

	if err := s.SetStatus(sub.ID, StatusContacted); err != nil {
		t.Fatalf("SetStatus: %v", err)
	}
	if got := s.List("")[0].Status; got != StatusContacted {
		t.Errorf("Status = %q; want %q", got, StatusContacted)
	}
	if err := s.SetStatus("NBSS-99999", StatusClosed); err != ErrNotFound {
		t.Errorf("SetStatus(missing) = %v; want ErrNotFound", err)
	}
}

func TestCounts(t *testing.T) {
	s := newTestStore(t)
	s.Add(Submission{Kind: KindEnquiry})
	s.Add(Submission{Kind: KindQuote})
	sub, _ := s.Add(Submission{Kind: KindQuote})
	s.SetStatus(sub.ID, StatusClosed)

	c := s.Counts()
	for key, want := range map[string]int{"total": 3, "quote": 2, "enquiry": 1, "new": 2} {
		if c[key] != want {
			t.Errorf("Counts[%q] = %d; want %d", key, c[key], want)
		}
	}
}

// TestConcurrentAdd is the reason the mutex exists: several form posts can land
// at once, and every one of them must get a distinct ID and survive the flush.
func TestConcurrentAdd(t *testing.T) {
	s := newTestStore(t)

	const n = 50
	var wg sync.WaitGroup
	wg.Add(n)
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			if _, err := s.Add(Submission{Kind: KindEnquiry, Name: "concurrent"}); err != nil {
				t.Errorf("Add: %v", err)
			}
		}()
	}
	wg.Wait()

	subs := s.List("")
	if len(subs) != n {
		t.Fatalf("len = %d; want %d", len(subs), n)
	}
	seen := make(map[string]bool, n)
	for _, sub := range subs {
		if seen[sub.ID] {
			t.Fatalf("duplicate ID %q", sub.ID)
		}
		seen[sub.ID] = true
	}
}
