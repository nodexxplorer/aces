package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestMatricCodeFromLogoName(t *testing.T) {
	good := map[string]string{
		"EG-CE.png":  "EG/CE",
		"EG-CO.png":  "EG/CO",
		"eg-ee.JPG":  "EG/EE",
		"EG-PE.jpeg": "EG/PE",
		"EG-AE.webp": "EG/AE",
	}
	for name, want := range good {
		got, ok := matricCodeFromLogoName(name)
		if !ok || got != want {
			t.Errorf("%s: got (%q, %v), want (%q, true)", name, got, ok, want)
		}
	}
	for _, name := range []string{"README.md", "uniuyo-ce.png", "EGCE.png", "EG-C.png", "EG-CE.gif", "EG-CE.png.bak"} {
		if code, ok := matricCodeFromLogoName(name); ok {
			t.Errorf("%s: accepted as %q", name, code)
		}
	}
}

func TestIsPlaceholderLogo(t *testing.T) {
	if isPlaceholderLogo([]byte("\x89PNG\r\n\x1a\n-real logo bytes-")) {
		t.Fatal("a real image must not count as a placeholder")
	}
	if !isPlaceholderLogo([]byte("\x89PNG\r\n\x1a\n...tEXt aces-placeholder\x001...")) {
		t.Fatal("the placeholder marker must be detected")
	}
}

// Every image in the shipped logo folder must be named after a matric code,
// or the apply step would reject it. The folder is one level above backend/.
func TestDepartmentLogoFolderNames(t *testing.T) {
	dir := filepath.Join("..", "..", "..", "branding", "department-logos")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("read logo folder: %v", err)
	}
	found := 0
	for _, e := range entries {
		if e.IsDir() || !isImageName(e.Name()) {
			continue
		}
		found++
		if _, ok := matricCodeFromLogoName(e.Name()); !ok {
			t.Errorf("%s in the logo folder is not named after a matric code", e.Name())
		}
	}
	if found != 8 {
		t.Errorf("expected 8 department logo files, found %d", found)
	}
}
