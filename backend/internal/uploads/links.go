// Package uploads issues and checks links to stored files.
//
// Uploaded files are served under /uploads. A link to one carries two query
// parameters: exp, the expiry as Unix seconds, and sig, an HMAC-SHA256 over
// the canonical path and exp. The key is derived from JWT_SECRET under its own
// label, so the JWT signing key never signs a link.
//
// The signature is the authorisation. The route itself is public, so a
// request without a valid, unexpired signature is refused.
package uploads

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"net/url"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// Route is the URL prefix every stored file is served under. Store paths
// (for example "/crf-signatures/3f2a.png") are appended to it.
const Route = "/uploads"

// DefaultTTL is how long a newly issued link stays valid.
const DefaultTTL = 24 * time.Hour

const (
	keyLabel = "aces uploads link key v1"
	sigLabel = "aces uploads link v1"
	maxPath  = 1024
)

var (
	// ErrInvalidPath means a path is not in canonical form, or would leave the storage root.
	ErrInvalidPath = errors.New("uploads: invalid path")
	// ErrUnsigned means the request carries no exp or sig parameter.
	ErrUnsigned = errors.New("uploads: link is not signed")
	// ErrBadSignature means the signature does not match the path and expiry.
	ErrBadSignature = errors.New("uploads: signature does not match")
	// ErrExpired means the signature is genuine but the link's lifetime has passed.
	ErrExpired = errors.New("uploads: link has expired")
)

// Signer issues and verifies upload links. Build one with NewSigner.
//
// A nil *Signer issues unsigned paths and verifies nothing. Callers in
// production always set one; the nil form keeps handler tests simple.
type Signer struct {
	key []byte
	ttl time.Duration
	now func() time.Time
}

// NewSigner derives the link key from secret (the JWT secret in production)
// and sets how long issued links stay valid.
func NewSigner(secret string, ttl time.Duration) (*Signer, error) {
	if secret == "" {
		return nil, errors.New("uploads: signing secret is empty")
	}
	if ttl <= 0 {
		return nil, fmt.Errorf("uploads: link lifetime must be positive, got %s", ttl)
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(keyLabel))
	return &Signer{key: mac.Sum(nil), ttl: ttl, now: time.Now}, nil
}

// TTL reports how long a newly issued link stays valid.
func (s *Signer) TTL() time.Duration {
	if s == nil {
		return 0
	}
	return s.ttl
}

// SignRef signs a reference that already carries the /uploads prefix, such as
// an avatar URL read from the database or echoed back by a client. Any query
// string on the input is replaced. Anything else (external URLs, relative
// paths, empty strings, non-canonical paths) is returned unchanged.
func (s *Signer) SignRef(ref string) string {
	if s == nil || !strings.HasPrefix(ref, Route+"/") {
		return ref
	}
	bare, _, _ := strings.Cut(ref, "?")
	store, err := CleanPath(strings.TrimPrefix(bare, Route))
	if err != nil {
		return ref
	}
	return s.issue(store)
}

// SignStored returns a signed link for a storage-relative path such as
// "course-materials/3f2a.pdf", which is the form the database holds. An empty
// or invalid path yields "" so that no broken link is shown.
func (s *Signer) SignStored(rel string) string {
	if rel == "" {
		return ""
	}
	if strings.HasPrefix(rel, Route+"/") {
		return s.SignRef(rel)
	}
	store, err := CleanPath("/" + rel)
	if err != nil {
		return ""
	}
	return s.issue(store)
}

// SignRefPtr is SignRef for nullable columns. A nil pointer stays nil.
func (s *Signer) SignRefPtr(ref *string) *string {
	if ref == nil {
		return nil
	}
	signed := s.SignRef(*ref)
	return &signed
}

// SignStoredPtr is SignStored for nullable columns. A nil pointer stays nil.
func (s *Signer) SignStoredPtr(rel *string) *string {
	if rel == nil {
		return nil
	}
	signed := s.SignStored(*rel)
	return &signed
}

// Verify checks a request. store is the decoded path after Route (for example
// "/crf-signatures/3f2a.png"), and exp and sig are the query parameters.
func (s *Signer) Verify(store, exp, sig string) error {
	if s == nil {
		return ErrBadSignature
	}
	if _, err := CleanPath(store); err != nil {
		return err
	}
	if exp == "" || sig == "" {
		return ErrUnsigned
	}
	expUnix, err := strconv.ParseInt(exp, 10, 64)
	if err != nil {
		return ErrBadSignature
	}
	got, err := base64.RawURLEncoding.DecodeString(sig)
	if err != nil {
		return ErrBadSignature
	}
	if !hmac.Equal(got, s.mac(store, expUnix)) {
		return ErrBadSignature
	}
	if s.now().Unix() > expUnix {
		return ErrExpired
	}
	return nil
}

// issue builds the signed URL path for a canonical store path.
func (s *Signer) issue(store string) string {
	escaped := (&url.URL{Path: store}).EscapedPath()
	if s == nil {
		return Route + escaped
	}
	exp := s.now().Add(s.ttl).Unix()
	sig := base64.RawURLEncoding.EncodeToString(s.mac(store, exp))
	return Route + escaped + "?exp=" + strconv.FormatInt(exp, 10) + "&sig=" + sig
}

func (s *Signer) mac(store string, exp int64) []byte {
	mac := hmac.New(sha256.New, s.key)
	mac.Write([]byte(sigLabel + "\n" + store + "\n" + strconv.FormatInt(exp, 10)))
	return mac.Sum(nil)
}

// CleanPath accepts only canonical store paths: absolute, with no empty, "."
// or ".." segments, no backslashes, no control characters, and no trailing
// slash. A path that is not already canonical is refused rather than tidied,
// so each file has exactly one signed form.
func CleanPath(p string) (string, error) {
	if len(p) < 2 || len(p) > maxPath || p[0] != '/' {
		return "", ErrInvalidPath
	}
	for i := 0; i < len(p); i++ {
		if c := p[i]; c < 0x20 || c == 0x7f || c == '\\' {
			return "", ErrInvalidPath
		}
	}
	if path.Clean(p) != p {
		return "", ErrInvalidPath
	}
	return p, nil
}

// FilePath maps a canonical store path onto the storage root. It refuses any
// path that would resolve outside root.
func FilePath(root, store string) (string, error) {
	clean, err := CleanPath(store)
	if err != nil {
		return "", err
	}
	full := filepath.Join(root, filepath.FromSlash(clean))
	rel, err := filepath.Rel(root, full)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", ErrInvalidPath
	}
	return full, nil
}
