package web

import (
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

// form wraps a parsed request and accumulates per-field validation errors so a
// handler can validate everything in one pass and hand the whole set back to
// the template. HTMX re-renders the form partial with the errors in place, so
// the user sees every problem at once instead of one per round trip.
type form struct {
	r      *http.Request
	Values map[string]string
	Errors map[string]string
}

// blankForm returns an empty form for first render, so templates can read
// .Values and .Errors without nil-map guards.
func blankForm() *form {
	return &form{Values: map[string]string{}, Errors: map[string]string{}}
}

func newForm(r *http.Request) (*form, error) {
	if err := r.ParseForm(); err != nil {
		return nil, err
	}
	f := &form{r: r, Values: map[string]string{}, Errors: map[string]string{}}
	for k := range r.PostForm {
		f.Values[k] = strings.TrimSpace(r.PostForm.Get(k))
	}
	return f, nil
}

// Valid reports whether every check so far has passed.
func (f *form) Valid() bool { return len(f.Errors) == 0 }

// Get returns a trimmed field value.
func (f *form) Get(field string) string { return f.Values[field] }

// fail records an error for a field, keeping the first error per field so the
// message the user sees is the most specific one checked.
func (f *form) fail(field, msg string) {
	if _, exists := f.Errors[field]; !exists {
		f.Errors[field] = msg
	}
}

// Required rejects empty values.
func (f *form) Required(field, label string) *form {
	if f.Get(field) == "" {
		f.fail(field, label+" is required.")
	}
	return f
}

// Length enforces a character range on a non-empty value.
func (f *form) Length(field, label string, min, max int) *form {
	v := f.Get(field)
	if v == "" {
		return f
	}
	n := len([]rune(v))
	switch {
	case n < min:
		f.fail(field, label+" looks too short — please give at least "+strconv.Itoa(min)+" characters.")
	case n > max:
		f.fail(field, label+" is too long — keep it under "+strconv.Itoa(max)+" characters.")
	}
	return f
}

var emailRe = regexp.MustCompile(`^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$`)

// Email validates an optional email address.
func (f *form) Email(field, label string) *form {
	v := f.Get(field)
	if v == "" {
		return f
	}
	if !emailRe.MatchString(v) {
		f.fail(field, "That does not look like a valid email address.")
	}
	return f
}

// Phone accepts Indian mobile and landline formats, ignoring spaces, dashes and
// an optional +91 or 0 prefix.
func (f *form) Phone(field, label string) *form {
	v := f.Get(field)
	if v == "" {
		return f
	}
	digits := strings.Map(func(r rune) rune {
		if unicode.IsDigit(r) {
			return r
		}
		return -1
	}, v)
	digits = strings.TrimPrefix(digits, "91")
	digits = strings.TrimPrefix(digits, "0")

	if len(digits) != 10 {
		f.fail(field, "Enter a 10-digit Indian phone number.")
		return f
	}
	if digits[0] < '6' {
		f.fail(field, "An Indian mobile number starts with 6, 7, 8 or 9.")
	}
	return f
}

// OneOf restricts a value to a known set. Empty values pass; combine with
// Required when the field is mandatory.
func (f *form) OneOf(field, label string, allowed ...string) *form {
	v := f.Get(field)
	if v == "" {
		return f
	}
	for _, a := range allowed {
		if v == a {
			return f
		}
	}
	f.fail(field, "Please choose one of the listed options.")
	return f
}

// IntRange validates an optional numeric field.
func (f *form) IntRange(field, label string, min, max int) *form {
	v := f.Get(field)
	if v == "" {
		return f
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		f.fail(field, label+" must be a number.")
		return f
	}
	if n < min || n > max {
		f.fail(field, label+" must be between "+strconv.Itoa(min)+" and "+strconv.Itoa(max)+".")
	}
	return f
}

// Consent requires a checkbox to be ticked.
func (f *form) Consent(field, msg string) *form {
	if f.Get(field) == "" {
		f.fail(field, msg)
	}
	return f
}

// IsBot reports whether the honeypot field was filled in. Real users never see
// it; scripted submitters fill every input they find. This is deliberately the
// only anti-spam measure — a CAPTCHA would cost more conversions than the spam
// costs the office.
func (f *form) IsBot() bool { return f.Get("website") != "" }
