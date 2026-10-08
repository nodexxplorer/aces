package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

// TestVisualOutput renders the dues receipts (department + class, as PNG and
// PDF) and the department stamp to real files so they can be inspected
// visually. Output goes to $RECEIPT_VISUAL_DIR (default: ./visual_output
// next to this file, git-ignored). Run it with:
//
//	go test ./internal/utils/ -run TestVisualOutput -v
//
// The printed paths are the files to open.
func TestVisualOutput(t *testing.T) {
	outDir := os.Getenv("RECEIPT_VISUAL_DIR")
	if outDir == "" {
		outDir = filepath.Join(".", "visual_output")
	}
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", outDir, err)
	}

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

	paths := []string{}

	for _, kind := range []ReceiptKind{DepartmentDues, ClassDues} {
		name := "department"
		if kind == ClassDues {
			name = "class"
		}

		dc, n, err := IssueReceipt(DefaultOrg, kind, d)
		if err != nil {
			t.Fatalf("IssueReceipt(%s): %v", name, err)
		}

		pngPath := filepath.Join(outDir, "receipt_"+name+".png")
		if err := dc.SavePNG(pngPath); err != nil {
			t.Fatalf("SavePNG(%s): %v", name, err)
		}
		paths = append(paths, pngPath)

		pdfBytes, err := RenderReceiptPDF(DefaultOrg, kind, n, d)
		if err != nil {
			t.Fatalf("RenderReceiptPDF(%s): %v", name, err)
		}
		pdfPath := filepath.Join(outDir, "receipt_"+name+".pdf")
		if err := os.WriteFile(pdfPath, pdfBytes, 0o644); err != nil {
			t.Fatalf("write %s: %v", pdfPath, err)
		}
		paths = append(paths, pdfPath)
	}

	// Department stamp (transparent PNG).
	stampPNG, err := DeptStampPNG(500, 320, DefaultConfig())
	if err != nil {
		t.Fatalf("DeptStampPNG: %v", err)
	}
	stampPath := filepath.Join(outDir, "dept_stamp.png")
	if err := os.WriteFile(stampPath, stampPNG, 0o644); err != nil {
		t.Fatalf("write %s: %v", stampPath, err)
	}
	paths = append(paths, stampPath)

	fmt.Println("\nVisual samples written:")
	for _, p := range paths {
		abs, _ := filepath.Abs(p)
		fmt.Println("  " + abs)
	}
}
