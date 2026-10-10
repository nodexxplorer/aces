package api

import (
	"net/http"
	"testing"
	"time"
)

func TestLoginTemplatesAreTheThreeNamed(t *testing.T) {
	for _, name := range []string{"classic", "split", "centered"} {
		if !loginTemplates[name] {
			t.Errorf("template %q should be accepted", name)
		}
	}
	for _, name := range []string{"", "video", "Split", "modern"} {
		if loginTemplates[name] {
			t.Errorf("template %q should be refused", name)
		}
	}
}

func TestLoginLookBodyOmitsImageWhenNoneUploaded(t *testing.T) {
	body := loginLookBody("co", loginLook{Template: loginTemplateSplit})
	if body.Template != "split" {
		t.Fatalf("template = %q", body.Template)
	}
	if body.ImageURL != "" {
		t.Fatalf("imageUrl should be absent with no image, got %q", body.ImageURL)
	}
}

func TestLoginLookBodyVersionsTheImageURL(t *testing.T) {
	updated := time.Unix(1_700_000_000, 0)
	body := loginLookBody("uniuyo-ce", loginLook{Template: loginTemplateCentered, ImageType: "image/png", UpdatedAt: updated})
	want := "/api/v1/tenants/uniuyo-ce/login-image?v=1700000000"
	if body.ImageURL != want {
		t.Fatalf("imageUrl = %q, want %q", body.ImageURL, want)
	}
}

// The stored type comes from the bytes, so a file named .png that is really an
// SVG is refused, and a real PNG, JPEG or WebP is accepted.
func TestLoginImageTypeIsSniffedFromBytes(t *testing.T) {
	png := append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 64)...)
	jpeg := append([]byte{0xFF, 0xD8, 0xFF, 0xE0}, make([]byte, 64)...)
	webp := append([]byte("RIFF\x24\x00\x00\x00WEBPVP8 "), make([]byte, 64)...)
	svg := []byte(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>`)

	cases := []struct {
		name string
		data []byte
		ok   bool
	}{
		{"png", png, true},
		{"jpeg", jpeg, true},
		{"webp", webp, true},
		{"svg renamed to png", svg, false},
		{"plain text", []byte("hello"), false},
		{"html", []byte("<!doctype html><html></html>"), false},
	}
	for _, tc := range cases {
		got := http.DetectContentType(tc.data)
		if loginImageTypes[got] != tc.ok {
			t.Errorf("%s: sniffed %q, accepted=%v, want accepted=%v", tc.name, got, loginImageTypes[got], tc.ok)
		}
	}
}

func TestLoginImageLimitIsFourMiB(t *testing.T) {
	// Matches the database check on department_login_looks.hero (migration 000013).
	if maxLoginImageBytes != 4<<20 {
		t.Fatalf("limit = %d, want 4 MiB", maxLoginImageBytes)
	}
}
