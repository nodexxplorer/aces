package main

import (
	"strings"
	"testing"
)

func TestNormalizeMatricCode(t *testing.T) {
	for in, want := range map[string]string{
		"":        "", // unset
		"  ":      "", // unset
		"EG/EE":   "EG/EE",
		"eg/ee":   "EG/EE",
		" EG/CO ": "EG/CO",
	} {
		got, err := normalizeMatricCode(in)
		if err != nil || got != want {
			t.Errorf("normalizeMatricCode(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, bad := range []string{"EE", "EG-EE", "EG/EEE", "E1/EE", "EG/E"} {
		if _, err := normalizeMatricCode(bad); err == nil {
			t.Errorf("normalizeMatricCode(%q) accepted a malformed code", bad)
		}
	}
}

func TestCheckLogo(t *testing.T) {
	png := append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 64)...)
	jpeg := append([]byte{0xFF, 0xD8, 0xFF, 0xE0}, make([]byte, 64)...)
	webp := append([]byte("RIFF\x00\x00\x00\x00WEBPVP8 "), make([]byte, 64)...)

	for name, data := range map[string][]byte{"png": png, "jpeg": jpeg, "webp": webp} {
		got, typ, err := checkLogo(data)
		if err != nil || len(got) != len(data) || !strings.HasPrefix(typ, "image/") {
			t.Errorf("checkLogo(%s) = %q, %v; want accepted", name, typ, err)
		}
	}

	refused := map[string][]byte{
		"gif":     []byte("GIF89a" + strings.Repeat("\x00", 64)),
		"svg":     []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`),
		"text":    []byte("not an image at all"),
		"too big": append(append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, maxLogoBytes)...), 0),
	}
	for name, data := range refused {
		if _, _, err := checkLogo(data); err == nil {
			t.Errorf("checkLogo(%s) accepted a refused logo", name)
		}
	}
}

func TestValidContactEmail(t *testing.T) {
	good := []string{"acesuniuyo112@gmail.com", "ee@dept.example.edu"}
	bad := []string{"", "no-at-sign", "@example.com", "a@b", "a b@example.com", "a@@example.com", "a@.example.com", "a@example."}
	for _, s := range good {
		if !validContactEmail(s) {
			t.Errorf("%q should be accepted", s)
		}
	}
	for _, s := range bad {
		if validContactEmail(s) {
			t.Errorf("%q should be refused", s)
		}
	}
}
