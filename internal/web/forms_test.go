package web

import (
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func formFrom(t *testing.T, values url.Values) *form {
	t.Helper()
	r := httptest.NewRequest("POST", "/", strings.NewReader(values.Encode()))
	r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	f, err := newForm(r)
	if err != nil {
		t.Fatalf("newForm: %v", err)
	}
	return f
}

func TestPhoneAcceptsIndianFormats(t *testing.T) {
	good := []string{
		"9864012345",
		"98640 12345",
		"+91 98640 12345",
		"+919864012345",
		"098640-12345",
		"6000000000",
	}
	for _, in := range good {
		f := formFrom(t, url.Values{"phone": {in}})
		f.Phone("phone", "Phone")
		if !f.Valid() {
			t.Errorf("Phone(%q) rejected: %v", in, f.Errors["phone"])
		}
	}

	bad := []string{"123", "12345678901234", "5000000000", "abcdefghij"}
	for _, in := range bad {
		f := formFrom(t, url.Values{"phone": {in}})
		f.Phone("phone", "Phone")
		if f.Valid() {
			t.Errorf("Phone(%q) accepted; want rejection", in)
		}
	}
}

func TestEmailIsOptionalButValidated(t *testing.T) {
	f := formFrom(t, url.Values{"email": {""}})
	if f.Email("email", "Email"); !f.Valid() {
		t.Error("empty email should pass — the field is optional")
	}

	for _, bad := range []string{"nope", "a@b", "a b@c.com", "@example.com"} {
		f := formFrom(t, url.Values{"email": {bad}})
		f.Email("email", "Email")
		if f.Valid() {
			t.Errorf("Email(%q) accepted; want rejection", bad)
		}
	}

	f = formFrom(t, url.Values{"email": {"guard@nbss.co.in"}})
	if f.Email("email", "Email"); !f.Valid() {
		t.Error("valid email rejected")
	}
}

func TestValidationCollectsEveryError(t *testing.T) {
	// One round trip should surface every problem, not just the first.
	f := formFrom(t, url.Values{"name": {""}, "phone": {"1"}, "message": {"hi"}})
	f.Required("name", "Your name").
		Required("phone", "A phone number").Phone("phone", "Phone").
		Length("message", "Message", 10, 2000).
		Consent("consent", "Please confirm.")

	if len(f.Errors) != 4 {
		t.Errorf("collected %d errors (%v); want 4", len(f.Errors), f.Errors)
	}
}

func TestFirstErrorPerFieldWins(t *testing.T) {
	// Required runs before Phone, so the user sees the more specific "required"
	// message rather than a confusing format complaint about an empty box.
	f := formFrom(t, url.Values{"phone": {""}})
	f.Required("phone", "A phone number").Phone("phone", "Phone")
	if got := f.Errors["phone"]; got != "A phone number is required." {
		t.Errorf("error = %q; want the Required message", got)
	}
}

func TestOneOfAndIntRange(t *testing.T) {
	f := formFrom(t, url.Values{"district": {"Atlantis"}})
	f.OneOf("district", "District", "Kokrajhar", "Chirang")
	if f.Valid() {
		t.Error("OneOf accepted a value outside the allowed set")
	}

	f = formFrom(t, url.Values{"age": {"17"}})
	f.IntRange("age", "Age", 18, 60)
	if f.Valid() {
		t.Error("IntRange accepted 17 for an 18–60 range")
	}

	f = formFrom(t, url.Values{"age": {"twenty"}})
	f.IntRange("age", "Age", 18, 60)
	if f.Valid() {
		t.Error("IntRange accepted a non-numeric value")
	}
}

func TestHoneypot(t *testing.T) {
	clean := formFrom(t, url.Values{"name": {"Real Person"}})
	if clean.IsBot() {
		t.Error("empty honeypot flagged as a bot")
	}
	bot := formFrom(t, url.Values{"name": {"spam"}, "website": {"http://spam.example"}})
	if !bot.IsBot() {
		t.Error("filled honeypot not flagged")
	}
}

func TestValuesAreTrimmed(t *testing.T) {
	f := formFrom(t, url.Values{"name": {"  Rwmwi Narzary  "}})
	if got := f.Get("name"); got != "Rwmwi Narzary" {
		t.Errorf("Get = %q; want the trimmed value", got)
	}
}
