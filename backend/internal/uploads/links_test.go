package uploads

import (
	"errors"
	"net/url"
	"strings"
	"testing"
	"time"
)

const testSecret = "0123456789abcdef0123456789abcdef-test"

var testEpoch = time.Date(2026, 10, 9, 12, 0, 0, 0, time.UTC)

func newTestSigner(t *testing.T, secret string, ttl time.Duration, now time.Time) *Signer {
	t.Helper()
	s, err := NewSigner(secret, ttl)
	if err != nil {
		t.Fatalf("NewSigner: %v", err)
	}
	s.now = func() time.Time { return now }
	return s
}

// parseLink splits an issued link into its store path (decoded, as the router
// sees it) and its exp and sig query parameters.
func parseLink(t *testing.T, link string) (store, exp, sig string) {
	t.Helper()
	u, err := url.Parse(link)
	if err != nil {
		t.Fatalf("parse %q: %v", link, err)
	}
	if !strings.HasPrefix(u.Path, Route+"/") {
		t.Fatalf("link %q does not start with %s/", link, Route)
	}
	return strings.TrimPrefix(u.Path, Route), u.Query().Get("exp"), u.Query().Get("sig")
}

func TestNewSignerRejectsBadInput(t *testing.T) {
	if _, err := NewSigner("", time.Hour); err == nil {
		t.Error("empty secret accepted")
	}
	if _, err := NewSigner(testSecret, 0); err == nil {
		t.Error("zero TTL accepted")
	}
	if _, err := NewSigner(testSecret, -time.Minute); err == nil {
		t.Error("negative TTL accepted")
	}
}

func TestSignedStoredLinkVerifies(t *testing.T) {
	s := newTestSigner(t, testSecret, DefaultTTL, testEpoch)

	link := s.SignStored("crf-signatures/3f2a.png")
	store, exp, sig := parseLink(t, link)
	if store != "/crf-signatures/3f2a.png" {
		t.Fatalf("store path = %q", store)
	}
	if err := s.Verify(store, exp, sig); err != nil {
		t.Fatalf("Verify(own link) = %v", err)
	}
}

func TestLinkExpiresAfterTTL(t *testing.T) {
	ttl := 2 * time.Hour
	s := newTestSigner(t, testSecret, ttl, testEpoch)
	store, exp, sig := parseLink(t, s.SignStored("documents/x.pdf"))

	s.now = func() time.Time { return testEpoch.Add(ttl) }
	if err := s.Verify(store, exp, sig); err != nil {
		t.Errorf("link refused at its exact expiry second: %v", err)
	}

	s.now = func() time.Time { return testEpoch.Add(ttl + time.Second) }
	if err := s.Verify(store, exp, sig); !errors.Is(err, ErrExpired) {
		t.Errorf("link one second past expiry: err = %v, want ErrExpired", err)
	}
}

func TestVerifyRefusesTampering(t *testing.T) {
	s := newTestSigner(t, testSecret, DefaultTTL, testEpoch)
	store, exp, sig := parseLink(t, s.SignStored("course-materials/a.pdf"))

	cases := map[string]struct {
		store, exp, sig string
	}{
		"other path":       {"/course-materials/b.pdf", exp, sig},
		"longer exp":       {store, "9999999999", sig},
		"shorter exp":      {store, "1", sig},
		"sig from another": {store, exp, otherSig(t, s)},
	}
	for name, tc := range cases {
		if err := s.Verify(tc.store, tc.exp, tc.sig); !errors.Is(err, ErrBadSignature) {
			t.Errorf("%s: err = %v, want ErrBadSignature", name, err)
		}
	}
}

// otherSig returns a genuine signature for a different path, to check that a
// signature is bound to the path it was issued for.
func otherSig(t *testing.T, s *Signer) string {
	t.Helper()
	_, _, sig := parseLink(t, s.SignStored("course-materials/other.pdf"))
	if sig == "" {
		t.Fatal("no signature issued")
	}
	return sig
}

func TestVerifyRefusesAnotherKey(t *testing.T) {
	issuer := newTestSigner(t, testSecret, DefaultTTL, testEpoch)
	other := newTestSigner(t, "ffffffffffffffffffffffffffffffff-other", DefaultTTL, testEpoch)

	store, exp, sig := parseLink(t, issuer.SignStored("reports/r.pdf"))
	if err := other.Verify(store, exp, sig); !errors.Is(err, ErrBadSignature) {
		t.Errorf("link from another secret: err = %v, want ErrBadSignature", err)
	}
}

func TestVerifyRefusesUnsignedAndMalformed(t *testing.T) {
	s := newTestSigner(t, testSecret, DefaultTTL, testEpoch)
	store := "/reports/r.pdf"

	if err := s.Verify(store, "", ""); !errors.Is(err, ErrUnsigned) {
		t.Errorf("no parameters: err = %v, want ErrUnsigned", err)
	}
	_, exp, sig := parseLink(t, s.SignStored("reports/r.pdf"))
	if err := s.Verify(store, exp, ""); !errors.Is(err, ErrUnsigned) {
		t.Errorf("no sig: err = %v, want ErrUnsigned", err)
	}
	if err := s.Verify(store, "soon", sig); !errors.Is(err, ErrBadSignature) {
		t.Errorf("non-numeric exp: err = %v, want ErrBadSignature", err)
	}
	if err := s.Verify(store, exp, "!!not-base64!!"); !errors.Is(err, ErrBadSignature) {
		t.Errorf("malformed sig: err = %v, want ErrBadSignature", err)
	}
}

func TestVerifyRefusesNonCanonicalPaths(t *testing.T) {
	s := newTestSigner(t, testSecret, DefaultTTL, testEpoch)
	_, exp, sig := parseLink(t, s.SignStored("reports/r.pdf"))

	for _, store := range []string{
		"/../etc/passwd",
		"/reports/../../etc/passwd",
		"/reports//r.pdf",
		"/reports/./r.pdf",
		"/reports/",
		"reports/r.pdf",
		"/",
		"",
		`/reports\r.pdf`,
		"/reports/r\x00.pdf",
	} {
		if err := s.Verify(store, exp, sig); !errors.Is(err, ErrInvalidPath) {
			t.Errorf("Verify(%q): err = %v, want ErrInvalidPath", store, err)
		}
	}
}

func TestSignStoredRefusesInvalidPaths(t *testing.T) {
	s := newTestSigner(t, testSecret, DefaultTTL, testEpoch)
	for _, rel := range []string{"", "../secrets.txt", "a/../../b", "a//b", "a\\b"} {
		if got := s.SignStored(rel); got != "" {
			t.Errorf("SignStored(%q) = %q, want empty", rel, got)
		}
	}
}

func TestSignRefReplacesQueryAndLeavesOthersAlone(t *testing.T) {
	s := newTestSigner(t, testSecret, DefaultTTL, testEpoch)

	stale := "/uploads/profile-photos/a.png?exp=1&sig=stale"
	signed := s.SignRef(stale)
	store, exp, sig := parseLink(t, signed)
	if store != "/profile-photos/a.png" {
		t.Fatalf("store = %q", store)
	}
	if err := s.Verify(store, exp, sig); err != nil {
		t.Errorf("re-signed link does not verify: %v", err)
	}
	if strings.Count(signed, "exp=") != 1 {
		t.Errorf("stale query kept alongside the new one: %q", signed)
	}

	for _, ref := range []string{
		"",
		"https://cdn.example.com/uploads/a.png",
		"profile-photos/a.png",
		"/uploads/../secrets.txt",
		"/elsewhere/a.png",
	} {
		if got := s.SignRef(ref); got != ref {
			t.Errorf("SignRef(%q) = %q, want unchanged", ref, got)
		}
	}
}

func TestSignRefIsIdempotentAtTheSameInstant(t *testing.T) {
	s := newTestSigner(t, testSecret, DefaultTTL, testEpoch)
	once := s.SignRef("/uploads/documents/x.pdf")
	if twice := s.SignRef(once); twice != once {
		t.Errorf("second signing changed the link:\n%s\n%s", once, twice)
	}
}

func TestSignedLinkEscapesAndDecodesSpaces(t *testing.T) {
	s := newTestSigner(t, testSecret, DefaultTTL, testEpoch)
	link := s.SignStored("documents/scan 1.pdf")
	if strings.Contains(link, " ") {
		t.Fatalf("link contains a raw space: %q", link)
	}
	store, exp, sig := parseLink(t, link)
	if store != "/documents/scan 1.pdf" {
		t.Fatalf("decoded store = %q", store)
	}
	if err := s.Verify(store, exp, sig); err != nil {
		t.Errorf("Verify of escaped link: %v", err)
	}
}

func TestPointerHelpers(t *testing.T) {
	s := newTestSigner(t, testSecret, DefaultTTL, testEpoch)
	if s.SignRefPtr(nil) != nil || s.SignStoredPtr(nil) != nil {
		t.Error("nil pointer should stay nil")
	}
	ext := "https://example.com/a.png"
	if got := s.SignRefPtr(&ext); got == nil || *got != ext {
		t.Errorf("external URL pointer changed: %v", got)
	}
}

func TestNilSignerIssuesUnsignedPathsAndVerifiesNothing(t *testing.T) {
	var s *Signer
	if got := s.SignRef("/uploads/a.png"); got != "/uploads/a.png" {
		t.Errorf("nil SignRef = %q", got)
	}
	if got := s.SignStored("documents/a.pdf"); got != "/uploads/documents/a.pdf" {
		t.Errorf("nil SignStored = %q", got)
	}
	if err := s.Verify("/documents/a.pdf", "9999999999", "x"); !errors.Is(err, ErrBadSignature) {
		t.Errorf("nil Verify = %v, want ErrBadSignature", err)
	}
	if s.TTL() != 0 {
		t.Errorf("nil TTL = %s", s.TTL())
	}
}

func TestLinkKeyIsDerivedNotTheSecret(t *testing.T) {
	s := newTestSigner(t, testSecret, DefaultTTL, testEpoch)
	if string(s.key) == testSecret {
		t.Fatal("the link key is the raw JWT secret")
	}
}

func TestFilePathStaysUnderRoot(t *testing.T) {
	root := "/srv/uploads"
	got, err := FilePath(root, "/crf-signatures/a.png")
	if err != nil {
		t.Fatalf("FilePath: %v", err)
	}
	if got != "/srv/uploads/crf-signatures/a.png" {
		t.Errorf("FilePath = %q", got)
	}
	for _, store := range []string{"/../x", "/a/../../x", "x", "/"} {
		if _, err := FilePath(root, store); !errors.Is(err, ErrInvalidPath) {
			t.Errorf("FilePath(%q): err = %v, want ErrInvalidPath", store, err)
		}
	}
}
