package utils

import (
	"os"
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

	for _, kind := range []ReceiptKind{DepartmentDues, ClassDues} {
		name := "department"
		if kind == ClassDues {
			name = "class"
		}

		dc, n, err := IssueReceipt(DefaultOrg, kind, d)
		if err != nil {
			t.Fatalf("IssueReceipt(%s): %v", name, err)
		}
		if n == 0 {
			t.Fatalf("receipt number should be >= 1")
		}

		pngPath := filepath.Join(outDir, name+".png")
		if err := dc.SavePNG(pngPath); err != nil {
			t.Fatalf("SavePNG: %v", err)
		}
		t.Logf("rendered %s receipt no. %04d -> %s", name, n, pngPath)

		pdf, err := RenderReceiptPDF(DefaultOrg, kind, n, d)
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
	if len(DefaultOrg.LogoLeft) == 0 {
		t.Error("LogoLeft (uniuyo) is empty — placeholder would be rendered")
	}
	if len(DefaultOrg.LogoRight) == 0 {
		t.Error("LogoRight (ACES) is empty — placeholder would be rendered")
	}
}

// TestMain redirects the receipt-number counter into a temp dir BEFORE any
// test in the package runs, so issuing receipts never leaves a
// receipt_counter.json artifact in the source tree.
func TestMain(m *testing.M) {
	receiptCounter.Path = filepath.Join(os.TempDir(), "aces_test_receipt_counter.json")
	os.Exit(m.Run())
}
