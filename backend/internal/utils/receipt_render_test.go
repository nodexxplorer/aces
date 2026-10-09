package utils

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestRenderReceiptSamples(t *testing.T) {
	outDir := t.TempDir()

	d := ReceiptData{
		Date:         "29/09/2026",
		ReceivedFrom: "John Doe (20/EE/1234)",
		Of:           "John Doe (20/EE/1234)",
		SumOf:        "Fifteen Thousand Naira, Only",
		NairaWords:   "Fifteen Thousand",
		KoboWords:    "Zero",
		Being:        "Payment of Department Dues 2025/2026",
		AmountNaira:  "15000",
		AmountKobo:   "00",
		RegNo:        "20/EE/1234",
	}
	org := OrgFor("Department of Computer Engineering", "University of Uyo", "acesuniuyo112@gmail.com", acesLogoPNG)

	for _, kind := range []ReceiptKind{DepartmentDues, ClassDues} {
		name := "department"
		if kind == ClassDues {
			name = "class"
		}

		dc := RenderReceipt(org, kind, 1, d)
		pngPath := filepath.Join(outDir, name+".png")
		if err := dc.SavePNG(pngPath); err != nil {
			t.Fatalf("SavePNG: %v", err)
		}
		t.Logf("rendered %s receipt -> %s", name, pngPath)

		pdf, err := RenderReceiptPDF(org, kind, 1, d)
		if err != nil {
			t.Fatalf("RenderReceiptPDF(%s): %v", name, err)
		}
		if !strings.HasPrefix(string(pdf[:5]), "%PDF-") {
			t.Fatalf("output is not a PDF")
		}
		if len(pdf) < 100_000 {
			t.Fatalf("PDF suspiciously small (%d bytes) — letterhead image likely missing", len(pdf))
		}
	}
}

// The production container (Alpine) ships no fonts; fail loudly here if
// someone removes the embedded TTFs so it never surfaces as a blank receipt.
func TestEmbeddedFontsPresent(t *testing.T) {
	for _, name := range []string{
		"DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "DejaVuSerif.ttf",
		"DejaVuSerif-Bold.ttf", "DejaVuSansMono-Bold.ttf",
	} {
		if _, err := embeddedFont(name); err != nil {
			t.Errorf("embedded font %s: %v", name, err)
		}
	}
}

func TestEmbeddedLogosPresent(t *testing.T) {
	if len(uniuyoLogoPNG) == 0 {
		t.Error("the University of Uyo crest is empty — placeholder would be rendered")
	}
	if len(acesLogoPNG) == 0 {
		t.Error("the ACES logo sample is empty — placeholder would be rendered")
	}
}
